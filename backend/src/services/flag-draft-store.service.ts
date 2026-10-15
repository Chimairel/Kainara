import { Prisma, type ReviewFlagDraft } from '@prisma/client';
import { AppError } from '@/errors/AppError';
import { json } from './meal-review-context.service';

export const FLAG_DRAFT_TTL_MS = 30 * 60 * 1000;
/** Retry only rolled-back serialization conflicts so a concurrent retry can read its receipt. */
export async function retryFlagTransaction<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await operation(); }
    catch (error) {
      if (attempt >= 2 || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2034') throw error;
    }
  }
}
export async function lockFlagDraft(tx: Prisma.TransactionClient, key: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(741015, hashtext(${key}))`;
}
export async function auditFlagDraft(tx: Prisma.TransactionClient, draft: ReviewFlagDraft, action: string) {
  const owner = await tx.user.findUnique({ where: { id: draft.ownerUserId }, select: { id: true, role: true } });
  await tx.auditEvent.create({ data: { actorUserId: owner?.id ?? null, actorRole: owner?.role ?? null, actorName: draft.ownerName,
    action: `FLAG_DRAFT_${action}`, entityType: draft.entityType, entityId: draft.entityId,
    metadata: { draftId: draft.id, targetKey: draft.targetKey, expectedVersion: draft.expectedVersion,
      reason: `Flag draft ${action.toLowerCase()}.` } } });
}
/** Target transactions already own their recipe/approval lock before taking this lease lock. */
export async function flagDraftForSubmission(tx: Prisma.TransactionClient, key: string, userId: string,
  input: { flagDraftId?: string; expectedVersion: string }) {
  if (!input.flagDraftId) return null; // Internal legacy callers only; HTTP requires a lease.
  await lockFlagDraft(tx, key);
  const draft = await tx.reviewFlagDraft.findUnique({ where: { id: input.flagDraftId } });
  if (!draft || draft.ownerUserId !== userId || draft.targetKey !== key || draft.expectedVersion !== input.expectedVersion)
    throw new AppError('This flag draft belongs to another review. Reopen its details.', 409, 'FLAG_DRAFT_CONFLICT');
  if (draft.state === 'SUBMITTED') return draft;
  if (draft.state !== 'ACTIVE' || draft.expiresAt <= new Date())
    throw new AppError('Your flag draft lock expired. Resume the flag before submitting.', 409, 'FLAG_DRAFT_EXPIRED');
  return draft;
}
export async function finishFlagDraft(tx: Prisma.TransactionClient, draft: ReviewFlagDraft | null, result: unknown) {
  if (!draft) return;
  await tx.reviewFlagDraft.update({ where: { id: draft.id }, data: { state: 'SUBMITTED', result: json(result) } });
  await auditFlagDraft(tx, draft, 'SUBMITTED');
}

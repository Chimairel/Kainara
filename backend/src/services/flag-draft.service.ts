import { z } from 'zod';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { caseApprovalFlagContext } from './case-approval-flag.service';
import { reviewActor, reviewContext, lockRecipeLineage, json } from './meal-review-context.service';
import { approvalRecheckContext } from './approval-recheck-context.service';
import { auditFlagDraft, FLAG_DRAFT_TTL_MS, lockFlagDraft } from './flag-draft-store.service';
import type { Prisma } from '@prisma/client';

export const flagDraftTargetSchema = z.object({ kind: z.enum(['MEAL', 'CASE', 'PROFILE', 'CONDITION']),
  targetId: z.string().min(1).max(191), mealId: z.string().min(1).max(191).optional() }).strict();
const partialNotes = z.object({ category: z.enum(['INGREDIENT','NUTRITION','ALLERGEN','PREPARATION','EVIDENCE','OTHER']),
  affectedFields: z.string().max(8000), explanation: z.string().max(3000), reference: z.string().max(2000), proposedCorrection: z.string().max(2000) }).strict();
export const flagDraftBodySchema = z.object({ target: flagDraftTargetSchema,
  expectedVersion: z.string().regex(/^[a-f0-9]{64}$/).optional(), draftId: z.string().uuid().optional(), notes: partialNotes.optional(),
}).strict();
type Target = z.infer<typeof flagDraftTargetSchema>;
type Body = z.infer<typeof flagDraftBodySchema>;

async function targetContext(tx: Prisma.TransactionClient, target: Target, admin: boolean, statusOnly = false) {
  if (target.kind === 'CASE') {
    if (admin) throw new AppError('Use an eligible RND account for approval flags.', 403, 'REVIEWER_INELIGIBLE');
    await tx.$queryRaw`SELECT id FROM "MealPlanReviewDecision" WHERE id = ${target.targetId} FOR UPDATE`;
    const context = await caseApprovalFlagContext(tx, target.targetId);
    return { key: `case:${target.targetId}`, entityType: 'MealPlanReviewDecision', entityId: target.targetId,
      version: context.expectedVersion, canFlag: context.canFlag };
  }
  const mealId = target.kind === 'MEAL' ? target.targetId : target.mealId;
  if (!mealId) throw new AppError('Select a meal for this approval.', 400, 'VALIDATION_ERROR');
  const statusKey = statusOnly ? await lockRecipeLineage(tx, mealId) : '';
  const context = statusOnly ? {
    key: statusKey, recipeVersion: '',
    lineage: await tx.mealReviewLineage.findUnique({ where: { key: statusKey }, select: { state: true } }),
    meals: [await tx.mealLibrary.findUniqueOrThrow({ where: { id: mealId }, select: { id: true, status: true } })],
  } : await reviewContext(tx, mealId, true);
  if (target.kind === 'MEAL') return { key: `meal:${context.key}`, entityType: 'MealLibrary', entityId: context.meals[0].id,
    version: context.recipeVersion, canFlag: context.lineage?.state !== 'ARCHIVED' && context.meals.some(meal => meal.status === 'APPROVED' || meal.status === 'FLAGGED') };
  if (admin) throw new AppError('Use an eligible RND account for approval flags.', 403, 'REVIEWER_INELIGIBLE');
  const approval = await approvalRecheckContext(tx, { mealLibraryId: mealId, approvalId: target.targetId, kind: target.kind });
  return { key: `${target.kind.toLowerCase()}:${target.targetId}`, entityType: target.kind === 'PROFILE' ? 'MealLibraryProfileApproval' : 'MealConditionClearance',
    entityId: target.targetId, version: context.recipeVersion,
    canFlag: !approval.flagged && ['ACTIVE','REVIEW_DUE'].includes(approval.state) && context.meals.every(meal => meal.status === 'APPROVED') };
}

/** Only the owner receives unpublished notes; status never changes meal eligibility. */
export async function manageFlagDraft(userId: string, rndId: string | null, action: 'status'|'begin'|'save'|'cancel', input: Body) {
  return prisma.$transaction(async tx => {
    const actor = await reviewActor(tx, userId, rndId);
    const context = await targetContext(tx, input.target, !rndId, action === 'status' || action === 'cancel');
    await lockFlagDraft(tx, context.key);
    const now = new Date();
    const expired = await tx.reviewFlagDraft.findMany({ where: { targetKey: context.key, state: 'ACTIVE', expiresAt: { lte: now } } });
    for (const draft of expired) {
      await tx.reviewFlagDraft.update({ where: { id: draft.id }, data: { state: 'EXPIRED' } });
      await auditFlagDraft(tx, draft, 'EXPIRED');
    }
    let active = await tx.reviewFlagDraft.findFirst({ where: { targetKey: context.key, state: 'ACTIVE' } });
    const view = () => ({ canFlag: context.canFlag, blocked: Boolean(active && active.ownerUserId !== userId),
      ownerName: active?.ownerName ?? null, expiresAt: active?.expiresAt ?? null,
      draft: active?.ownerUserId === userId ? { id: active.id, notes: active.notes, expectedVersion: active.expectedVersion } : null });
    if (action === 'status') return view();
    if (action === 'begin') {
      if (!context.canFlag || input.expectedVersion !== context.version)
        throw new AppError('The reviewed evidence changed or flagging is no longer available. Reopen its details.', 409, 'FLAG_DRAFT_STALE');
      if (active && active.ownerUserId !== userId) return view();
      if (active && active.expectedVersion !== context.version) {
        await tx.reviewFlagDraft.update({ where: { id: active.id }, data: { state: 'EXPIRED' } });
        await auditFlagDraft(tx, active, 'EXPIRED'); active = null;
      }
      if (!active) {
        const previous = await tx.reviewFlagDraft.findFirst({ where: { targetKey: context.key, ownerUserId: userId,
          expectedVersion: context.version }, orderBy: { createdAt: 'desc' }, select: { notes: true, state: true } });
        active = await tx.reviewFlagDraft.create({ data: { targetKey: context.key, entityType: context.entityType, entityId: context.entityId,
          ownerUserId: userId, ownerName: String((actor.snapshot as { name?: string }).name ?? 'RND'), expectedVersion: context.version,
          notes: previous?.state === 'EXPIRED' && previous.notes ? json(previous.notes) : { category: 'NUTRITION', affectedFields: '', explanation: '', reference: '', proposedCorrection: '' }, expiresAt: new Date(now.getTime()+FLAG_DRAFT_TTL_MS) } });
        await auditFlagDraft(tx, active, 'STARTED');
      }
      return view();
    }
    if (!active || active.id !== input.draftId || active.ownerUserId !== userId)
      throw new AppError('The flag draft lock is no longer yours. Reopen its details.', 409, 'FLAG_DRAFT_EXPIRED');
    if (action === 'cancel') {
      await tx.reviewFlagDraft.update({ where: { id: active.id }, data: { state: 'CANCELLED', notes: {} } });
      await auditFlagDraft(tx, active, 'CANCELLED'); active = null;
    } else {
      if (!input.notes || !context.canFlag || context.version !== active.expectedVersion)
        throw new AppError('The reviewed evidence changed. Cancel this draft and reopen the details.', 409, 'FLAG_DRAFT_STALE');
      active = await tx.reviewFlagDraft.update({ where: { id: active.id }, data: { notes: json(input.notes), expiresAt: new Date(now.getTime()+FLAG_DRAFT_TTL_MS) } });
    }
    return view();
  }, { timeout: 30000 });
}

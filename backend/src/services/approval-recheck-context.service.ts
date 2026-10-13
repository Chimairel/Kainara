import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { AppError } from '@/errors/AppError';

type Target = { mealLibraryId: string; approvalId: string; kind: 'PROFILE' | 'CONDITION' };
export async function approvalRecheckContext(tx: Prisma.TransactionClient, target: Target) {
  const meal = await tx.mealLibrary.findUnique({
    where: { id: target.mealLibraryId },
    select: { status: true, recipeSignature: true, safetyEvidenceRevision: true },
  });
  const approval =
    target.kind === 'PROFILE'
      ? await tx.mealLibraryProfileApproval.findUnique({ where: { id: target.approvalId } })
      : await tx.mealConditionClearance.findUnique({
          where: { id: target.approvalId },
          include: {
            decisions: { orderBy: { submittedAt: 'desc' }, take: 1, select: { nutritionistProfileId: true } },
          },
        });
  if (!meal || !approval || approval.mealLibraryId !== target.mealLibraryId)
    throw new AppError('Approval not found for this meal.', 404, 'APPROVAL_NOT_FOUND');
  const event = await tx.auditEvent.findFirst({
    where: {
      entityId: target.approvalId,
      entityType: target.kind === 'PROFILE' ? 'MealLibraryProfileApproval' : 'MealConditionClearance',
      action: { in: ['MEAL_APPROVAL_FLAGGED', 'CONDITION_CLEARANCE_SUSPENDED'] },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: { actorUser: { select: { name: true } } },
  });
  const metadata =
    event?.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata)
      ? (event.metadata as Record<string, Prisma.JsonValue>)
      : {};
  const notes =
    metadata.notes && typeof metadata.notes === 'object' && !Array.isArray(metadata.notes)
      ? (metadata.notes as Record<string, Prisma.JsonValue>)
      : {};
  const flagged = 'flaggedAt' in approval ? Boolean(approval.flaggedAt) : approval.state === 'SUSPENDED';
  const resolutionEvent =
    !flagged && event
      ? await tx.auditEvent.findFirst({
          where: {
            entityId: target.approvalId,
            entityType: event.entityType,
            action: 'MEAL_APPROVAL_RECHECKED',
            createdAt: { gte: event.createdAt },
            metadata: { path: ['flagEventId'], equals: event.id },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        })
      : null;
  const resolutionData =
    resolutionEvent?.metadata &&
    typeof resolutionEvent.metadata === 'object' &&
    !Array.isArray(resolutionEvent.metadata)
      ? (resolutionEvent.metadata as Record<string, Prisma.JsonValue>)
      : {};
  const reason =
    'flagReason' in approval ? approval.flagReason : approval.suspensionReason?.replace(/^APPROVAL_FLAGGED:/, '');
  const priorReviewerId =
    'reviewerNutritionistId' in approval
      ? approval.reviewerNutritionistId
      : (approval.resolvedByNutritionistId ?? approval.decisions[0]?.nutritionistProfileId ?? null);
  const flaggerId = 'flaggedByNutritionistId' in approval ? approval.flaggedByNutritionistId : null;
  const state =
    'flaggedAt' in approval
      ? flagged
        ? 'FLAGGED'
        : approval.reviewDueAt <= new Date()
          ? 'REVIEW_DUE'
          : 'ACTIVE'
      : approval.state;
  const snapshot = {
    target: { kind: target.kind, mealLibraryId: target.mealLibraryId, approvalId: target.approvalId },
    meal,
    state,
    recipeSignature: approval.recipeSignature,
    evidenceRevision: approval.evidenceRevision,
    reviewedAt: 'approvedAt' in approval ? approval.approvedAt : approval.activatedAt,
    reviewDueAt: 'reviewDueAt' in approval ? approval.reviewDueAt : approval.auditDueAt,
    expiresAt: 'expiresAt' in approval ? approval.expiresAt : null,
    flaggedAt: 'flaggedAt' in approval ? approval.flaggedAt : approval.suspendedAt,
    reason,
    notes,
    eventId: event?.id ?? null,
    priorReviewerId,
    flaggerId,
  };
  return {
    expectedVersion: createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),
    state,
    flagged,
    matchesCurrentRecipe:
      approval.recipeSignature === meal.recipeSignature && approval.evidenceRevision === meal.safetyEvidenceRevision,
    blockedByRecipe: meal.status !== 'APPROVED',
    priorReviewerId,
    flaggerId,
    flaggerUserId: event?.actorUserId ?? null,
    flagEventId: event?.id ?? null,
    resolution:
      resolutionData.resolved === true && typeof resolutionData.rationale === 'string'
        ? resolutionData.rationale
        : undefined,
    concern: {
      id: target.approvalId,
      createdAt: event?.createdAt?.toISOString(),
      actorSnapshot: { name: event?.actorUser?.name },
      notes: {
        category: typeof notes.category === 'string' ? notes.category : 'Approval review',
        affectedFields: Array.isArray(notes.affectedFields)
          ? notes.affectedFields.filter((v): v is string => typeof v === 'string')
          : [],
        explanation:
          typeof notes.explanation === 'string'
            ? notes.explanation
            : reason || 'This approval is due for a fresh review.',
        reference: typeof notes.reference === 'string' ? notes.reference : undefined,
        proposedCorrection: typeof notes.proposedCorrection === 'string' ? notes.proposedCorrection : undefined,
      },
    },
  };
}
export function assertApprovalResolution(
  context: Awaited<ReturnType<typeof approvalRecheckContext>>,
  input: {
    expectedVersion?: string;
    resolved?: boolean;
    rationale: string;
  },
  actor: { id: string; userId: string }
) {
  if (input.resolved !== true || input.rationale.trim().length < 20 || input.rationale.trim().length > 1000)
    throw new AppError(
      'Explain how you resolved the concern, then mark it resolved.',
      422,
      'APPROVAL_RESOLUTION_REQUIRED'
    );
  if (!input.expectedVersion || input.expectedVersion !== context.expectedVersion)
    throw new AppError('The approval or flag changed. Reload its current evidence.', 409, 'APPROVAL_REVIEW_STALE');
  if (context.blockedByRecipe || !context.matchesCurrentRecipe)
    throw new AppError(
      'Resolve the current recipe evidence before reviewing this approval.',
      409,
      'APPROVAL_RECIPE_HELD'
    );
  if (!['FLAGGED', 'SUSPENDED', 'REVIEW_DUE'].includes(context.state))
    throw new AppError('This approval no longer needs recheck.', 409, 'APPROVAL_REVIEW_CLOSED');
  if (
    context.flagged &&
    ([context.priorReviewerId, context.flaggerId].includes(actor.id) || context.flaggerUserId === actor.userId)
  )
    throw new AppError('An uninvolved RND must resolve this flagged approval.', 403, 'APPROVAL_REVIEW_INDEPENDENCE');
}

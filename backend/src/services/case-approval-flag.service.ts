import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { env } from '@/config/env';
import { AppError } from '@/errors/AppError';
import { digest, json, reviewActor, currentReviewProfile } from './meal-review-context.service';
import { auditObject } from '@/domain/audit-details.policy';
import type { MealFlagSubmission } from '@/validation/meal-review.schemas';
import { getStartOfManilaBusinessDay, isActiveMealReviewPeriod } from '@/domain/meal-actionability.policy';
import { mealFlagSubmissionSchema } from '@/validation/meal-review.schemas';
import { getReviewClaimCutoff } from '@/domain/nutritionist-review.policy';

export async function caseApprovalFlagContext(tx: Prisma.TransactionClient, decisionId: string) {
  const decision = await tx.mealPlanReviewDecision.findUnique({ where: { id: decisionId }, include: {
    mealPlan: { select: { id: true, status: true, requiresSafetyRevalidation: true, baseRecipeSignature: true,
      composedServingSignature: true, reviewDecisions: { orderBy: { submittedAt: 'desc' }, take: 1, select: { id: true } } } },
  } });
  if (!decision || decision.decision !== 'APPROVE') throw new AppError('Approval not found.', 404, 'APPROVAL_NOT_FOUND');
  const event = await tx.auditEvent.findFirst({ where: { entityType: 'MealPlanReviewDecision', entityId: decision.id,
    action: { in: ['MEAL_APPROVAL_FLAGGED', 'MEAL_CASE_FLAG_RESOLVED'] } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  const flagged = event?.action === 'MEAL_APPROVAL_FLAGGED';
  return { decision, event, flagged,
    canFlag: env.CLINICAL_CLARIFICATIONS_ENABLED && !flagged && decision.mealPlan.status === 'APPROVED' && !decision.mealPlan.requiresSafetyRevalidation && decision.mealPlan.reviewDecisions[0]?.id === decision.id,
    expectedVersion: digest({ decisionId, meal: decision.mealPlan, eventId: event?.id ?? null }),
  };
}

/** Flags suspend this immutable decision and its exact reuse; they never withhold the whole recipe. */
export async function flagCaseApproval(userId: string, reviewerId: string, decisionId: string, input: MealFlagSubmission, db = prisma) {
  if (!env.CLINICAL_CLARIFICATIONS_ENABLED) throw new AppError('Case approval flagging is not enabled.', 503, 'FEATURE_UNAVAILABLE');
  input = mealFlagSubmissionSchema.parse(input);
  return db.$transaction(async tx => {
    await reviewActor(tx, userId, reviewerId);
    await tx.$queryRaw`SELECT id FROM "MealPlanReviewDecision" WHERE id = ${decisionId} FOR UPDATE`;
    const context = await caseApprovalFlagContext(tx, decisionId);
    if (context.expectedVersion !== input.expectedVersion) throw new AppError('This approval changed. Reopen its saved review.', 409, 'APPROVAL_REVIEW_STALE');
    if (!context.canFlag) throw new AppError('This approval is already flagged or superseded.', 409, 'APPROVAL_REVIEW_CLOSED');
    const references = await tx.mealReviewReference.findMany({ where: { decisionId }, select: { id: true } });
    const coalesced = await tx.mealPlanReviewDecision.findMany({ where: { decision: 'APPROVE',
      evidenceSnapshot: { path: ['coalescedFromMealPlanId'], equals: context.decision.mealPlanId } },
      select: { id: true, mealPlanId: true, mealPlan: { select: { reviewDecisions: { orderBy: { submittedAt: 'desc' }, take: 1, select: { id: true } } } } },
    });
    const coalescedIds = coalesced.filter(row => row.mealPlan.reviewDecisions[0]?.id === row.id).map(row => row.mealPlanId);
    const affected = await tx.mealPlan.findMany({ where: { status: 'APPROVED', OR: [
      { id: context.decision.mealPlanId }, { id: { in: coalescedIds } }, ...references.map(reference => ({ selectionEvidence: { path: ['exactApprovalReuse', 'referenceId'], equals: reference.id }, reviewDecisions: { none: {} } })),
    ] }, select: { id: true, userId: true } });
    await tx.mealPlan.updateMany({ where: { id: { in: affected.map(plan => plan.id) }, status: 'APPROVED' }, data: {
      status: 'PENDING_REVIEW', requiresSafetyRevalidation: true, reviewApprovalCount: 0, claimedByNutritionistId: null, claimedAt: null,
    } });
    await tx.groceryList.updateMany({ where: { userId: { in: [...new Set(affected.map(plan => plan.userId))] } }, data: { isStale: true } });
    await tx.notification.createMany({ data: [...new Set(affected.map(plan => plan.userId))].map(userId => ({
      userId, type: 'MEAL_FLAGGED' as const, title: 'Meal approval under review',
      message: 'An RND flagged a meal approval used in your plan. Affected meals need an independent review before use.',
    })) });
    await tx.auditEvent.create({ data: { actorUserId: userId, actorRole: 'NUTRITIONIST', action: 'MEAL_APPROVAL_FLAGGED',
      entityType: 'MealPlanReviewDecision', entityId: decisionId, metadata: {
        reviewDecisionId: decisionId, mealPlanId: context.decision.mealPlanId, notes: json(input.notes),
        originalReviewerId: context.decision.nutritionistProfileId, flaggerId: reviewerId, expectedVersion: input.expectedVersion,
        affectedPlanIds: affected.map(plan => plan.id),
      } } });
    return { affectedMeals: affected.length };
  }, { isolationLevel: 'Serializable', timeout: 30000 });
}

export async function activeCaseApprovalFlag(tx: Prisma.TransactionClient, planId: string) {
  const event = await tx.auditEvent.findFirst({ where: { entityType: 'MealPlanReviewDecision', action: 'MEAL_APPROVAL_FLAGGED',
    metadata: { path: ['affectedPlanIds'], array_contains: [planId] } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  const id = event?.entityId;
  if (!id) return null;
  const context = await caseApprovalFlagContext(tx, id);
  return context.flagged ? context : null;
}

export async function resolveCaseApprovalFlag(userId: string, reviewerId: string, decisionId: string,
  input: { mealPlanId: string; expectedVersion: string; rationale: string }, db = prisma) {
  if (!env.CLINICAL_CLARIFICATIONS_ENABLED) throw new AppError('Case approval flagging is not enabled.', 503, 'FEATURE_UNAVAILABLE');
  return db.$transaction(async tx => {
    await reviewActor(tx, userId, reviewerId);
    await tx.$queryRaw`SELECT id FROM "MealPlanReviewDecision" WHERE id = ${decisionId} FOR UPDATE`;
    const context = await activeCaseApprovalFlag(tx, input.mealPlanId);
    const metadata = auditObject(context?.event?.metadata);
    if (!context || context.decision.id !== decisionId || context.expectedVersion !== input.expectedVersion)
      throw new AppError('The flag changed. Reload the review.', 409, 'APPROVAL_REVIEW_STALE');
    if ([context.decision.nutritionistProfileId, metadata.flaggerId].includes(reviewerId))
      throw new AppError('An independent RND must resolve this approval.', 403, 'APPROVAL_REVIEW_INDEPENDENCE');
    const claim = await tx.mealPlan.findUnique({ where: { id: input.mealPlanId }, select: { claimedAt: true, claimedByNutritionistId: true, status: true, scheduledDate: true, supersededByMealPlanId: true,
      cycle: { select: { endDate: true, status: true, supersededById: true } } } });
    if (claim?.status !== 'PENDING_REVIEW' || claim.claimedByNutritionistId !== reviewerId || !claim.claimedAt || claim.claimedAt < getReviewClaimCutoff(new Date()))
      throw new AppError('Claim the current meal before resolving its flag.', 409, 'REVIEW_CLAIM_REQUIRED');
    if (!isActiveMealReviewPeriod(claim)) throw new AppError('This meal review is no longer current.', 409, 'MEAL_REVIEW_INACTIVE');
    if (input.rationale.trim().length < 20 || input.rationale.length > 3000) throw new AppError('Provide a resolution of 20 to 3000 characters.', 400, 'VALIDATION_ERROR');
    await tx.auditEvent.create({ data: { actorUserId: userId, actorRole: 'NUTRITIONIST', action: 'MEAL_CASE_FLAG_RESOLVED',
      entityType: 'MealPlanReviewDecision', entityId: decisionId, metadata: { flagEventId: context.event!.id,
        reviewDecisionId: decisionId, mealPlanId: input.mealPlanId, rationale: input.rationale } } });
    return { resolved: true };
  }, { isolationLevel: 'Serializable', timeout: 30000 });
}

export async function caseApprovalConcern(tx: Prisma.TransactionClient, planId: string) {
  const flag = await tx.auditEvent.findFirst({ where: { entityType: 'MealPlanReviewDecision', action: 'MEAL_APPROVAL_FLAGGED',
    metadata: { path: ['affectedPlanIds'], array_contains: [planId] } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
  if (!flag?.entityId) return [];
  const context = await caseApprovalFlagContext(tx, flag.entityId);
  const metadata = auditObject(flag.metadata);
  const notes = auditObject(metadata.notes);
  return [{ kind: 'CASE' as const, mealLibraryId: null, approvalId: context.decision.id, id: context.decision.id,
    active: context.flagged, expectedVersion: context.expectedVersion, createdAt: flag.createdAt.toISOString(),
    ...(!context.flagged ? { resolution: String(auditObject(context.event?.metadata).rationale ?? 'Resolution recorded') } : {}),
    notes: { category: String(notes.category ?? 'EVIDENCE'), explanation: String(notes.explanation ?? 'Recorded approval concern'),
      reference: typeof notes.reference === 'string' ? notes.reference : undefined,
      proposedCorrection: typeof notes.proposedCorrection === 'string' ? notes.proposedCorrection : undefined,
      affectedFields: Array.isArray(notes.affectedFields) ? notes.affectedFields.filter((value): value is string => typeof value === 'string') : [] },
  }];
}

export async function listCaseApprovalFlags(reviewerId: string, db = prisma) {
  if (!env.CLINICAL_CLARIFICATIONS_ENABLED) return [];
  if (!await currentReviewProfile(db, reviewerId)) throw new AppError('An eligible RND is required.', 403, 'REVIEWER_INELIGIBLE');
  const start = getStartOfManilaBusinessDay();
  return db.$queryRaw<Array<{ id: string; mealPlanId: string; mealName: string; explanation: string }>>`
    SELECT e.id, p.id AS "mealPlanId", COALESCE(d."evidenceSnapshot"->>'mealName', p."mealName") AS "mealName",
      e.metadata->'notes'->>'explanation' AS explanation
    FROM "AuditEvent" e JOIN "MealPlanReviewDecision" d ON d.id = e."entityId"
    JOIN LATERAL (
      SELECT candidate.id, candidate."mealName" FROM "MealPlan" candidate JOIN "MealPlanCycle" cycle ON cycle.id = candidate."planGroupId"
      WHERE e.metadata->'affectedPlanIds' ? candidate.id AND candidate.status = 'PENDING_REVIEW'
        AND candidate."scheduledDate" >= ${start} AND cycle."endDate" >= ${start}
        AND candidate."supersededByMealPlanId" IS NULL AND cycle."supersededById" IS NULL
        AND cycle.status NOT IN ('COMPLETED', 'SUPERSEDED')
      ORDER BY (candidate.id = d."mealPlanId") DESC, candidate."scheduledDate", candidate.id LIMIT 1
    ) p ON TRUE
    WHERE e."entityType" = 'MealPlanReviewDecision' AND e.action = 'MEAL_APPROVAL_FLAGGED'
      AND NOT EXISTS (SELECT 1 FROM "AuditEvent" later WHERE later."entityType" = e."entityType" AND later."entityId" = e."entityId"
        AND later.action IN ('MEAL_APPROVAL_FLAGGED', 'MEAL_CASE_FLAG_RESOLVED') AND (later."createdAt", later.id) > (e."createdAt", e.id))
    ORDER BY e."createdAt" DESC, e.id DESC LIMIT 100`;
}

import { Prisma } from '@prisma/client';
import { env } from '@/config/env';
import { getStartOfManilaBusinessDay } from '@/domain/meal-actionability.policy';

/** The caller holds the member lock. Preserve meal rows, decisions and consumed logs. */
export async function withdrawOutdatedMealReviews(
  tx: Prisma.TransactionClient,
  userId: string,
  profileRevision: number
) {
  if (!env.CLINICAL_CLARIFICATIONS_ENABLED) return;
  const pending = await tx.mealPlan.findMany({
    where: {
      userId,
      status: { in: ['PENDING_REVIEW', 'APPROVED'] },
      scheduledDate: { gte: getStartOfManilaBusinessDay() },
      supersededByMealPlanId: null,
      cycle: { supersededById: null, status: { notIn: ['SUPERSEDED', 'COMPLETED'] } },
      mealLogs: { none: { status: { in: ['DONE', 'SKIPPED'] } } },
    },
    select: {
      id: true,
      status: true,
      planGroupId: true,
      cycle: { select: { snapshot: { select: { profileRevision: true } } } },
    },
  });
  // A second edit can arrive after the first withdrew every untouched slot.
  // Those cycles still need the latest revision, even with no pending rows left.
  const waiting = await tx.mealPlanCycle.findMany({
    where: {
      userId,
      endDate: { gte: getStartOfManilaBusinessDay() },
      supersededById: null,
      status: { notIn: ['SUPERSEDED', 'COMPLETED'] },
      profileAdaptationState: {
        in: ['AWAITING_REPORT_ACKNOWLEDGMENT', 'REBUILD_REQUIRED', 'SAFETY_REVALIDATION_REQUIRED'],
      },
    },
    select: { id: true },
  });
  const cycleIds = [...new Set([...pending.map((row) => row.planGroupId), ...waiting.map((row) => row.id)])];
  if (!cycleIds.length) return;
  if (pending.length) {
    await tx.mealPlan.updateMany({
      where: { id: { in: pending.map((row) => row.id) } },
      data: { status: 'CANCELLED', claimedByNutritionistId: null, claimedAt: null },
    });
    await tx.auditEvent.createMany({
      data: pending.map((row) => ({
        actorUserId: userId,
        action: 'MEAL_REVIEW_REQUEST_WITHDRAWN',
        entityType: 'MealPlan',
        entityId: row.id,
        metadata: {
          reasonCode: 'PROFILE_REVISION_CHANGED',
          profileRevision,
          originalCycleProfileRevision: row.cycle.snapshot?.profileRevision ?? null,
          previousStatus: row.status,
        },
      })),
    });
  }
  await tx.mealPlanCycle.updateMany({
    where: { id: { in: cycleIds } },
    data: {
      status: 'REVALIDATION_REQUIRED',
      profileAdaptationState: 'AWAITING_REPORT_ACKNOWLEDGMENT',
      requestedProfileRevision: profileRevision,
      acknowledgedProfileRevision: null,
      // A replacement of an already admitted safety-sensitive plan retains its repair allowance.
      pendingProfileChangeKinds: ['SAFETY'],
    },
  });
  await tx.groceryList.updateMany({ where: { planGroupId: { in: cycleIds } }, data: { isStale: true } });
}

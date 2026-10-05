import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { getManilaMidnight, getManilaDateKey } from '@/domain/meal-plan-cycle.policy';

function emptyRetryWhere(userId: string, cycleId: string, now = new Date()): Prisma.MealPlanCycleWhereInput {
  return {
    id: cycleId,
    userId,
    status: { notIn: ['SUPERSEDED', 'COMPLETED', 'REVALIDATION_REQUIRED'] },
    endDate: { gte: getManilaMidnight(getManilaDateKey(now)) },
    shoppingStartedAt: null,
    incompleteAcknowledgedAt: null,
    profileAdaptationState: 'CURRENT',
    // Include cancelled/rejected history: this recovery never replaces a saved meal.
    mealPlans: { none: {} },
  };
}

/** Re-source a failed, completely empty episode. Ordinary whole-plan replacement stays disabled. */
export async function emptyFailedPlanWindow(userId: string, cycleId: string) {
  const cycle = await prisma.mealPlanCycle.findFirst({
    where: emptyRetryWhere(userId, cycleId),
    include: { snapshot: true },
  });
  if (!cycle?.snapshot || cycle.expectedSlotCount < 3 || cycle.expectedSlotCount % 3) return null;
  const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId } });
  if (profile.revision !== cycle.snapshot.profileRevision || profile.safetyRevision !== cycle.snapshot.safetyRevision)
    return null;
  const failed = await prisma.mealPlanGenerationJob.findFirst({
    where: { userId, planGroupId: cycleId, status: 'FAILED' },
    select: { id: true },
  });
  return failed ? { planType: cycle.planType, startDate: cycle.startDate, numDays: cycle.expectedSlotCount / 3 } : null;
}

/** Recheck under the generation profile lock, before any existing cycle is superseded. */
export async function assertEmptyPlanRetry(
  tx: Prisma.TransactionClient,
  userId: string,
  cycleId: string,
  profileRevision: number,
  safetyRevision: number
) {
  const cycle = await tx.mealPlanCycle.findFirst({
    where: { ...emptyRetryWhere(userId, cycleId), snapshot: { profileRevision, safetyRevision } },
    select: { id: true },
  });
  if (!cycle)
    throw new AppError('This cycle changed during retry. Refresh its current meals.', 409, 'EMPTY_PLAN_RETRY_CHANGED');
}

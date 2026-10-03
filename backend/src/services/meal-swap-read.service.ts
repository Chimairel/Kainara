import { MealPlanCycleStatus, ProfileCycleAdaptationState, type Prisma } from '@prisma/client';
import { getOwnedMealPlanWhere, assertUserSwappableMealPlan } from '@/domain/meal-actionability.policy';
import { MealPlanCycleService } from './meal-plan-cycle.service';

export async function loadActionableUnloggedMealPlan(
  client: Pick<Prisma.TransactionClient, 'mealPlan' | 'mealPlanCycle'>,
  userId: string,
  mealPlanId: string
) {
  const mealPlan = await client.mealPlan.findFirst({
    where: getOwnedMealPlanWhere(userId, mealPlanId),
    include: { mealLogs: { where: { userId } }, cycle: true },
  });
  if (!mealPlan) throw new Error('Meal plan slot not found.');
  assertUserSwappableMealPlan(mealPlan);
  const clearedIds = await MealPlanCycleService.getClearedMealPlanIds(userId, mealPlan.planGroupId, new Date(), client);
  if (!clearedIds.includes(mealPlan.id))
    throw new Error('This meal needs safety revalidation before it can be swapped.');
  if (mealPlan.mealLogs.some((log) => log.status === 'DONE' || log.status === 'SKIPPED'))
    throw new Error('Cannot swap a meal that has already been eaten or skipped.');
  if (mealPlan.cycle.profileAdaptationState !== ProfileCycleAdaptationState.CURRENT)
    throw new Error('This plan is waiting for profile review or safety revalidation.');
  if (
    [MealPlanCycleStatus.COMPLETED, MealPlanCycleStatus.SUPERSEDED, MealPlanCycleStatus.REVALIDATION_REQUIRED].some(
      (status) => status === mealPlan.cycle.status
    )
  )
    throw new Error('This plan cycle is not open for meal swaps.');
  return mealPlan;
}

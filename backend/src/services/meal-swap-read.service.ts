import { MealPlanCycleStatus, ProfileCycleAdaptationState, type Prisma } from '@prisma/client';
import { getOwnedMealPlanWhere, assertUserSwappableMealPlan } from '@/domain/meal-actionability.policy';
import { AppError } from '@/errors/AppError';
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
  if (!mealPlan) throw new AppError('Meal plan slot not found.', 404, 'MEAL_PLAN_NOT_FOUND');
  assertUserSwappableMealPlan(mealPlan);
  const clearedIds = await MealPlanCycleService.getClearedMealPlanIds(userId, mealPlan.planGroupId, new Date(), client);
  if (!clearedIds.includes(mealPlan.id))
    throw new AppError(
      'This meal needs safety revalidation before it can be swapped.',
      409,
      'MEAL_SAFETY_REVALIDATION_REQUIRED'
    );
  if (mealPlan.mealLogs.some((log) => log.status === 'DONE' || log.status === 'SKIPPED'))
    throw new AppError('Cannot swap a meal that has already been eaten or skipped.', 409, 'MEAL_ALREADY_LOGGED');
  if (mealPlan.cycle.profileAdaptationState !== ProfileCycleAdaptationState.CURRENT)
    throw new AppError(
      'This plan is waiting for profile review or safety revalidation.',
      409,
      'PLAN_REVALIDATION_REQUIRED'
    );
  if (
    [MealPlanCycleStatus.COMPLETED, MealPlanCycleStatus.SUPERSEDED, MealPlanCycleStatus.REVALIDATION_REQUIRED].some(
      (status) => status === mealPlan.cycle.status
    )
  )
    throw new AppError('This plan cycle is not open for meal swaps.', 409, 'PLAN_NOT_OPEN_FOR_SWAP');
  return mealPlan;
}

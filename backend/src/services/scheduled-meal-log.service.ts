import { assertUserLoggableMealPlan, getOwnedMealPlanWhere } from '@/domain/meal-actionability.policy';
import prisma from '@/lib/prisma';
import { MealLogDataSource, MealLogSource, MealLogStatus } from '@prisma/client';
import { MealPlanCycleService } from './meal-plan-cycle.service';
import { lockUserProfile } from './profile-revision.service';
import { AppError } from '@/errors/AppError';
import { setMealLogAuditContext } from './meal-log-audit-context.service';
import { recalculateDailyNutritionLog } from './meal-swap-nutrition.service';

/** Keep ownership, profile locking, clearance and log writes in one transaction. */
export async function updateScheduledMealStatus(
  userId: string,
  mealPlanId: string,
  status: MealLogStatus,
  notes?: string | null
) {
  return prisma.$transaction(async (tx) => {
    await lockUserProfile(tx, userId);
    // Find the MealPlan item to fetch macros
    const mealPlan = await tx.mealPlan.findFirst({
      where: getOwnedMealPlanWhere(userId, mealPlanId),
    });

    if (!mealPlan) {
      throw new AppError('Meal plan item not found.', 404, 'MEAL_PLAN_NOT_FOUND');
    }

    assertUserLoggableMealPlan(mealPlan);
    const clearedIds = await MealPlanCycleService.getClearedMealPlanIds(userId, mealPlan.planGroupId, new Date(), tx);
    if (!clearedIds.includes(mealPlan.id)) {
      throw new AppError(
        'This meal needs safety revalidation before it can be logged.',
        409,
        'MEAL_SAFETY_REVALIDATION_REQUIRED'
      );
    }

    await setMealLogAuditContext(tx, userId, 'Member recorded scheduled meal status');
    const log = await tx.mealLog.upsert({
      where: { mealPlanId },
      update: {
        status: status as MealLogStatus,
        loggedAt: mealPlan.scheduledDate,
        ...(mealPlan.mealType ? { mealType: mealPlan.mealType } : {}),
        ...(notes !== undefined ? { notes: notes ?? null } : {}),
      },
      create: {
        userId,
        mealPlanId,
        source: MealLogSource.SYSTEM_GENERATED,
        mealName: mealPlan.mealName,
        calories: mealPlan.calories,
        proteinG: mealPlan.proteinG,
        carbsG: mealPlan.carbsG,
        fatG: mealPlan.fatG,
        dataSource: MealLogDataSource.FNRI, // Plan meals are FNRI validated
        status: status as MealLogStatus,
        warningType: null,
        warningShown: false,
        warningAcknowledged: false,
        notes: notes ?? null,
        mealType: mealPlan.mealType,
        loggedAt: mealPlan.scheduledDate,
      },
    });
    await recalculateDailyNutritionLog(userId, mealPlan.scheduledDate, tx);
    return log;
  });
}

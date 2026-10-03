import type { Prisma, MealPlanCycleSnapshot } from '@prisma/client';
import { getManilaDateKey, getManilaMidnight } from '@/domain/meal-plan-cycle.policy';
import { filterUserActionableMealPlans, getApprovedMealPlanStatusWhere } from '@/domain/meal-actionability.policy';
import {
  calculatePlanningMacroTargets,
  reportPlanningMacroTargets,
  mealMacroBudget,
  addNutrition,
  zeroNutrition,
  describeDayNutrition,
  type NutritionVector,
  type PlanningMacroTargets,
  MEAL_MACRO_POLICY_VERSION,
} from '@/domain/meal-macro-target.policy';
import { describeSwapNutritionMatch, swapNutritionFitScore } from '@/domain/swap-nutrition-fit.policy';

export async function cycleMacroTargets(
  client: Pick<Prisma.TransactionClient, 'nutritionReportVersion'>,
  snapshot: MealPlanCycleSnapshot | null,
  fallback: PlanningMacroTargets | null
) {
  if (!snapshot) return fallback;
  const saved = Object.values((snapshot.dailyMacroTargets as Record<string, PlanningMacroTargets>) ?? {}).find(
    (value) => value?.policyVersion === MEAL_MACRO_POLICY_VERSION
  );
  if (saved) return saved;
  const report = snapshot.nutritionReportVersion
    ? await client.nutritionReportVersion.findFirst({
        where: { userId: snapshot.userId, version: snapshot.nutritionReportVersion, acknowledgedAt: { not: null } },
      })
    : null;
  // Old snapshot totals were selected meals, not targets. Derive from its immutable report instead.
  return reportPlanningMacroTargets(report) ?? calculatePlanningMacroTargets({ ...snapshot, restricted: true });
}

export function dailyTargetMap(dates: readonly Date[], target: PlanningMacroTargets | null, previous?: unknown) {
  const priorDates =
    previous && typeof previous === 'object'
      ? Object.keys(previous)
          .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key))
          .map(getManilaMidnight)
      : [];
  return Object.fromEntries(
    [...priorDates, ...dates].map((date) => [getManilaDateKey(date), target ?? zeroNutrition()])
  );
}

export async function publicCycleSnapshot(
  client: Prisma.TransactionClient,
  snapshot: MealPlanCycleSnapshot | null,
  dates: readonly Date[]
) {
  if (!snapshot) return null;
  const targets = await cycleMacroTargets(client, snapshot, null);
  return { ...snapshot, dailyMacroTargets: dailyTargetMap(dates, targets, snapshot.dailyMacroTargets) };
}

export async function swapMacroContext(
  client: Prisma.TransactionClient,
  userId: string,
  slot: { id: string; planGroupId: string; scheduledDate: Date; mealType: string },
  fallback: PlanningMacroTargets | null
) {
  const [snapshot, rows] = await Promise.all([
    client.mealPlanCycleSnapshot.findUnique({ where: { planGroupId: slot.planGroupId } }),
    client.mealPlan.findMany({ where: { userId, planGroupId: slot.planGroupId, ...getApprovedMealPlanStatusWhere() } }),
  ]);
  const target = await cycleMacroTargets(client, snapshot, fallback);
  const dayMeals = filterUserActionableMealPlans(rows).filter(
    (m) => getManilaDateKey(m.scheduledDate) === getManilaDateKey(slot.scheduledDate)
  );
  const otherMeals = dayMeals.filter((m) => m.id !== slot.id);
  const before = dayMeals.reduce(addNutrition, zeroNutrition());
  const remaining = otherMeals.reduce(addNutrition, zeroNutrition());
  const completeDay = ['BREAKFAST', 'LUNCH', 'DINNER'].every((type) => dayMeals.some((m) => m.mealType === type));
  const budget = mealMacroBudget(target, slot.mealType, otherMeals);
  // Compare every serving combination and the final list by the same objective.
  // Missing meals use the allocated slot budget, not a fictitious full-day deficit.
  const scoreReplacement = (replacement: NutritionVector) =>
    target
      ? completeDay
        ? swapNutritionFitScore(addNutrition(remaining, replacement), target)
        : budget
          ? swapNutritionFitScore(replacement, budget)
          : 0
      : 0;
  return {
    target,
    dayMeals,
    budget,
    scoreReplacement,
    analyze: (replacement: NutritionVector) => {
      const after = addNutrition(remaining, replacement);
      return {
        ...describeDayNutrition(before, after, target, completeDay),
        ...describeSwapNutritionMatch({ before, after, target, completeDay }),
        fitScore: scoreReplacement(replacement),
      };
    },
  };
}

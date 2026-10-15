import { getMealSlotCalorieRange, isPrimaryMealType, PRIMARY_MEAL_CALORIE_SHARES } from './meal-calorie-allocation.policy';
import { addNutrition, zeroNutrition, type NutritionVector } from './meal-macro-target.policy';

type Reference = { nutrient: string; value: string };
/** Allocate recorded daily ranges only; never derive a clinical threshold from the planning point. */
export function allocatedReviewRanges(guidance: readonly Reference[], mealType: string, calories?: number) {
  const share = isPrimaryMealType(mealType) ? PRIMARY_MEAL_CALORIE_SHARES[mealType] : null;
  const ranges: Partial<Record<'proteinG' | 'carbsG' | 'fatG', {
    minimum: number; maximum: number; dailyMinimum: number; dailyMaximum: number;
  }>> = {};
  if (share !== null) for (const nutrient of ['proteinG', 'carbsG', 'fatG'] as const) {
    const match = guidance.find(item => item.nutrient === nutrient)?.value.match(/^\s*(\d+(?:\.\d+)?)\s*[–−-]\s*(\d+(?:\.\d+)?)\s*g\s*\/\s*day\s*$/i);
    if (!match) continue;
    const minimum = Number(match[1]), maximum = Number(match[2]);
    if (![minimum, maximum].every(Number.isFinite) || minimum > maximum) continue;
    ranges[nutrient] = { minimum: minimum * share, maximum: maximum * share, dailyMinimum: minimum, dailyMaximum: maximum };
  }
  return {
    mealShare: share,
    ranges,
    mealEnergyRange: share !== null && calories && Number.isFinite(calories) && calories > 0 && isPrimaryMealType(mealType)
      ? getMealSlotCalorieRange(calories, mealType) : null,
  };
}

/** Plan totals, not consumed intake. Missing/competing slots must not look like a complete day. */
export function reviewPlannedDay(current: { id: string; mealType: string }, rows: readonly (NutritionVector & {
  id: string; mealType: string; status: string; supersededByMealPlanId: string | null;
})[]) {
  const active = rows.filter(row => row.id !== current.id && row.supersededByMealPlanId === null &&
    ['APPROVED', 'PENDING_REVIEW'].includes(row.status) && isPrimaryMealType(row.mealType));
  const expected = Object.keys(PRIMARY_MEAL_CALORIE_SHARES).filter(type => type !== current.mealType);
  const missing = expected.filter(type => !active.some(row => row.mealType === type));
  const ambiguous = active.some(row => row.mealType === current.mealType) ||
    expected.some(type => active.filter(row => row.mealType === type).length > 1);
  const valid = active.every(row => [row.calories, row.proteinG, row.carbsG, row.fatG].every(value => Number.isFinite(value) && value >= 0));
  return {
    otherTotals: !ambiguous && valid ? active.reduce(addNutrition, zeroNutrition()) : null,
    complete: isPrimaryMealType(current.mealType) && !missing.length && !ambiguous && valid,
    missingMealTypes: missing,
    ambiguous,
  };
}

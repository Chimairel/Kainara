import {
  getMealSlotCalorieRange,
  isPrimaryMealType,
  PRIMARY_MEAL_CALORIE_SHARES,
} from './meal-calorie-allocation.policy';

export const MEAL_MACRO_POLICY_VERSION = 'MEAL_MACRO_PLANNING_V1';
export type NutritionVector = { calories: number; proteinG: number; carbsG: number; fatG: number };
export type PlanningMacroTargets = NutritionVector & {
  policyVersion: typeof MEAL_MACRO_POLICY_VERSION;
  basis: 'GENERAL_ADULT_ESTIMATE' | 'MUSCLE_BUILDING_ESTIMATE' | 'REVIEW_REFERENCE';
  goal: string;
  explanation: string;
};
export const zeroNutrition = (): NutritionVector => ({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
export function addNutrition(a: NutritionVector, b: NutritionVector): NutritionVector {
  return {
    calories: a.calories + b.calories,
    proteinG: a.proteinG + b.proteinG,
    carbsG: a.carbsG + b.carbsG,
    fatG: a.fatG + b.fatG,
  };
}

/** Planning estimates, not clinical prescriptions or a substitute for case clearance.
 * General point lies inside the adult PDRI reference ranges. Muscle protein uses
 * Morton et al. (2018), https://pubmed.ncbi.nlm.nih.gov/28698222/, for healthy adults
 * undertaking resistance exercise. Never apply that target to a medical profile.
 */
export function calculatePlanningMacroTargets(input: {
  dailyCalorieTarget?: number | null;
  weightKg?: number | null;
  goal?: string | null;
  age?: number | null;
  restricted?: boolean;
}): PlanningMacroTargets | null {
  const calories = input.dailyCalorieTarget;
  if (!calories || !Number.isFinite(calories) || calories <= 0) return null;
  const muscle =
    input.goal === 'BUILD_MUSCLE' &&
    !input.restricted &&
    (input.age ?? 0) >= 19 &&
    Boolean(input.weightKg && Number.isFinite(input.weightKg) && input.weightKg > 0);
  const muscleProtein = (input.weightKg ?? 0) * 1.6;
  // Do not manufacture a high-protein prescription when the calorie budget cannot accommodate it.
  const useMuscle = muscle && muscleProtein * 4 <= calories * 0.35;
  const proteinG = useMuscle ? muscleProtein : (calories * 0.125) / 4;
  const fatG = (calories * 0.25) / 9;
  const review = input.restricted || (input.age ?? 0) < 19 || (muscle && !useMuscle);
  return {
    calories,
    proteinG,
    fatG,
    carbsG: (calories - proteinG * 4 - fatG * 9) / 4,
    policyVersion: MEAL_MACRO_POLICY_VERSION,
    goal: input.goal ?? 'MAINTAIN',
    basis: review ? 'REVIEW_REFERENCE' : useMuscle ? 'MUSCLE_BUILDING_ESTIMATE' : 'GENERAL_ADULT_ESTIMATE',
    explanation: review
      ? 'Reference for balancing meals; individual medical or age-specific targets require nutritionist review. Existing review requirements still apply.'
      : useMuscle
        ? 'Estimated target for a healthy adult building muscle with resistance exercise: 1.6 g protein per kg, with balanced carbohydrate and fat. This is not a medical prescription.'
        : 'Estimated planning point within adult reference ranges: 12.5% protein, 25% fat and 62.5% carbohydrate. This is not a medical prescription.',
  };
}

export function reportPlanningMacroTargets(version: { profileSnapshot: unknown; content?: unknown } | null) {
  const snapshot = version?.profileSnapshot as Record<string, unknown> | undefined;
  const content = version?.content as Record<string, unknown> | undefined;
  const saved = (snapshot?.planningTargets ?? content?.planningTargets) as PlanningMacroTargets | undefined;
  if (
    saved?.policyVersion === MEAL_MACRO_POLICY_VERSION &&
    [saved.calories, saved.proteinG, saved.carbsG, saved.fatG].every((n) => Number.isFinite(n) && n >= 0)
  )
    return saved;
  const profile = snapshot?.profile as Parameters<typeof calculatePlanningMacroTargets>[0] | undefined;
  if (!profile) return null;
  const conditions = snapshot?.conditions as string[] | undefined;
  const otherConditions = snapshot?.otherConditions;
  const customCondition = Array.isArray(otherConditions)
    ? otherConditions.some((c) => typeof c === 'string' && c.trim() && c !== 'NONE')
    : typeof otherConditions === 'string' && Boolean(otherConditions.trim());
  return calculatePlanningMacroTargets({
    ...profile,
    restricted: Boolean(conditions?.some((c) => c !== 'NONE') || customCondition),
  });
}

/** Lower is better. Calories and all three macros contribute, rather than macros breaking calorie ties. */
export function nutritionFitScore(actual: NutritionVector, target: NutritionVector & { goal?: string }): number {
  const relative = (value: number, desired: number, floor: number) =>
    Math.abs(value - desired) / Math.max(desired, floor);
  const proteinWeight = target.goal === 'BUILD_MUSCLE' ? 3 : 1.5;
  return (
    relative(actual.calories, target.calories, 100) * 2 +
    relative(actual.proteinG, target.proteinG, 5) * proteinWeight +
    relative(actual.carbsG, target.carbsG, 10) +
    relative(actual.fatG, target.fatG, 5)
  );
}

export function mealMacroBudget(
  target: PlanningMacroTargets | null,
  mealType: string,
  otherMeals: readonly (NutritionVector & { mealType: string })[] = []
) {
  if (!target || !isPrimaryMealType(mealType)) return undefined;
  const share = PRIMARY_MEAL_CALORIE_SHARES;
  const selectedShare = otherMeals.reduce(
    (sum, meal) => sum + (isPrimaryMealType(meal.mealType) ? share[meal.mealType] : 0),
    0
  );
  const fraction = share[mealType] / Math.max(share[mealType], 1 - selectedShare);
  const consumed = otherMeals.reduce(addNutrition, zeroNutrition());
  return {
    calories: getMealSlotCalorieRange(target.calories, mealType).target,
    proteinG: Math.max(0, target.proteinG - consumed.proteinG) * fraction,
    carbsG: Math.max(0, target.carbsG - consumed.carbsG) * fraction,
    fatG: Math.max(0, target.fatG - consumed.fatG) * fraction,
    goal: target.goal,
  };
}

export function describeDayNutrition(
  before: NutritionVector,
  after: NutritionVector,
  target: PlanningMacroTargets | null,
  completeDay: boolean
) {
  const warnings: string[] = [];
  if (target && completeDay) {
    // A display tolerance, never a clinical clearance or reason to falsify source nutrition.
    for (const [field, name] of [
      ['proteinG', 'Protein'],
      ['carbsG', 'Carbohydrate'],
      ['fatG', 'Fat'],
    ] as const) {
      if (after[field] < target[field] * 0.8) warnings.push(`${name} is below the daily planning estimate.`);
      if (after[field] > target[field] * 1.2) warnings.push(`${name} is above the daily planning estimate.`);
    }
  }
  return { before, after, target, completeDay, warnings, fitScore: target ? nutritionFitScore(after, target) : 0 };
}

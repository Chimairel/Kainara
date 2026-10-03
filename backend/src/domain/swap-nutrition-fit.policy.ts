import type { NutritionVector, PlanningMacroTargets } from './meal-macro-target.policy';

// Planning/display tolerances, never clinical clearance or swap admission rules.
export const SWAP_MACRO_DISPLAY_TOLERANCE = 0.2;
const macroFields = ['proteinG', 'carbsG', 'fatG'] as const;
export type SwapNutritionMatch = 'CLOSE' | 'GAPS_REMAIN' | 'PARTIAL_DAY' | 'UNAVAILABLE';

/** Lower is better. Prefer all-macro fits; penalize large excesses AND shortfalls.
 * Normalize against the report day, so a zero remaining budget cannot dominate
 * the other nutrients through a tiny denominator. */
export function swapNutritionFitScore(actual: NutritionVector, target: NutritionVector & { goal?: string }) {
  const relative = (field: keyof NutritionVector, floor: number) =>
    Math.abs(actual[field] - target[field]) / Math.max(target[field], floor);
  const errors = [relative('proteinG', 5), relative('carbsG', 10), relative('fatG', 5)];
  const loss = (error: number) => error + 4 * Math.max(0, error - SWAP_MACRO_DISPLAY_TOLERANCE) ** 2;
  const proteinWeight = target.goal === 'BUILD_MUSCLE' ? 3 : 1.5;
  return (
    (errors.some((error) => error > SWAP_MACRO_DISPLAY_TOLERANCE) ? 10 : 0) +
    2 * loss(relative('calories', 100)) +
    proteinWeight * loss(errors[0]) +
    loss(errors[1]) +
    loss(errors[2])
  );
}

export function describeSwapNutritionMatch(input: {
  before: NutritionVector;
  after: NutritionVector;
  target: PlanningMacroTargets | null;
  completeDay: boolean;
}) {
  const { before, after, target, completeDay } = input;
  const nutritionMatch: SwapNutritionMatch = !target
    ? 'UNAVAILABLE'
    : !completeDay
      ? 'PARTIAL_DAY'
      : macroFields.every(
            (field) =>
              Math.abs(after[field] - target[field]) <=
              Math.max(target[field], field === 'carbsG' ? 10 : 5) * SWAP_MACRO_DISPLAY_TOLERANCE
          )
        ? 'CLOSE'
        : 'GAPS_REMAIN';
  const macroChanges =
    target && completeDay
      ? macroFields.map((field) => {
          const beforeGap = Math.abs(before[field] - target[field]);
          const afterGap = Math.abs(after[field] - target[field]);
          return {
            nutrient: field,
            direction:
              Math.abs(afterGap - beforeGap) < 0.01
                ? ('UNCHANGED' as const)
                : afterGap < beforeGap
                  ? ('CLOSER' as const)
                  : ('FURTHER' as const),
            status:
              Math.abs(after[field] - target[field]) <=
              Math.max(target[field], field === 'carbsG' ? 10 : 5) * SWAP_MACRO_DISPLAY_TOLERANCE
                ? ('WITHIN_ESTIMATE' as const)
                : after[field] > target[field]
                  ? ('ABOVE' as const)
                  : ('BELOW' as const),
          };
        })
      : [];
  return { nutritionMatch, macroChanges };
}

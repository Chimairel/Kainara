/** Existing app standard: one approximate cup is a 150 g cooked-rice serving.
 * Nutrition comes from the selected food record, never a fixed calorie guess.
 * This is an app household estimate, not a universal density conversion.
 */
export const COOKED_RICE_HALF_CUP_GRAMS = 75;
export function ricePortionLabel(grams: number): string {
  const cups = grams / (COOKED_RICE_HALF_CUP_GRAMS * 2);
  const label = cups === 0.5 ? '½' : cups === 1.5 ? '1½' : String(cups);
  return `${label} cup${cups > 1 ? 's' : ''} cooked rice (${grams} g)`;
}

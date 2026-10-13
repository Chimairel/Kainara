import { classifyMealIngredients, type IngredientClassificationInput } from './meal-ingredient-classification.policy';

/** Ingredient exclusions only, never a diagnosis or allergen clearance. */
export const FOOD_EXCLUSION_POLICY_VERSION = 'NAMED_FOOD_EXCLUSIONS_V1';
const patterns = {
  PORK: /\b(?:pork|baboy|liempo|lechon|bacon|ham|lard|chicharr?on|longgani[sz]a)\b/u,
  BEEF: /\b(?:beef|baka|veal|bovine|carabeef|tallow)\b/u,
} as const;
export type FoodExclusionKey = keyof typeof patterns;
export function foodExclusionKey(value: unknown): FoodExclusionKey | null {
  if (typeof value !== 'string') return null;
  const text = value.normalize('NFKC').trim().toLowerCase();
  if (['pork', 'baboy'].includes(text)) return 'PORK';
  if (['beef', 'baka'].includes(text)) return 'BEEF';
  return null;
}
export function isDeterministicAvoidedFood(entry: {
  domain?: unknown;
  canonicalCode?: unknown;
  supportState?: unknown;
}) {
  return (
    entry.domain === 'AVOIDED_INGREDIENT' &&
    ['SUPPORTED', 'RECOGNIZED_UNSUPPORTED'].includes(String(entry.supportState)) &&
    foodExclusionKey(entry.canonicalCode) !== null
  );
}
export function screenFoodExclusions(
  ingredients: readonly IngredientClassificationInput[],
  exclusions: readonly string[]
) {
  const keys = [...new Set(exclusions.map(foodExclusionKey).filter((key): key is FoodExclusionKey => key !== null))];
  if (!keys.length) return { conflicts: [] as string[], complete: true };
  const texts = ingredients.map((i) => `${i.name} ${i.compositionFoodName ?? ''}`.normalize('NFKC').toLowerCase());
  const conflicts = keys.filter((key) => texts.some((text) => patterns[key].test(text)));
  // An unspecified animal source cannot establish absence of pork or beef.
  const ambiguous = texts.some(
    (text) =>
      /\b(?:meat|sausage|hot ?dogs?|gelatin|stock|broth|bouillon|luncheon)\b/u.test(text) &&
      !/\b(?:pork|baboy|beef|baka|chicken|turkey|fish|vegetable|vegan|plant based)\b/u.test(text)
  );
  return {
    conflicts,
    complete: ingredients.length > 0 && !ambiguous && classifyMealIngredients(ingredients).status === 'COMPLETE',
  };
}

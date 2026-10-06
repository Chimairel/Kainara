/** Source-backed discrepancies are held for review, not replaced with invented nutrient values. */
const holds: Readonly<Record<string, string>> = {
  'https://panlasangpinoy.com/tortilla-espanola-potato-omelet-recipe/':
    'Source publishes 968 kcal, 1 g protein and 108 g fat despite eggs/potatoes and drained frying oil. Retain source values; independent nutrition review required.',
  'https://panlasangpinoy.com/shrimp-and-vegetable-fried-rice/':
    'Source has no recipe yield and reports whole-recipe-scale nutrition as one serving. Retain source values; serving/nutrition review required.',
};
export function sourceRecipeNutritionReviewHold(sourceUrl: string): string | null {
  return holds[sourceUrl] ?? null;
}

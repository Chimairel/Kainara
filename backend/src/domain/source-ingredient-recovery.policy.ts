type SourceIngredient = Record<string, unknown> & {
  name?: unknown;
  quantity?: unknown;
  unit?: unknown;
};

export const SOURCE_INGREDIENT_RECOVERY_VERSION = 'CODEX_SOURCE_TEXT_MEASUREMENT_V1';

const fractions: Readonly<Record<string, number>> = Object.freeze({
  '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
});

const units: Readonly<Record<string, string>> = Object.freeze({
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  kg: 'kg', kilogram: 'kg', kilograms: 'kg',
  g: 'g', gram: 'g', grams: 'g',
  cup: 'cup', cups: 'cup',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
});
const unitPattern = '(?:lbs?|pounds?|oz|ounces?|kg|kilograms?|g|grams?|cups?|tbsp|tablespoons?|tsp|teaspoons?)';
const unitOnly = new RegExp(`^(${unitPattern})\\.?\\s+`, 'iu');
const fractionUnit = new RegExp(`^([½¼¾⅓⅔⅛⅜⅝⅞])\\s*(${unitPattern})\\.?\\s+`, 'iu');

export function recoverSourceIngredientMeasurement(
  ingredient: SourceIngredient,
  originalServings: number | null
): { ingredient: SourceIngredient; method: 'UNIT_FROM_SOURCE_TEXT' | 'FRACTION_FROM_SOURCE_TEXT' | null } {
  if (typeof ingredient.name !== 'string' || ingredient.sourceDataAdjustment) {
    return { ingredient, method: null };
  }
  const name = ingredient.name.trim();
  const quantity = ingredient.quantity;
  const unit = typeof ingredient.unit === 'string' && ingredient.unit.trim() ? ingredient.unit.trim() : null;
  if (unit) return { ingredient, method: null };
  if (typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0) {
    const match = unitOnly.exec(name);
    const recoveredUnit = match ? units[match[1].toLowerCase()] :
      /^(?:eggs?|large eggs?)$/iu.test(name) ? 'piece' : null;
    if (!recoveredUnit) return { ingredient, method: null };
    return { ingredient: { ...ingredient, unit: recoveredUnit,
      sourceDataAdjustment: SOURCE_INGREDIENT_RECOVERY_VERSION,
      sourceQuantityBeforeAdjustment: quantity, sourceUnitBeforeAdjustment: ingredient.unit ?? null },
      method: 'UNIT_FROM_SOURCE_TEXT' };
  }
  if (quantity !== 0 || !originalServings || !Number.isFinite(originalServings) || originalServings <= 0) {
    return { ingredient, method: null };
  }
  const match = fractionUnit.exec(name);
  if (!match) return { ingredient, method: null };
  const recoveredQuantity = Math.round((fractions[match[1]] / originalServings) * 1000) / 1000;
  if (recoveredQuantity <= 0) return { ingredient, method: null };
  return { ingredient: { ...ingredient, quantity: recoveredQuantity, unit: units[match[2].toLowerCase()],
    sourceDataAdjustment: SOURCE_INGREDIENT_RECOVERY_VERSION,
    sourceQuantityBeforeAdjustment: quantity, sourceUnitBeforeAdjustment: ingredient.unit ?? null },
    method: 'FRACTION_FROM_SOURCE_TEXT' };
}

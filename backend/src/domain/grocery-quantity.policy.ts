export interface GroceryIngredientInput {
  ingredientName: string;
  category?: string | null;
  quantity?: number | null;
  unit?: string | null;
}

export interface AggregatedGroceryIngredient {
  key: string;
  ingredientName: string;
  category: string;
  quantity: number | null;
  unit: string | null;
  sourceMealCount: number;
}

const UNIT_ALIASES: Record<string, string> = {
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  ml: 'mL',
  milliliter: 'mL',
  milliliters: 'mL',
  l: 'L',
  liter: 'L',
  liters: 'L',
  litre: 'L',
  litres: 'L',
  piece: 'piece',
  pieces: 'piece',
  pc: 'piece',
  pcs: 'piece',
  tbsp: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tsp: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  cup: 'cup',
  cups: 'cup',
  can: 'can',
  cans: 'can',
  pack: 'pack',
  packs: 'pack',
  package: 'pack',
  packages: 'pack',
};

export function normalizeGroceryUnit(unit?: string | null): string | null {
  const normalized = unit?.trim().toLowerCase();
  return normalized ? UNIT_ALIASES[normalized] || normalized.slice(0, 32) : null;
}

export function groceryItemKey(name: string, unit?: string | null): string {
  const normalized = normalizeGroceryUnit(unit);
  const base = normalized === 'kg' ? 'g' : normalized === 'L' ? 'mL' : normalized;
  return `${name.trim().toLowerCase().replace(/\s+/g, ' ')}|${base || 'unspecified'}`;
}

export function aggregateGroceryIngredients(
  ingredients: readonly GroceryIngredientInput[]
): AggregatedGroceryIngredient[] {
  const aggregated = new Map<string, AggregatedGroceryIngredient>();

  for (const ingredient of ingredients) {
    const cleanName = ingredient.ingredientName
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\s*(?:\(\s*to taste\s*\)|\bto taste\b)\s*$/iu, '')
      .trim();
    if (!cleanName) continue;
    const originalUnit = normalizeGroceryUnit(ingredient.unit);
    const factor = originalUnit === 'kg' || originalUnit === 'L' ? 1000 : 1;
    const unit = originalUnit === 'kg' ? 'g' : originalUnit === 'L' ? 'mL' : originalUnit;
    const validQuantity =
      unit && typeof ingredient.quantity === 'number' && Number.isFinite(ingredient.quantity) && ingredient.quantity > 0
        ? ingredient.quantity * factor
        : null;
    // Keep a measured amount and an additional unmeasured amount as separate
    // shopping rows. Otherwise one "to taste" entry hides a useful known sum.
    const recordedUnit = validQuantity === null ? null : unit;
    const key = groceryItemKey(cleanName, recordedUnit);
    const current = aggregated.get(key);
    if (!current) {
      aggregated.set(key, {
        key,
        ingredientName: cleanName.charAt(0).toUpperCase() + cleanName.slice(1),
        category: ingredient.category?.trim() || 'Other',
        quantity: validQuantity,
        unit: recordedUnit,
        sourceMealCount: 1,
      });
      continue;
    }

    current.sourceMealCount += 1;
    if (current.quantity !== null && validQuantity !== null) {
      current.quantity = Math.round((current.quantity + validQuantity) * 100) / 100;
    }
  }

  return [...aggregated.values()];
}

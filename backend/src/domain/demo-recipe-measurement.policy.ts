/** Explicit demonstration assumptions; never measured or clinically certified evidence. */
export const DEMO_PREPARATION_VERSION = 'DEMO_RECIPE_PREPARATION_V1';
const fractions: Record<string, number> = {
  '½': 0.5,
  '¼': 0.25,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
};
const measures: Record<string, string> = {
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  tsp: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tbsp: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  cup: 'cup',
  cups: 'cup',
  ml: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  l: 'l',
  liter: 'l',
  liters: 'l',
  piece: 'piece',
  pieces: 'piece',
  pcs: 'piece',
  clove: 'clove',
  cloves: 'clove',
  head: 'head',
  heads: 'head',
  small: 'small',
  medium: 'medium',
  large: 'large',
  can: 'can',
  cans: 'can',
  slice: 'slice',
  slices: 'slice',
  stalk: 'stalk',
  stalks: 'stalk',
  leaf: 'leaf',
  leaves: 'leaf',
};
export function demoUnit(value: string | null | undefined): string | null {
  return measures[value?.trim().toLowerCase().replace(/\.$/u, '') ?? ''] ?? null;
}
function amount(value: string): number {
  const text = value.trim();
  if (fractions[text]) return fractions[text];
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/u.exec(text);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const fraction = /^(\d+)\/(\d+)$/u.exec(text);
  return fraction ? Number(fraction[1]) / Number(fraction[2]) : Number(text);
}
export interface DemoIngredientInput {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  foodItemId?: string | null;
  [key: string]: unknown;
}
const numberPattern = '(?:\\d+\\s+\\d+/\\d+|\\d+/\\d+|\\d+(?:\\.\\d+)?|[½¼¾⅓⅔⅛⅜⅝⅞])';
const measurePattern = new RegExp(
  `^(${numberPattern})(?:\\s*(?:-|–|to)\\s*(${numberPattern}))?\\s+([a-z]+)\\.?\\s+(.+)$`,
  'iu'
);

export function prepareDemoMeasurement(input: DemoIngredientInput, servings: number) {
  if (!(servings > 0) || !Number.isFinite(servings)) throw new Error('Positive source serving count required.');
  let name = input.name.trim();
  let quantity =
    typeof input.quantity === 'number' && Number.isFinite(input.quantity) && input.quantity > 0 ? input.quantity : null;
  let unit = demoUnit(input.unit);
  const assumptions: string[] =
    input.demoAssumption === 'STANDARDIZED_DEMO_EDIBLE_GRAMS' ? ['STANDARDIZED_DEMO_EDIBLE_GRAMS'] : [];
  const match = measurePattern.exec(name);
  if (match && demoUnit(match[3])) {
    name = match[4];
    if (quantity === null || unit === null) {
      quantity = (amount(match[1]) + (match[2] ? amount(match[2]) : amount(match[1]))) / 2 / servings;
      unit = demoUnit(match[3]);
      if (match[2]) assumptions.push('SOURCE_RANGE_MIDPOINT');
      else if (input.quantity && input.unit === 'to') assumptions.push('TRUNCATED_RANGE_UPPER_ENDPOINT');
    }
  } else {
    name = name.replace(/^(?:lbs?|oz|kg|grams?|cups?|tbsp|tsp|tablespoons?|teaspoons?)\.?\s+/iu, '');
  }
  if (quantity && !unit && /^(?:eggs?|eggplant|onion|tomato)(?:\s*\([^)]*\))?$/iu.test(name)) {
    unit = 'piece';
    assumptions.push('DEMO_COUNT_UNIT');
  }
  // Split combined seasonings; both contribute to the recorded demonstration totals.
  if (
    /^(?:salt(?: and (?:ground black )?pepper)?|(?:ground black )?pepper)(?:\s*\(?(?:to taste|as needed|if necessary)\)?)?$/iu.test(
      name
    ) &&
    /to taste|as needed|if necessary/iu.test(name)
  ) {
    const salt = /^salt/iu.test(name);
    const pepper = /pepper/iu.test(name);
    return [
      ...(salt
        ? [{ name: 'salt', quantity: 0.5, unit: 'g', assumptions: [...assumptions, 'DEMO_SALT_0_5_G_PER_SERVING'] }]
        : []),
      ...(pepper
        ? [
            {
              name: 'ground black pepper',
              quantity: 0.05,
              unit: 'g',
              assumptions: [...assumptions, 'DEMO_PEPPER_0_05_G_PER_SERVING'],
            },
          ]
        : []),
    ];
  }
  return [{ name, quantity, unit, assumptions }];
}

export interface SourcePortion {
  id: number;
  amount: number;
  grams: number;
  description: string;
}
export function demoPortionGrams(
  quantity: number | null,
  unit: string | null,
  portions: readonly SourcePortion[],
  name: string
) {
  if (!(quantity && quantity > 0) || !unit) return null;
  const mass: Record<string, number> = { g: 1, kg: 1000, lb: 453.59237, oz: 28.349523125 };
  if (mass[unit])
    return { grams: quantity * mass[unit], method: 'EXACT_MASS_UNIT', portionIds: [] as number[], assumed: false };
  if (name.toLowerCase() === 'water' && ['ml', 'l', 'cup', 'tsp', 'tbsp'].includes(unit))
    return {
      grams: quantity * { ml: 1, l: 1000, cup: 240, tsp: 5, tbsp: 15 }[unit]!,
      method: 'DEMO_WATER_1_G_PER_ML_240_ML_CUP',
      portionIds: [],
      assumed: true,
    };
  let effectiveQuantity = quantity;
  let effectiveUnit = unit;
  const direct = portions.some((p) => demoUnit(p.description.split(/[\s,(]/u)[0]) === unit);
  if (!direct && ['ml', 'l', 'tsp', 'tbsp'].includes(unit)) {
    effectiveQuantity = quantity * { ml: 1 / 240, l: 1000 / 240, tsp: 1 / 48, tbsp: 1 / 16 }[unit]!;
    effectiveUnit = 'cup';
  }
  const candidates = portions.filter((p) => {
    const token = p.description.split(/[\s,(]/u)[0].toLowerCase();
    return (
      demoUnit(token) === effectiveUnit ||
      (effectiveUnit === 'piece' && ['small', 'medium', 'large', 'leaf'].includes(demoUnit(token) ?? ''))
    );
  });
  if (!candidates.length) return null;
  const prepared = candidates.filter(
    (p) => /chopped|sliced|minced/iu.test(name) && /chopped|sliced|minced/iu.test(p.description)
  );
  const selected = [...(prepared.length ? prepared : candidates)].sort(
    (a, b) => a.grams / a.amount - b.grams / b.amount
  );
  const chosen = selected[Math.floor(selected.length / 2)];
  return {
    grams: (effectiveQuantity * chosen.grams) / chosen.amount,
    method: 'USDA_HOUSEHOLD_PORTION',
    portionIds: [chosen.id],
    assumed: true,
  };
}

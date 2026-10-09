export const MEAL_EXTENDED_NUTRIENTS = [
  'sodiumMg',
  'sugarG',
  'fiberG',
  'potassiumMg',
  'phosphorusMg',
  'saturatedFatG',
] as const;
type Nutrients = Partial<Record<(typeof MEAL_EXTENDED_NUTRIENTS)[number], number | null>>;
type Macros = { calories: number; proteinG: number; carbsG: number; fatG: number };
type Ingredient = { name: string; quantity?: number | null; unit?: string | null };
const label = (value: string) => value.normalize('NFKC').trim().toLowerCase();

/** Published nutrients can fill only the identical, unreviewed source serving. */
export function publishedServingNutrientFill(
  meal: Macros & Nutrients & { name: string; ingredients: Ingredient[] },
  source: { name: string; nutrition: unknown; ingredients: Ingredient[] }
) {
  const nutrition = source.nutrition as (Macros & Nutrients) | null;
  if (
    !nutrition ||
    label(meal.name) !== label(source.name) ||
    (['calories', 'proteinG', 'carbsG', 'fatG'] as const).some(
      (key) => typeof nutrition[key] !== 'number' || Math.abs(meal[key] - nutrition[key]) > 0.01
    ) ||
    meal.ingredients.length !== source.ingredients.length ||
    meal.ingredients.some(
      (item, i) =>
        label(item.name) !== label(source.ingredients[i].name) ||
        item.quantity !== source.ingredients[i].quantity ||
        label(item.unit ?? '') !== label(source.ingredients[i].unit ?? '')
    )
  )
    return null;
  const fill: Nutrients = {};
  for (const key of MEAL_EXTENDED_NUTRIENTS) {
    const value = nutrition[key];
    if (meal[key] == null && typeof value === 'number' && Number.isFinite(value) && value >= 0) fill[key] = value;
  }
  return Object.keys(fill).length ? fill : null;
}

import { createHash } from 'node:crypto';
import { MEAL_EXTENDED_NUTRIENTS } from './meal-nutrient-completion.policy';
import type { PlateNutrients, ReviewNutrient } from './review-nutrient-filter.policy';
import { publishedExtendedNutrients } from './review-plate-nutrients.policy';

export const REVIEW_NUTRIENT_ESTIMATE_VERSION = 'COMPARABLE_FOOD_NUTRIENTS_V1';
export type EstimateRecipe = {
  name: string;
  ingredients: unknown;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};
export type NutrientReference = {
  id: string;
  name: string;
  category: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sodiumMg: number | null;
  sugarG: number | null;
  fiberG: number | null;
  potassiumMg: number | null;
  phosphorusMg: number | null;
  saturatedFatG: number | null;
};
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const terms = (v: string) =>
  new Set(
    v
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((x) => x.length > 2 && !['recipe', 'with', 'and', 'the', 'raw', 'cooked', 'food', 'foods'].includes(x))
  );
const overlap = (a: Set<string>, b: Set<string>) => [...a].filter((x) => b.has(x)).length;
const referenceCache = new WeakMap<
  readonly NutrientReference[],
  Array<{ r: NutrientReference; tokens: Set<string> }>
>();
export function recipeEstimateFingerprint(recipe: EstimateRecipe) {
  return createHash('sha256')
    .update(
      JSON.stringify([recipe.name, recipe.calories, recipe.proteinG, recipe.carbsG, recipe.fatG, recipe.ingredients])
    )
    .digest('hex');
}

/** Transparent comparable-food estimate, calibrated to saved energy/macros. No measured-source field is overwritten. */
export function estimateReviewNutrients(
  recipe: EstimateRecipe,
  existing: unknown,
  references: readonly NutrientReference[],
  sourceSha256: string
) {
  if (!finite(recipe.calories) || recipe.calories <= 0 || ![recipe.proteinG, recipe.carbsG, recipe.fatG].every(finite))
    return null;
  const recorded = publishedExtendedNutrients(existing);
  const wanted = MEAL_EXTENDED_NUTRIENTS.filter((key) => recorded[key] == null);
  if (!wanted.length) return null;
  const title = terms(recipe.name),
    ingredients = terms(JSON.stringify(recipe.ingredients));
  const target = [recipe.proteinG!, recipe.carbsG!, recipe.fatG!].map((x) => x / recipe.calories!);
  let prepared = referenceCache.get(references);
  if (!prepared) {
    prepared = references
      .filter((r) => r.calories >= 5 && r.calories <= 900 && ![r.proteinG, r.carbsG, r.fatG].some((x) => !finite(x)))
      .map((r) => ({ r, tokens: terms(r.name) }));
    referenceCache.set(references, prepared);
  }
  const ranked = prepared
    .map(({ r, tokens }) => ({
      r,
      score:
        overlap(title, tokens) * 8 +
        overlap(ingredients, tokens) * 0.5 -
        [r.proteinG, r.carbsG, r.fatG].reduce((sum, x, i) => sum + Math.abs(x / r.calories - target[i]), 0) * 80,
    }))
    .sort((a, b) => b.score - a.score || a.r.id.localeCompare(b.r.id));
  const values: Partial<PlateNutrients> = {},
    donors: Partial<Record<ReviewNutrient, Array<{ id: string; weight: number; scale: number }>>> = {};
  for (const key of MEAL_EXTENDED_NUTRIENTS) {
    const selected = ranked.filter((x) => finite(x.r[key])).slice(0, 3);
    if (!selected.length) continue;
    const weights = selected.map((x) => 1 / (1 + Math.max(0, selected[0].score - x.score))),
      total = weights.reduce((a, b) => a + b, 0);
    let amount = selected.reduce(
      (sum, x, i) => sum + (((x.r[key]! * recipe.calories!) / x.r.calories) * weights[i]) / total,
      0
    );
    // A constituent cannot exceed the corresponding saved total macronutrient.
    if (key === 'sugarG' || key === 'fiberG') amount = Math.min(amount, recipe.carbsG!);
    if (key === 'saturatedFatG') amount = Math.min(amount, recipe.fatG!);
    values[key] = Math.round(amount * 1000) / 1000;
    donors[key] = selected.map((x, i) => ({
      id: x.r.id,
      weight: Math.round((weights[i] / total) * 1000000) / 1000000,
      scale: Math.round((recipe.calories! / x.r.calories) * 1000000) / 1000000,
    }));
  }
  return Object.keys(values).length
    ? {
        version: REVIEW_NUTRIENT_ESTIMATE_VERSION,
        estimated: true,
        clinicalCertification: false,
        basis: 'COMPARABLE_FOOD_PER_100_G_SCALED_TO_RECORDED_RECIPE_ENERGY',
        values,
        sourceMissingKeys: wanted,
        donors,
        sourceSha256,
        inputFingerprint: recipeEstimateFingerprint(recipe),
      }
    : null;
}

/** Supplementary estimates are exposed explicitly in RND previews, never as publisher measurements. */
export function reviewSourceNutrients(published: unknown, recipe: EstimateRecipe, allowEstimates = false) {
  const values = publishedExtendedNutrients(published),
    estimatedKeys: ReviewNutrient[] = [],
    fallbackEstimates: Partial<PlateNutrients> = {};
  const doc = object(published),
    estimate = object(doc.extendedNutritionEstimates);
  if (
    allowEstimates &&
    estimate.version === REVIEW_NUTRIENT_ESTIMATE_VERSION &&
    estimate.estimated === true &&
    estimate.clinicalCertification === false &&
    estimate.inputFingerprint === recipeEstimateFingerprint(recipe)
  ) {
    const extra = object(estimate.values);
    for (const key of MEAL_EXTENDED_NUTRIENTS)
      if (finite(extra[key])) {
        fallbackEstimates[key] = extra[key];
        if (values[key] == null) {
          values[key] = extra[key];
          estimatedKeys.push(key);
        }
      }
  }
  return { values, estimatedKeys, fallbackEstimates };
}

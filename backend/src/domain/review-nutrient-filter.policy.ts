import { z } from 'zod';
import { createHash } from 'node:crypto';

export const REVIEW_NUTRIENTS = ['calories', 'proteinG', 'carbsG', 'fatG', 'sodiumMg', 'sugarG', 'fiberG', 'potassiumMg', 'phosphorusMg', 'saturatedFatG'] as const;
export type ReviewNutrient = typeof REVIEW_NUTRIENTS[number];
export type PlateNutrients = Record<ReviewNutrient, number | null>;
const bound = z.number().finite().min(0).max(1000000);
const roundNutrient = (value: number) => Math.round(value * 10) / 10;
const range = z.object({ min: bound.optional(), max: bound.optional(), minExclusive: z.boolean().optional(), maxExclusive: z.boolean().optional() }).strict().refine(
  value => (value.min !== undefined || value.max !== undefined) &&
    (value.min === undefined || value.max === undefined || value.min <= value.max) &&
    (!value.minExclusive || value.min !== undefined) && (!value.maxExclusive || value.max !== undefined),
  'Provide a minimum or maximum, with minimum no greater than maximum.'
).transform(value => ({ ...value,
  ...(value.min !== undefined ? { min: roundNutrient(value.min) } : {}),
  ...(value.max !== undefined ? { max: roundNutrient(value.max) } : {}),
}));
export const reviewNutrientFiltersSchema = z.object({
  calories: range.optional(), proteinG: range.optional(), carbsG: range.optional(), fatG: range.optional(),
  sodiumMg: range.optional(), sugarG: range.optional(), fiberG: range.optional(), potassiumMg: range.optional(),
  phosphorusMg: range.optional(), saturatedFatG: range.optional(),
}).strict();
export type ReviewNutrientFilters = z.infer<typeof reviewNutrientFiltersSchema>;
export const replacementOutcomeSchema = z.object({
  kind: z.literal('NO_SUITABLE_REPLACEMENT'), searchReceipt: z.string().min(1).max(6000),
}).strict();
export type ReplacementOutcome = z.infer<typeof replacementOutcomeSchema>;

const measured = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
/** Extended nutrients are per serving on the base and per 100 g on the side. Never turn an unknown into zero. */
export function plateNutrients(base: Partial<PlateNutrients>, side: Partial<PlateNutrients> | null, sideG: number | null): PlateNutrients {
  return Object.fromEntries(REVIEW_NUTRIENTS.map(key => {
    const a = base[key], b = side?.[key];
    const value = !measured(a) ? null : sideG ? (measured(b) ? a + b * sideG / 100 : null) : a;
    return [key, value];
  })) as PlateNutrients;
}
export function evaluateNutrientFilters(nutrients: PlateNutrients, filters: ReviewNutrientFilters) {
  const unknown = REVIEW_NUTRIENTS.filter(key => filters[key] && !measured(nutrients[key]));
  const matches = !unknown.length && REVIEW_NUTRIENTS.every(key => {
    const range = filters[key], raw = nutrients[key];
    if (!range) return true;
    if (!measured(raw)) return false;
    // All search comparisons use the same precision as the displayed plate.
    const value = roundNutrient(raw);
    return (range.min === undefined || (range.minExclusive ? value > roundNutrient(range.min) : value >= roundNutrient(range.min))) &&
      (range.max === undefined || (range.maxExclusive ? value < roundNutrient(range.max) : value <= roundNutrient(range.max)));
  });
  return { matches, unknown };
}
/** Serving identity always binds unrounded totals, independently of search display precision. */
export function replacementServingKey(input: {
  recipeSignature: string | null; evidenceRevision: number; nutrients: PlateNutrients;
  riceFoodId: string | null; riceRevision: number | null; pairedRiceG: number | null;
}) {
  return createHash('sha256').update(JSON.stringify([
    input.recipeSignature, input.evidenceRevision, REVIEW_NUTRIENTS.map(key => input.nutrients[key]),
    input.riceFoodId, input.riceRevision, input.pairedRiceG,
  ])).digest('hex');
}

import { z } from 'zod';
import { mealReviewContextSchema } from './nutritionist.schemas';
import { reviewNutrientFiltersSchema } from '@/domain/review-nutrient-filter.policy';
const queryFilters = z.string().max(2048).transform((value, ctx) => {
  try { return JSON.parse(value) as unknown; } catch { ctx.addIssue({ code: 'custom', message: 'Invalid nutrient filter JSON.' }); return z.NEVER; }
}).pipe(reviewNutrientFiltersSchema);
export const reviewSwapQuerySchema = z.object({ expectedContextKey: mealReviewContextSchema,
  filters: queryFilters.optional(), cursor: z.string().max(1000).optional() }).strict();

export const reviewSwapParamsSchema = z.object({ id: z.string().min(1).max(100) }).strict();
export const reviewSwapBodySchema = z
  .object({
    expectedContextKey: mealReviewContextSchema,
    libraryMealId: z.string().min(1).max(100),
    expectedVersion: z.string().regex(/^[a-f0-9]{64}$/),
    expectedRecipeSignature: z.string().regex(/^[a-f0-9]{64}$/),
    expectedEvidenceRevision: z.number().int().nonnegative(),
    expectedServingKey: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    filters: reviewNutrientFiltersSchema.optional(),
    note: z.string().trim().min(10).max(1000),
  })
  .strict();

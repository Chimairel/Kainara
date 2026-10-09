import { z } from 'zod';
import { mealReviewContextSchema } from './nutritionist.schemas';
export const reviewSwapQuerySchema = z.object({ expectedContextKey: mealReviewContextSchema }).strict();

export const reviewSwapParamsSchema = z.object({ id: z.string().min(1).max(100) }).strict();
export const reviewSwapBodySchema = z
  .object({
    expectedContextKey: mealReviewContextSchema,
    libraryMealId: z.string().min(1).max(100),
    expectedVersion: z.string().regex(/^[a-f0-9]{64}$/),
    expectedRecipeSignature: z.string().regex(/^[a-f0-9]{64}$/),
    expectedEvidenceRevision: z.number().int().nonnegative(),
    note: z.string().trim().min(10).max(1000),
  })
  .strict();

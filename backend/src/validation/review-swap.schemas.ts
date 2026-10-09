import { z } from 'zod';

export const reviewSwapParamsSchema = z.object({ id: z.string().min(1).max(100) }).strict();
export const reviewSwapBodySchema = z
  .object({
    libraryMealId: z.string().min(1).max(100),
    expectedVersion: z.string().regex(/^[a-f0-9]{64}$/),
    expectedRecipeSignature: z.string().regex(/^[a-f0-9]{64}$/),
    expectedEvidenceRevision: z.number().int().nonnegative(),
    note: z.string().trim().min(10).max(1000),
  })
  .strict();

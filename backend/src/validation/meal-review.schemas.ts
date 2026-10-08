import { z } from 'zod';

export const mealConcernSchema = z
  .object({
    category: z.enum(['INGREDIENT', 'NUTRITION', 'ALLERGEN', 'PREPARATION', 'EVIDENCE', 'OTHER']),
    affectedFields: z.array(z.string().trim().min(1).max(200)).min(1).max(40),
    explanation: z.string().trim().min(20).max(3000),
    reference: z.string().trim().min(10).max(2000),
    proposedCorrection: z.string().trim().min(10).max(2000),
  })
  .strict();
export const mealFlagSubmissionSchema = z
  .object({
    expectedVersion: z.string().regex(/^[a-f0-9]{64}$/),
    notes: mealConcernSchema,
  })
  .strict();
export const mealReviewSubmissionSchema = z
  .object({
    evidenceReviewed: z.literal(true),
    riceRoleReviewed: z.literal(true),
    expectedVersion: z.string().regex(/^[a-f0-9]{64}$/),
    rationale: z.string().trim().min(20).max(3000),
    resolutions: z
      .array(
        z
          .object({
            reportId: z.string().min(1).max(191),
            rationale: z.string().trim().min(20).max(3000),
          })
          .strict()
      )
      .min(1)
      .max(500),
  })
  .strict();
export const mealReviewActionSchema = z
  .object({
    expectedVersion: z.string().regex(/^[a-f0-9]{64}$/),
    rationale: z.string().trim().min(20).max(3000),
  })
  .strict();
export type MealFlagSubmission = z.infer<typeof mealFlagSubmissionSchema>;
export type MealReviewSubmission = z.infer<typeof mealReviewSubmissionSchema>;

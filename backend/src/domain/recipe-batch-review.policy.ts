import { createHash } from 'node:crypto';
import { z } from 'zod';

export const recipeBatchReviewSchema = z
  .object({
    confirmedReview: z.literal(true),
    items: z
      .array(
        z
          .object({
            id: z.string().min(1).max(160),
            revisionKey: z.string().min(1).max(64),
            evidenceHash: z.string().regex(/^[a-f0-9]{64}$/),
            rationale: z.string().trim().min(10).max(1000),
          })
          .strict()
      )
      .min(1)
      .max(25),
  })
  .strict()
  .refine((batch) => new Set(batch.items.map((item) => item.id)).size === batch.items.length, {
    message: 'Select each recipe only once.',
  });

export function recipeReviewEvidenceHash(evidence: unknown): string {
  return createHash('sha256').update(JSON.stringify(evidence)).digest('hex');
}

type Evidence = {
  ingredients: unknown;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  description: string | null;
};

/** These are completeness checks, not a substitute for the reviewer's decision. */
export function recipeBatchReviewIssues(recipe: Evidence): string[] {
  const issues: string[] = [];
  if (!recipe.description?.trim()) issues.push('Preparation/description is missing.');
  if (
    ![recipe.calories, recipe.proteinG, recipe.carbsG, recipe.fatG].every(
      (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0
    ) ||
    !(recipe.calories && recipe.calories > 0)
  )
    issues.push('Serving nutrition is incomplete or invalid.');
  if (!Array.isArray(recipe.ingredients) || !recipe.ingredients.length) {
    issues.push('Ingredient evidence is missing.');
  } else if (
    recipe.ingredients.some((value: unknown) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return true;
      const item = value as Record<string, unknown>;
      return (
        typeof item.name !== 'string' ||
        !item.name.trim() ||
        typeof item.quantity !== 'number' ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        typeof item.unit !== 'string' ||
        !item.unit.trim()
      );
    })
  )
    issues.push('Every ingredient needs a name, positive measured quantity and unit.');
  return issues;
}

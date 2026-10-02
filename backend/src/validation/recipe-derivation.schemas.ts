import { z } from 'zod';

export const recipeDerivationSchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    mealName: z.string().trim().min(2).max(180),
    summary: z.string().trim().min(1).max(1000),
    instructions: z.string().trim().min(10).max(4000),
    mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']),
    ingredients: z
      .array(
        z.object({ foodItemId: z.string().min(1).max(100), grams: z.number().finite().positive().max(3000) }).strict()
      )
      .min(1)
      .max(50),
    riceRole: z.enum(['PAIR_WITH_RICE', 'STANDALONE', 'INCLUDES_RICE']),
    includedRiceG: z.number().positive().max(1000).nullable().optional(),
    riceMinHalfCups: z.number().int().min(1).max(6).default(1),
    riceMaxHalfCups: z.number().int().min(1).max(6).default(3),
    imageUrl: z.string().url().max(2048).nullable(),
    imageMatchesRecipe: z.literal(true),
    rationale: z.string().trim().min(10).max(1000),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.riceMinHalfCups > value.riceMaxHalfCups)
      ctx.addIssue({ code: 'custom', path: ['riceMaxHalfCups'], message: 'Maximum must be at least the minimum.' });
    if (value.riceRole === 'INCLUDES_RICE' && !value.includedRiceG)
      ctx.addIssue({
        code: 'custom',
        path: ['includedRiceG'],
        message: 'Record the cooked rice already included in this serving.',
      });
    if (value.imageUrl) {
      const url = new URL(value.imageUrl);
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[|0\.)/i.test(url.hostname)
      )
        ctx.addIssue({ code: 'custom', path: ['imageUrl'], message: 'Use a public HTTPS image URL.' });
    }
  });

export type RecipeDerivationInput = z.infer<typeof recipeDerivationSchema>;

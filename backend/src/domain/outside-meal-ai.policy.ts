import { z } from 'zod';

export const outsideMealAiItemSchema = z.object({
  name: z.string().min(1).max(180),
  calories: z.number().min(0).max(10_000),
  calorieLow: z.number().min(0).max(10_000),
  calorieHigh: z.number().min(0).max(10_000),
  proteinG: z.number().min(0).max(1_000),
  carbsG: z.number().min(0).max(2_000),
  fatG: z.number().min(0).max(1_000),
  sodiumMg: z.number().min(0).max(100_000).optional(),
  sugarsG: z.number().min(0).max(2_000).optional(),
  ingredients: z.array(z.string().min(1).max(120)).max(40),
});

export function buildOutsideMealAiSchema(itemCount: number) {
  return z.object({
    items: z
      .array(outsideMealAiItemSchema)
      .length(itemCount)
      .min(1)
      .max(10)
      .refine((items) => items.every((item) => item.calorieLow <= item.calories && item.calorieHigh >= item.calories), {
        message: 'Each estimate must be within its stated calorie range.',
      }),
  });
}

export function buildOutsideMealAiPrompt(
  items: ReadonlyArray<{ name: string; portionGrams?: number }>,
  estimationContext: string
) {
  return {
    prompt: `Estimate each consumed food item independently and return the same number of items in the same order.
Return exactly one JSON object with this shape and no alternate field names:
{"items":[{"name":"food name","calories":210,"calorieLow":170,"calorieHigh":260,"proteinG":3,"carbsG":42,"fatG":6,"sodiumMg":120,"sugarsG":18,"ingredients":["ingredient"]}]}
Every calories, calorieLow, calorieHigh, proteinG, carbsG, and fatG value must be a finite non-negative JSON number. calorieLow must not exceed calories and calorieHigh must not be below calories. ingredients must be an array of plain ingredient-name strings. sodiumMg and sugarsG may be omitted only when they cannot be estimated.
Foods: ${JSON.stringify(items.map((item) => ({ name: item.name, portionGrams: item.portionGrams ?? null })))}
Preparation and serving context: ${JSON.stringify(estimationContext)}
If grams or serving context are absent, estimate one typical consumed serving for the named food and return a wider calorie range that reflects the uncertainty. Do not invent an exact measured portion.`,
    systemInstruction: 'You estimate nutrition for Filipino foods. Return JSON only. Do not claim clinical certainty.',
  };
}

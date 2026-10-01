import { z } from 'zod';

const updatesSchema = z
  .object({
    weightKg: z.number().min(30).max(300).optional(),
    activityLevel: z.enum(['SEDENTARY', 'LIGHTLY_ACTIVE', 'ACTIVE', 'VERY_ACTIVE']).optional(),
    goal: z.enum(['LOSE_WEIGHT', 'GAIN_WEIGHT', 'MAINTAIN', 'BUILD_MUSCLE']).optional(),
  })
  .strict();

export const weeklyCheckinSchema = z.discriminatedUnion('changed', [
  z.object({ changed: z.literal(false), profileRevision: z.number().int().nonnegative().optional() }).strict(),
  z
    .object({
      changed: z.literal(true),
      updates: updatesSchema.default({}),
      profileRevision: z.number().int().nonnegative().optional(),
    })
    .strict(),
]);

export type WeeklyCheckinInput = z.infer<typeof weeklyCheckinSchema>;

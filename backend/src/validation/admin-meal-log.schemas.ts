import { z } from 'zod';
import { MEAL_LOG_AGE_GROUPS, MEAL_LOG_MEMBERSHIPS } from '@/domain/meal-log-audit.policy';
import { getManilaDateKey } from '@/domain/meal-plan-cycle.policy';

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(value + 'T00:00:00Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  });
const filters = {
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  from: date.optional(),
  to: date.optional(),
  member: z.string().trim().max(200).optional(),
  source: z.enum(['PLANNED', 'OUTSIDE']).optional(),
  mealType: z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']).optional(),
  status: z.enum(['DONE', 'SKIPPED', 'PENDING', 'REMOVED']).optional(),
  ageGroup: z.enum(MEAL_LOG_AGE_GROUPS).optional(),
  membership: z.enum(MEAL_LOG_MEMBERSHIPS).optional(),
  recipeKey: z.string().min(1).max(240).optional(),
  includeTests: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .default(false),
  order: z.enum(['MOST_EATEN', 'LEAST_EATEN']).default('MOST_EATEN'),
};
export const mealLogFiltersSchema = z
  .object(filters)
  .strict()
  .refine((v) => {
    const end = new Date(`${v.to ?? getManilaDateKey(new Date())}T00:00:00+08:00`).getTime();
    const start = v.from ? new Date(`${v.from}T00:00:00+08:00`).getTime() : end - 29 * 86400000;
    return Number.isFinite(end) && Number.isFinite(start) && start <= end && end - start <= 365 * 86400000;
  }, 'Choose a range of at most 366 days.');
export type MealLogFilters = z.infer<typeof mealLogFiltersSchema>;

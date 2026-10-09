import { createHash } from 'node:crypto';
import { AppError } from '@/errors/AppError';

/** Object order is not a version; array order remains meaningful to the caller. */
export function reviewContextKey(value: unknown): string {
  const normalize = (item: unknown): unknown => {
    if (item instanceof Date) return item.toISOString();
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === 'object')
      return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, normalize(v)]));
    return item;
  };
  return createHash('sha256').update(JSON.stringify(normalize(value))).digest('hex');
}

export function assertMealReviewContext(expected: string | undefined, current: string) {
  if (!expected || expected !== current)
    throw new AppError('This review context changed. Open the current case before deciding.', 409, 'MEAL_REVIEW_CONTEXT_CHANGED');
}

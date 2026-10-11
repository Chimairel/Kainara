import { expect, it } from 'vitest';
import { mealPlanPresentation } from './meal-plan-presentation';
import type { CurrentPlanSnapshot } from './meals-workspace.types';

it('keeps a starter end date and next Philippine day stable across device daylight saving changes', () => {
  const result = mealPlanPresentation({
    meals: [],
    pendingReview: null,
    retainedMealLogs: [],
    selectedPlanDateKey: null,
    cycles: {
      current: { planType: 'STARTER', startDate: '2026-03-07T16:00:00Z', endDate: '2026-03-07T16:00:00Z' },
      upcoming: null,
    } as CurrentPlanSnapshot['cycles'],
  });
  expect(result.nextCycleDay).toBe('Monday, Mar 9');
});

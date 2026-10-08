import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mealLogFiltersSchema } from '../src/validation/admin-meal-log.schemas';
import { mealLogWindow } from '../src/services/admin-meal-log-query';

test('meal audit windows use Manila calendar boundaries and include the final day', () => {
  const window = mealLogWindow(mealLogFiltersSchema.parse({}), new Date('2026-10-08T20:00:00Z'));
  assert.equal(window.from, '2026-09-10');
  assert.equal(window.to, '2026-10-09');
  assert.equal(window.start.toISOString(), '2026-09-09T16:00:00.000Z');
  assert.equal(window.end.toISOString(), '2026-10-09T16:00:00.000Z');
});

test('meal audit rejects impossible dates, reversed or oversized windows, and arbitrary selectors', () => {
  for (const query of [
    { from: '2026-02-30' },
    { from: '2026-10-09', to: '2026-10-08' },
    { from: '2025-01-01', to: '2026-01-02' },
    { from: '2020-01-01' },
    { to: '2026-10-08', limit: 51 },
    { page: 0 },
    { memberId: 'private-profile' },
    { ageGroup: '24' },
    { includeTests: true },
    { recipeKey: '' },
  ])
    assert.equal(mealLogFiltersSchema.safeParse(query).success, false, JSON.stringify(query));
  assert.equal(mealLogFiltersSchema.safeParse({ from: '2025-01-01', to: '2026-01-01' }).success, true);
  assert.equal(mealLogFiltersSchema.parse({ includeTests: 'false' }).includeTests, false);
  assert.equal(mealLogFiltersSchema.parse({ includeTests: 'true' }).includeTests, true);
});

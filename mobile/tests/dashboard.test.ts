import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dailyIntake } from '../src/lib/dashboard.ts';
import type { HistoryEntry } from '../src/lib/contracts.ts';

const date = '2026-10-24';
const meal = {
  id: 'logged',
  status: 'DONE',
  loggedAt: '2026-10-23T17:00:00Z',
  calories: 300,
  proteinG: 15,
  carbsG: 40,
  fatG: 10,
} as HistoryEntry;
test('intake uses only done records on the selected Manila day and preserves missing-evidence labels', () => {
  const result = dailyIntake(
    [
      { ...meal, nutritionCompleteness: 'PARTIAL', provisionalCalories: 100 },
      { ...meal, id: 'skipped', status: 'SKIPPED' },
      { ...meal, id: 'unknown', status: undefined },
      { ...meal, id: 'different-day', loggedAt: '2026-10-24T16:00:00Z' },
    ],
    date
  );
  assert.equal(result.totals.calories, 300);
  assert.equal(result.totals.proteinG, 15);
  assert.equal(result.incomplete, true);
  assert.equal(result.provisional, 100);
  assert.equal(result.targets.calories, undefined);
  assert.equal(result.targets.proteinG, undefined);
});
test('saved targets remain independent of consumed meals; unavailable macro targets are never invented', () => {
  const meta = {
    planSnapshot: {
      dailyCalorieTarget: 2000,
      dailyMacroTargets: { [date]: { calories: 2000, proteinG: 95, carbsG: 250, fatG: 65 } },
    },
  };
  assert.deepEqual(dailyIntake([meal], date, meta, 1800).targets, dailyIntake([], date, meta, 1800).targets);
  const noMacros = dailyIntake([meal], date, undefined, 1800);
  assert.equal(noMacros.targets.calories, 1800);
  assert.equal(noMacros.targets.proteinG, undefined);
});

import { expect, it } from 'vitest';
import { calculateDashboardMetrics } from './model';
import type { MealPlan } from '@/types';

it('dashboard report targets remain fixed as planned meals change', () => {
  const meal = {
    id: 'a',
    scheduledDate: '2026-10-03T04:00:00Z',
    calories: 600,
    proteinG: 10,
    carbsG: 120,
    fatG: 10,
    mealLogs: [],
  } as unknown as MealPlan;
  const input = {
    activeDate: new Date('2026-10-03T04:00:00Z'),
    currentMeals: [meal],
    dailyCalorieTarget: 2000,
    dailyMacroTargets: { '2026-10-03': { calories: 2000, proteinG: 120, carbsG: 250, fatG: 58 } },
    outsideMealLogs: [],
    pendingMeals: [],
  };
  const metrics = calculateDashboardMetrics(input);
  expect(metrics.proteinTarget).toBe(120);
  expect(metrics.carbsTarget).toBe(250);
  expect(calculateDashboardMetrics({ ...input, currentMeals: [{ ...meal, proteinG: 80 }] }).proteinTarget).toBe(120);
  expect(calculateDashboardMetrics({ ...input, dailyMacroTargets: null }).proteinTarget).toBe(0);
});

it('retained intake contributes once without authorizing an old meal or counting skipped meals', () => {
  const old = {
    id: 'old',
    mealName: 'Saved intake',
    mealType: 'LUNCH',
    scheduledDate: '2026-10-03T04:00:00Z',
    status: 'DONE' as const,
    calories: 650,
    proteinG: 24,
    carbsG: 99,
    fatG: 21,
  };
  const input = {
    activeDate: new Date(old.scheduledDate),
    currentMeals: [],
    outsideMealLogs: [],
    pendingMeals: [],
    retainedMealLogs: [
      old,
      { ...old, id: 'skipped', status: 'SKIPPED' as const },
      { ...old, id: 'other-day', scheduledDate: '2026-10-04T04:00:00Z' },
    ],
  };
  const metrics = calculateDashboardMetrics(input);
  expect(metrics.caloriesConsumed).toBe(650);
  expect(metrics.proteinConsumed).toBe(24);
  expect(metrics.mealsList).toEqual([]);
  const same = { ...old, mealLogs: [{ status: 'DONE' }] } as unknown as MealPlan;
  expect(calculateDashboardMetrics({ ...input, currentMeals: [same] }).caloriesConsumed).toBe(650);
});

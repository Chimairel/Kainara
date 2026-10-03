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

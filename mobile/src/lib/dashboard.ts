import type { HistoryEntry, NutritionTotals, PlanMeta } from './contracts.ts';
import { finite, manilaDate } from './policies.ts';

/** Same seven-day window ending on the current cycle as the mobile PWA. */
export function dashboardDates(meals: { scheduledDate: string }[], cycleEnd?: string, today = manilaDate()) {
  const saved = meals.map((meal) => manilaDate(meal.scheduledDate));
  if (!saved.length && !cycleEnd) return [];
  const end = [cycleEnd ? manilaDate(cycleEnd) : saved.slice().sort().at(-1)!, today].sort().at(-1)!;
  const week = Array.from({ length: 7 }, (_, index) =>
    manilaDate(new Date(`${end}T12:00:00+08:00`).getTime() - (6 - index) * 86400000)
  );
  return Array.from(new Set([...week, ...saved])).sort();
}

/** Read saved intake and snapshot targets; never infer targets from today's menu. */
export function dailyIntake(history: HistoryEntry[], date: string, meta?: PlanMeta, fallbackCalories?: number) {
  const logged = history.filter((entry) => entry.status === 'DONE' && manilaDate(entry.loggedAt) === date);
  const totals: NutritionTotals = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  for (const entry of logged)
    for (const key of Object.keys(totals) as (keyof NutritionTotals)[]) totals[key] += finite(entry[key]);
  const saved = meta?.planSnapshot?.dailyMacroTargets?.[date];
  const targets = { ...saved, calories: meta?.planSnapshot?.dailyCalorieTarget ?? saved?.calories ?? fallbackCalories };
  return {
    totals,
    targets,
    provisional: logged.reduce((sum, entry) => sum + finite(entry.provisionalCalories), 0),
    incomplete: logged.some((entry) => entry.nutritionCompleteness && entry.nutritionCompleteness !== 'COMPLETE'),
  };
}

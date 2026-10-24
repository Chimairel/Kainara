import type { HistoryEntry, NutritionTotals, PlanMeta } from './contracts.ts';
import { finite, manilaDate } from './policies.ts';

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

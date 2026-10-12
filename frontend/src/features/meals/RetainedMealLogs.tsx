'use client';

import { DashboardMealRow } from '@/features/dashboard/DashboardMealRow';
import { getManilaDateKey } from '@/lib/manila-date';
import type { MealIngredient, MealPlan } from '@/types';

export type RetainedMealLog = {
  id: string;
  mealName: string;
  mealType: string;
  scheduledDate: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  status: 'DONE' | 'SKIPPED';
  ingredients?: Pick<MealIngredient, 'ingredientName' | 'category'>[];
} & Pick<MealPlan, 'image' | 'ricePortion'>;

/** Historical intake reuses meal presentation but never exposes current-plan actions. */
export default function RetainedMealLogs({ meals, dateKey }: { meals: RetainedMealLog[]; dateKey?: string }) {
  const visible = meals.filter((meal) => !dateKey || getManilaDateKey(meal.scheduledDate) === dateKey);
  if (!visible.length) return null;
  return (
    <ul className="space-y-4 pl-7 sm:pl-10 lg:pl-12" aria-label="Recorded meals">
      {visible.map((meal, index) => (
        <li key={meal.id}>
          <DashboardMealRow meal={meal} retained index={index} />
        </li>
      ))}
    </ul>
  );
}

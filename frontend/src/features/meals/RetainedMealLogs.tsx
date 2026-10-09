'use client';

import { Card } from '@/components/ui/Card';
import { formatManilaDate, getManilaDateKey } from '@/lib/manila-date';

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
};

/** Historical intake stays separate from meals authorized for the current profile. */
export default function RetainedMealLogs({ meals, dateKey }: { meals: RetainedMealLog[]; dateKey?: string }) {
  const visible = meals.filter((meal) => !dateKey || getManilaDateKey(meal.scheduledDate) === dateKey);
  if (!visible.length) return null;
  return (
    <Card className="space-y-4 text-left" aria-label="Meals already recorded">
      <div>
        <h3 className="font-display text-lg font-bold text-brand-text">Meals already recorded</h3>
        <p className="text-sm text-brand-muted">
          Preserved from your previous plan. These records do not authorize meals for your updated profile.
        </p>
      </div>
      <ul className="divide-y divide-brand-border">
        {visible.map((meal) => (
          <li key={meal.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="font-semibold text-brand-text">{meal.mealName}</p>
              <p className="text-xs text-brand-muted">
                {formatManilaDate(new Date(meal.scheduledDate), { month: 'short', day: 'numeric' })} ·{' '}
                {meal.mealType.toLowerCase()}
              </p>
            </div>
            <span className="text-sm text-brand-muted">
              {meal.status === 'DONE' ? `Eaten · ${Math.round(meal.calories)} kcal` : 'Skipped'}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

import { formatManilaDate, getManilaDateKey, manilaDateFromKey } from './manila-date';

/** Shared calendar identity for on-screen plans and their printable export. */
export function groupMealsByManilaDate<T extends { scheduledDate: string }>(
  meals: readonly T[],
  dateOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
) {
  const grouped = new Map<string, T[]>();
  for (const meal of meals) {
    const key = getManilaDateKey(meal.scheduledDate);
    const rows = grouped.get(key) ?? [];
    rows.push(meal);
    grouped.set(key, rows);
  }
  return [...grouped]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, mealsList]) => {
      const date = manilaDateFromKey(dateKey);
      return {
        dateKey,
        mealsList,
        weekday: formatManilaDate(date, { weekday: 'long' }),
        dateStr: formatManilaDate(date, dateOptions),
      };
    });
}

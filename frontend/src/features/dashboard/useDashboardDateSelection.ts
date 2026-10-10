import { useState } from 'react';
import { getManilaDateKey } from '@/lib/manila-date';

/** Keep the member's chosen date when polling replaces meal/date arrays. */
export function useDashboardDateSelection(dates: Date[], scopeKey: string) {
  const [selection, setSelection] = useState<{ scopeKey: string; dateKey: string } | null>(null);
  const keys = dates.map((date) => getManilaDateKey(date));
  const today = getManilaDateKey();
  const selectedIndex = selection?.scopeKey === scopeKey ? keys.indexOf(selection.dateKey) : -1;
  const todayIndex = keys.indexOf(today);
  const nextIndex = keys.findIndex((key) => key > today);
  const selectedDayOffset = selectedIndex >= 0 ? selectedIndex : todayIndex >= 0 ? todayIndex : Math.max(0, nextIndex);
  const setSelectedDayOffset = (index: number) => {
    if (keys[index]) setSelection({ scopeKey, dateKey: keys[index] });
  };
  return { selectedDayOffset, setSelectedDayOffset };
}

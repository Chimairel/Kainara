'use client';

import {
  ActivityTimeRange,
  MealActivityCalendarProps,
} from '@/features/meal-activity-calendar/MealActivityCalendar.shared';
export type { ActivityTimeRange, MonthColumnData } from '@/features/meal-activity-calendar/MealActivityCalendar.shared';
import { useMealActivityCalendarModel } from '@/features/meal-activity-calendar/useMealActivityCalendarModel';
import WeeklyActivityGrid from '@/features/meal-activity-calendar/WeeklyActivityGrid';
import MonthlyActivityGrid from '@/features/meal-activity-calendar/MonthlyActivityGrid';
import YearlyActivityGrid from '@/features/meal-activity-calendar/YearlyActivityGrid';
import ActivitySelectionLegend from '@/features/meal-activity-calendar/ActivitySelectionLegend';
export default function MealActivityCalendar({
  logs,
  selectedDateKey,
  onSelectDateKey,
  className = '',
}: MealActivityCalendarProps) {
  const model = useMealActivityCalendarModel({ logs, selectedDateKey, onSelectDateKey, className });

  const { timeRange, threeMonthsData, totalLoggedDays, setTimeRange } = model;
  return (
    <div
      className={`rounded-[26px] border border-brand-border bg-brand-surface p-5 sm:p-6 shadow-card text-left transition-colors dark:border-[#173e33] dark:bg-[#0e271f] ${className}`}
    >
      {/* Top Header */}
      <div className="flex flex-col gap-4 border-b border-brand-border/60 pb-5 dark:border-[#173e33] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h3 className="font-display text-lg sm:text-xl font-black tracking-tight text-brand-text dark:text-white">
            Activity Matrix
          </h3>
          <span className="inline-flex items-center rounded-full bg-brand-green/10 px-2.5 py-0.5 text-[10px] font-bold text-brand-green dark:bg-emerald-500/15 dark:text-emerald-400">
            {timeRange === 'Month'
              ? `${threeMonthsData.centerMonth.activeDaysCount} active days (month)`
              : `${totalLoggedDays} active days (${timeRange.toLowerCase()})`}
          </span>
        </div>

        {/* Time Range Filter Pills: Year, Month, Week */}
        <div className="flex items-center gap-1 rounded-2xl border border-brand-border bg-brand-bgAlt/50 p-1 dark:border-[#173e33] dark:bg-[#0b231c]/60">
          {(['Year', 'Month', 'Week'] as ActivityTimeRange[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setTimeRange(mode)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition-all duration-150 ${
                timeRange === mode
                  ? 'bg-brand-surface text-brand-text shadow-sm border border-brand-border dark:bg-[#13382c] dark:text-white dark:border-[#1e5a48]'
                  : 'text-brand-muted hover:text-brand-text dark:text-white/40 dark:hover:text-white'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Heatmap Matrix Body */}
      <div className="relative mt-5">
        {timeRange === 'Week' ? (
          /* Week Mode: 7-day horizontal cards */
          <WeeklyActivityGrid model={model} />
        ) : timeRange === 'Month' ? (
          /* Month Mode: 3 Months side-by-side on desktop, single centered month on mobile */
          <MonthlyActivityGrid model={model} />
        ) : (
          /* Year Mode: Full calendar year matrix */
          <YearlyActivityGrid model={model} />
        )}

        {/* Hover Tooltip Card / Status Bar */}
        <ActivitySelectionLegend model={model} />
      </div>
    </div>
  );
}

'use client';

import { Calendar as CalendarIcon } from 'lucide-react';
import { formatManilaDate, manilaDateFromKey } from '@/lib/manila-date';

import type { useMealActivityCalendarModel } from './useMealActivityCalendarModel';
type Model = Extract<ReturnType<typeof useMealActivityCalendarModel>, { kind: 'ready' }>;
type SectionProps = { model: Pick<Model, 'hoveredCell' | 'selectedDateKey'> };
export default function ActivitySelectionLegend({ model }: SectionProps) {
  const { hoveredCell, selectedDateKey } = model;

  return (
    <>
      <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-brand-border/50 bg-brand-bgAlt/40 p-3 dark:border-[#173e33] dark:bg-[#0b231c]/60 sm:flex-row sm:items-center sm:justify-between text-xs">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-3.5 w-3.5 text-brand-green" />
          {hoveredCell ? (
            <span className="font-semibold text-brand-text dark:text-white">
              <span className="font-bold text-brand-green">
                {formatManilaDate(hoveredCell.date, { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              {hoveredCell.isFuture ? (
                <span className="font-mono text-brand-muted dark:text-white/50"> : Upcoming (Locked)</span>
              ) : (
                <>
                  : {hoveredCell.mealCount} meal{hoveredCell.mealCount !== 1 ? 's' : ''} logged
                  {hoveredCell.mealCount > 0 && ` (${Math.round(hoveredCell.totalCalories)} kcal)`}
                </>
              )}
            </span>
          ) : selectedDateKey ? (
            <span className="font-semibold text-brand-text dark:text-white">
              Selected date:{' '}
              <span className="font-bold text-brand-green">
                {formatManilaDate(manilaDateFromKey(selectedDateKey), {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </span>
          ) : (
            <span className="text-brand-muted dark:text-white/50">
              Click any day in the calendar to view its logged meals below
            </span>
          )}
        </div>

        {/* Activity Scale Legend in NutriMind Theme Colors */}
        <div className="flex items-center gap-1.5 self-end sm:self-auto text-[10px] font-mono text-brand-muted dark:text-white/40">
          <span>Less</span>
          <span
            className="h-3 w-3 rounded-[3px] border border-brand-border/80 bg-brand-bgAlt/60 dark:border-[#173e33] dark:bg-[#0e271f]"
            title="0 meals"
          />
          <span
            className="h-3 w-3 rounded-[3px] border border-brand-green/40 bg-brand-green/20 dark:border-emerald-500/40 dark:bg-emerald-500/25"
            title="1 meal"
          />
          <span
            className="h-3 w-3 rounded-[3px] border border-brand-green/70 bg-brand-green/70 dark:border-emerald-400 dark:bg-emerald-600"
            title="2 meals"
          />
          <span
            className="h-3 w-3 rounded-[3px] border border-brand-green bg-brand-green shadow-sm shadow-brand-green/30 dark:border-emerald-300 dark:bg-emerald-500"
            title="3+ meals"
          />
          <span>More</span>
        </div>
      </div>
    </>
  );
}

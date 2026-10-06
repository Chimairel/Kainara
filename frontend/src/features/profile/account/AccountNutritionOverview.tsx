'use client';

import Card from '@/components/ui/Card';

import { Utensils, ChefHat, Compass } from 'lucide-react';

import type { useAccountSettingsModel } from './useAccountSettingsModel';
type Model = Extract<ReturnType<typeof useAccountSettingsModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<
    Model,
    | 'totalCompletedMeals'
    | 'insideRatio'
    | 'insideMealsCount'
    | 'outsideRatio'
    | 'outsideMealsCount'
    | 'trackedDaysCount'
  >;
};
export default function AccountNutritionOverview({ model }: SectionProps) {
  const { totalCompletedMeals, insideRatio, insideMealsCount, outsideRatio, outsideMealsCount, trackedDaysCount } =
    model;

  return (
    <>
      <Card className="overflow-hidden border-brand-border/70 bg-brand-surface p-5 sm:p-6 shadow-card">
        <div className="flex flex-col gap-2 border-b border-brand-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand-green/20 bg-brand-green/10 text-brand-green dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-400">
              <Utensils className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-display text-sm font-bold text-brand-text">Meals Inside vs Outside KAINARA</h3>
              <p className="text-[11px] text-brand-muted">
                Distribution of planned home nutrition vs logged outside dining
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-brand-border bg-brand-bgAlt px-3 py-1 font-mono text-[11px] font-semibold text-brand-text dark:border-white/[0.08] dark:bg-white/[0.04]">
              {totalCompletedMeals} total meal{totalCompletedMeals === 1 ? '' : 's'} recorded
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Inside Kainara Card */}
          <div className="relative overflow-hidden rounded-2xl border border-brand-green/25 bg-gradient-to-br from-brand-green/[0.06] to-transparent p-4 dark:border-emerald-500/20 dark:bg-emerald-950/15">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-green/15 text-brand-green dark:bg-emerald-500/20 dark:text-emerald-400">
                  <ChefHat className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-brand-text">Inside KAINARA</p>
                  <p className="text-[10px] text-brand-muted">Planned & prepared meals</p>
                </div>
              </div>
              <span className="rounded-full border border-brand-green/30 bg-brand-green/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-brand-green dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400">
                {insideRatio}%
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-3xl font-black text-brand-text">{insideMealsCount}</span>
              <span className="text-xs text-brand-muted">eaten to plan</span>
            </div>
          </div>

          {/* Outside Dining Card */}
          <div className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.06] to-transparent p-4 dark:border-amber-500/20 dark:bg-amber-950/15">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                  <Compass className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold text-brand-text">Outside Dining</p>
                  <p className="text-[10px] text-brand-muted">Restaurant & logged meals</p>
                </div>
              </div>
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-400">
                {outsideRatio}%
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-3xl font-black text-brand-text">{outsideMealsCount}</span>
              <span className="text-xs text-brand-muted">outside meals</span>
            </div>
          </div>
        </div>

        {/* Visual Ratio Progress Bar */}
        <div className="mt-5 space-y-2">
          <div className="flex justify-between text-[11px] font-semibold text-brand-muted">
            <span>Intake Ratio</span>
            <span>
              {totalCompletedMeals > 0
                ? `${insideRatio}% KAINARA · ${outsideRatio}% Outside`
                : 'No completed meals yet'}
            </span>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full border border-brand-border/60 bg-brand-bgAlt dark:border-white/[0.08] dark:bg-white/[0.04]">
            {totalCompletedMeals > 0 ? (
              <>
                <div
                  style={{ width: `${insideRatio}%` }}
                  className="h-full bg-brand-green transition-all duration-500 dark:bg-emerald-500"
                />
                <div
                  style={{ width: `${outsideRatio}%` }}
                  className="h-full bg-amber-500 transition-all duration-500"
                />
              </>
            ) : (
              <div className="h-full w-full bg-brand-muted/15" />
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[11px] text-brand-muted">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand-green dark:bg-emerald-500" />
                <span>Inside KAINARA ({insideMealsCount})</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                <span>Outside dining ({outsideMealsCount})</span>
              </span>
            </div>
            <span className="font-mono text-[10px] text-brand-muted">
              {trackedDaysCount} active tracking day{trackedDaysCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </Card>
    </>
  );
}

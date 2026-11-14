'use client';

import CardDecoration from '@/components/ui/CardDecoration';
import Link from 'next/link';

import { motion } from 'motion/react';
import { formatManilaDate, getManilaDateKey } from '@/lib/manila-date';
import type { MealPlan } from '@/types';
import type { PendingMealPreview } from '@/components/user/PendingMealPreviewCard';
import { DailyIntakeDonut, AnimatedValue } from '@/components/watermelon/daily-intake-donut';
import { DashboardMealRow } from './DashboardMealRow';
import type { RetainedMealLog } from '@/features/meals/RetainedMealLogs';
import { PreparingMealRow, type PreparingMealSlot } from './PreparingMealRow';

export interface CockpitDashboardProps {
  activeDate: Date;
  meals: MealPlan[];
  retainedMeals?: RetainedMealLog[];
  pendingMeals?: PendingMealPreview[];
  preparingSlots?: PreparingMealSlot[];
  metrics: {
    caloriesConsumed: number;
    caloriesTarget: number;
    proteinConsumed: number;
    proteinTarget: number;
    carbsConsumed: number;
    carbsTarget: number;
    fatConsumed: number;
    fatTarget: number;
    provisionalCalories: number;
    unresolvedMealCount: number;
  };
  waterIntake: number;
  onAddWater: (amount: number) => void;
  onMealClick: (mealId: string) => void;
  onStatusToggle?: (mealId: string, status: 'DONE' | 'SKIPPED' | 'PENDING') => Promise<void> | void;
  onOpenWeeklyPlan?: () => void;
}

export function CockpitDashboard({
  activeDate,
  meals,
  retainedMeals = [],
  pendingMeals = [],
  preparingSlots = [],
  metrics,
  waterIntake,
  onAddWater,
  onMealClick,
  onStatusToggle,
  onOpenWeeklyPlan,
}: CockpitDashboardProps) {
  const isToday = getManilaDateKey(activeDate) === getManilaDateKey();
  const mealOrder: Record<string, number> = { BREAKFAST: 0, LUNCH: 1, DINNER: 2, SNACK: 3 };
  const savedMenu = [
    ...meals.map((meal) => ({ meal, kind: 'active' as const })),
    ...pendingMeals.map((meal) => ({ meal, kind: 'pending' as const })),
    ...retainedMeals
      .filter((meal) => !meals.some((active) => active.id === meal.id))
      .map((meal) => ({ meal, kind: 'retained' as const })),
  ];
  const menu = [
    ...savedMenu,
    ...preparingSlots
      .filter((slot) => !savedMenu.some((entry) => entry.meal.mealType === slot.mealType))
      .map((meal) => ({ meal, kind: 'preparing' as const })),
  ].sort((left, right) => (mealOrder[left.meal.mealType] ?? 4) - (mealOrder[right.meal.mealType] ?? 4));
  const macros = [
    {
      label: 'Protein',
      consumed: metrics.proteinConsumed,
      target: metrics.proteinTarget,
      color: 'var(--macro-protein)',
    },
    { label: 'Carbs', consumed: metrics.carbsConsumed, target: metrics.carbsTarget, color: 'var(--macro-carbs)' },
    { label: 'Fat', consumed: metrics.fatConsumed, target: metrics.fatTarget, color: 'var(--macro-fat)' },
  ];
  return (
    <section aria-label="Daily nutrition" className="space-y-5">
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(360px,1fr)_minmax(0,1.4fr)]">
        <section
          aria-label="Nutrition summary"
          className="daily-intake-card relative overflow-hidden flex min-h-full flex-col justify-between rounded-2xl border border-brand-border p-4 sm:rounded-3xl sm:p-6"
        >
          {/* Retro Wave Organic Corner Accent (Top Right) - Connected with On your menu card */}
          <CardDecoration variant="intake" />

          <div className="relative z-10 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-brand-muted pl-1">Your daily intake</p>
                <span className="rounded-full border border-brand-border/70 dark:border-[#173e33] bg-brand-surface/90 dark:bg-[#071914]/90 px-2.5 py-0.5 text-[10px] font-bold text-[#eb6a38] dark:text-[#f09e6c] shadow-xs backdrop-blur-xs">
                  {isToday ? 'Today' : formatManilaDate(activeDate, { month: 'short', day: 'numeric' })}
                </span>
              </div>

              {/* Donut Gauge & Calorie Telemetry */}
              <div className="my-3 flex items-center gap-4 sm:my-6 sm:gap-6">
                <DailyIntakeDonut
                  consumed={metrics.caloriesConsumed}
                  target={metrics.caloriesTarget}
                  provisional={metrics.provisionalCalories}
                  size={152}
                  className="max-sm:!size-[92px] max-sm:[&>svg]:size-[92px]"
                />
                <div className="grid min-w-0 flex-1 grid-cols-2 items-start gap-x-2 gap-y-1 sm:block sm:space-y-3 max-[350px]:grid-cols-1">
                  {/* Consumed Stat */}
                  <div className="flex items-start gap-2.5">
                    <span className="mt-1.5 hidden h-2.5 w-2.5 shrink-0 rounded-full bg-brand-green shadow-[0_0_8px_rgba(18,129,100,0.5)] sm:block" />
                    <div className="flex flex-col">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">Consumed</p>
                      <div className="flex items-baseline gap-1">
                        <AnimatedValue
                          value={Math.round(metrics.caloriesConsumed)}
                          className="font-display text-2xl font-bold tracking-tight text-brand-text leading-tight"
                        />
                        <span className="text-xs font-semibold text-brand-muted">kcal</span>
                      </div>
                    </div>
                  </div>

                  {/* Estimated Outside Meals Stat (if any) */}
                  {metrics.provisionalCalories > 0 && (
                    <div className="col-span-full flex items-start gap-2.5 max-sm:order-last">
                      <span className="mt-1.5 hidden h-2.5 w-2.5 shrink-0 rounded-full bg-[#f59e0b] shadow-[0_0_8px_rgba(245,158,11,0.5)] sm:block" />
                      <div className="flex flex-col">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#f59e0b]">
                          Estimated (Outside)
                        </p>
                        <div className="flex items-baseline gap-1">
                          <AnimatedValue
                            value={Math.round(metrics.provisionalCalories)}
                            className="font-display text-lg font-bold tracking-tight text-[#f59e0b] leading-tight"
                          />
                          <span className="text-xs font-semibold text-[#f59e0b]/70">kcal</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Daily Target Stat */}
                  <div className="flex items-start gap-2.5">
                    <span className="mt-1.5 hidden h-2.5 w-2.5 shrink-0 rounded-full bg-brand-border dark:bg-zinc-700 sm:block" />
                    <div className="flex flex-col">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">Daily Target</p>
                      <div className="flex items-baseline gap-1">
                        <AnimatedValue
                          value={Math.round(metrics.caloriesTarget)}
                          className="font-display text-lg font-bold tracking-tight text-brand-muted leading-tight"
                        />
                        <span className="text-xs font-semibold text-brand-muted">kcal</span>
                      </div>
                    </div>
                  </div>

                  <p className="hidden whitespace-nowrap text-xs font-medium text-brand-green sm:block">Logged for this day</p>
                </div>
              </div>

              {/* Macro and water intake rows with swatches, rolling numbers and spring progress bars */}
              <div className="grid grid-cols-3 gap-x-3 gap-y-3 border-t border-brand-border pt-3 sm:block sm:space-y-4 sm:pt-5">
                {macros.map((macro) => (
                  <div key={macro.label}>
                    <div className="mb-1 flex flex-col gap-1 text-sm sm:mb-2 sm:flex-row sm:justify-between sm:gap-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: macro.color }} />
                        <span className="font-medium text-brand-text">{macro.label}</span>
                      </div>
                      <span className="flex flex-wrap items-baseline gap-x-1 font-mono text-xs text-brand-muted">
                        <strong className="text-brand-text font-bold">
                          <AnimatedValue
                            value={Math.round(macro.consumed)}
                            suffix="g"
                            className="font-bold text-brand-text"
                          />
                        </strong>{' '}
                        /{' '}
                        {macro.target > 0 ? (
                          <AnimatedValue value={Math.round(macro.target)} suffix="g" className="text-brand-muted" />
                        ) : (
                          <span className="w-full sm:w-auto">Estimate unavailable</span>
                        )}
                      </span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-brand-border/60 dark:bg-zinc-800"
                      aria-hidden="true"
                    >
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: macro.color }}
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.max(0, Math.min(100, (macro.consumed / Math.max(1, macro.target)) * 100))}%`,
                        }}
                        transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                      />
                    </div>
                  </div>
                ))}

                {/* Water row in the same format as protein, carb, fat */}
                {isToday ? (
                  <div aria-label="Water log" className="col-span-full">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 text-sm sm:gap-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-sky-400" />
                        <Link href="/progress#water-history" aria-label="View water history"
                          className="font-medium text-brand-text underline underline-offset-4 hover:text-brand-green focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-green">Water</Link>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="flex flex-wrap items-baseline gap-x-1 font-mono text-xs text-brand-muted">
                          <strong className="text-brand-text font-bold">
                            <AnimatedValue value={waterIntake} suffix=" mL" className="font-bold text-brand-text" />
                          </strong>{' '}
                          / <span className="text-brand-muted">2,000 mL</span>
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label="Remove 250 mL of water"
                            disabled={waterIntake <= 0}
                            onClick={() => onAddWater(-250)}
                            className="flex h-11 w-11 sm:h-5 sm:w-5 items-center justify-center rounded-md border border-brand-border/70 bg-brand-surface/70 text-xs font-bold text-brand-text hover:bg-brand-surface transition-all disabled:opacity-30 disabled:cursor-not-allowed leading-none"
                            title="Remove 250 mL"
                          >
                            −
                          </button>
                          <button
                            type="button"
                            aria-label="Add 250 mL of water"
                            onClick={() => onAddWater(250)}
                            className="flex h-11 w-11 sm:h-5 sm:w-5 items-center justify-center rounded-md bg-brand-green/20 hover:bg-brand-green/30 text-brand-green border border-brand-green/40 text-xs font-bold transition-all leading-none"
                            title="Add 250 mL"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-brand-border/60 dark:bg-zinc-800"
                      aria-hidden="true"
                    >
                      <motion.div
                        className="h-full rounded-full bg-sky-400"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.min(100, Math.max(0, (waterIntake / 2000) * 100))}%`,
                        }}
                        transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                      />
                    </div>
                  </div>
                ) : (
                  <p className="col-span-full text-xs text-brand-muted">
                    Water logging is available for today. Select today to update your intake.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-3 space-y-3 sm:mt-6">
              {metrics.provisionalCalories > 0 && (
                <p className="rounded-xl bg-status-pending-bg p-3 text-xs leading-relaxed text-status-pending-text">
                  Includes {Math.round(metrics.provisionalCalories)} provisional kcal from outside meals.
                </p>
              )}
              {metrics.unresolvedMealCount > 0 && (
                <p role="status" className="text-xs leading-relaxed text-status-pending-text">
                  {metrics.unresolvedMealCount} outside meal{metrics.unresolvedMealCount === 1 ? '' : 's'} with
                  incomplete nutrition. Unresolved items are excluded from totals.
                </p>
              )}
              <div className="flex items-center justify-between gap-2 rounded-xl bg-black/25 px-3 py-2 text-xs dark:bg-black/35 sm:rounded-2xl sm:px-4 sm:py-3">
                <span className="font-medium text-brand-muted">Remaining budget</span>
                <span className="font-mono font-bold text-brand-green flex items-center gap-1">
                  <AnimatedValue
                    value={Math.max(0, Math.round(metrics.caloriesTarget - metrics.caloriesConsumed))}
                    suffix=" kcal"
                    className="font-mono font-bold text-brand-green"
                  />
                </span>
              </div>
            </div>
          </div>
        </section>
        <section aria-label="Scheduled meals" className="flex min-h-full min-w-0 flex-col justify-between">
          <div className="mb-3 flex items-center justify-between gap-3 px-0.5 sm:mb-4 sm:px-1">
            <div>
              <p className="text-xs font-semibold text-brand-green">
                {formatManilaDate(activeDate, { weekday: 'long', month: 'short', day: 'numeric' })}
              </p>
              <h2 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-brand-text">On your menu</h2>
            </div>
            {onOpenWeeklyPlan && menu.length > 0 && (
              <button type="button" onClick={onOpenWeeklyPlan} className="min-h-11 px-2 text-sm font-semibold text-brand-green sm:hidden">
                View plan
              </button>
            )}
          </div>
          <div className="member-item-rail member-menu-rail flex-1 sm:space-y-4 sm:pl-10 lg:pl-12">
            {menu.map((entry, index) =>
              entry.kind === 'preparing' ? (
                <PreparingMealRow key={`preparing-${entry.meal.mealType}`} mealType={entry.meal.mealType} />
              ) : entry.kind === 'pending' ? (
                <DashboardMealRow
                  key={`pending-${entry.meal.mealType}-${index}`}
                  meal={entry.meal}
                  index={index}
                  inMenu
                  pending
                />
              ) : entry.kind === 'retained' ? (
                <DashboardMealRow key={entry.meal.id} meal={entry.meal} index={index} inMenu retained />
              ) : (
                <DashboardMealRow
                  key={entry.meal.id}
                  meal={entry.meal}
                  index={index}
                  inMenu
                  onOpen={() => onMealClick(entry.meal.id)}
                  onStatusToggle={onStatusToggle}
                />
              )
            )}
          </div>
          {menu.length === 0 && (
            <p className="rounded-2xl border border-brand-border/70 bg-brand-surface p-6 text-sm text-brand-muted text-center shadow-card sm:ml-10 lg:ml-12">
              No meals scheduled for this day. Open your weekly plan to view another day.
            </p>
          )}
        </section>
      </div>
    </section>
  );
}

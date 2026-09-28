'use client';

import Link from 'next/link';
import { Calendar, Droplets, Scale, ClipboardCheck, ArrowUpRight, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { formatManilaDate } from '@/lib/manila-date';
import type { MealPlan, MealLocalityPreference } from '@/types';
import type { PendingMealPreview } from '@/components/user/PendingMealPreviewCard';
import type { UserProfileData } from '@/hooks/useProfile';
import { DailyIntakeDonut, AnimatedValue } from '@/components/watermelon/daily-intake-donut';
import MealLocalityPreferenceControl from '@/components/user/MealLocalityPreferenceControl';
import { DashboardMealRow } from './DashboardMealRow';

export interface CockpitDashboardProps {
  activeDate: Date;
  meals: MealPlan[];
  pendingMeals?: PendingMealPreview[];
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
  profile: UserProfileData['userProfile'];
  waterIntake: number;
  checkinStreak: number;
  checkinDue: boolean;
  onAddWater: (amount: number) => void;
  onOpenCheckin: () => void;
  onMealClick: (mealId: string) => void;
  onStatusToggle?: (mealId: string, status: 'DONE' | 'SKIPPED' | 'PENDING') => Promise<void> | void;
  onOpenWeeklyPlan: () => void;
  onUpdateLocality?: (preference: MealLocalityPreference) => void;
}

export function CockpitDashboard({
  activeDate,
  meals,
  pendingMeals = [],
  metrics,
  profile,
  waterIntake,
  checkinStreak,
  checkinDue,
  onAddWater,
  onOpenCheckin,
  onMealClick,
  onStatusToggle,
  onOpenWeeklyPlan,
  onUpdateLocality,
}: CockpitDashboardProps) {
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
      <div className="grid gap-5 xl:grid-cols-[minmax(360px,1fr)_minmax(0,1.4fr)]">
        <section
          aria-label="Nutrition summary"
          className="daily-intake-card relative overflow-hidden flex min-h-full flex-col justify-between rounded-3xl border border-brand-border p-5 sm:p-6"
        >
          {/* Retro Wave Organic Corner Accent (Top Right) - Connected with On your menu card */}
          <div className="pointer-events-none absolute -top-0.5 -right-0.5 h-32 w-32 overflow-hidden rounded-tr-3xl z-0">
            <svg viewBox="0 0 160 160" className="h-full w-full" fill="none" aria-hidden="true">
              <path d="M160,0 L0,0 C20,40 55,95 120,135 C140,147 160,155 160,155 Z" fill="#eb6a38" />
              <path d="M160,0 L40,0 C55,30 80,72 130,105 C145,115 160,120 160,120 Z" fill="#f09e6c" />
              <path d="M160,0 L82,0 C92,20 110,48 142,70 C152,76 160,80 160,80 Z" className="fill-[#1b4e41] dark:fill-[#164639]" />
            </svg>
          </div>

          <div className="relative z-10 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-brand-muted pl-1">Your daily intake</p>
                <span className="rounded-full border border-brand-border/70 dark:border-[#173e33] bg-brand-surface/90 dark:bg-[#071914]/90 px-2.5 py-0.5 text-[10px] font-bold text-[#eb6a38] dark:text-[#f09e6c] shadow-xs backdrop-blur-xs">
                  Today
                </span>
              </div>

            {/* Donut Gauge & Calorie Telemetry */}
            <div className="my-6 flex items-center gap-5 sm:gap-6">
              <DailyIntakeDonut
                consumed={metrics.caloriesConsumed}
                target={metrics.caloriesTarget}
                provisional={metrics.provisionalCalories}
                size={152}
              />
              <div className="min-w-0 flex-1 space-y-3">
                {/* Consumed Stat */}
                <div className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-green shadow-[0_0_8px_rgba(18,129,100,0.5)]" />
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
                  <div className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#8c3b00] shadow-[0_0_8px_rgba(140,59,0,0.5)]" />
                    <div className="flex flex-col">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#8c3b00] dark:text-[#ff8a3d]">
                        Estimated (Outside)
                      </p>
                      <div className="flex items-baseline gap-1">
                        <AnimatedValue
                          value={Math.round(metrics.provisionalCalories)}
                          className="font-display text-lg font-bold tracking-tight text-[#8c3b00] dark:text-[#ff8a3d] leading-tight"
                        />
                        <span className="text-xs font-semibold text-[#8c3b00]/70 dark:text-[#ff8a3d]/70">kcal</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Daily Target Stat */}
                <div className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-border dark:bg-zinc-700" />
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

                <p className="text-xs font-medium text-brand-green whitespace-nowrap">Logged for this day</p>
              </div>
            </div>

            {/* Macro rows with swatches, rolling numbers and spring progress bars */}
            <div className="space-y-4 border-t border-brand-border pt-5">
              {macros.map((macro) => (
                <div key={macro.label}>
                  <div className="mb-2 flex justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: macro.color }} />
                      <span className="font-medium text-brand-text">{macro.label}</span>
                    </div>
                    <span className="text-brand-muted font-mono text-xs flex items-center gap-1">
                      <strong className="text-brand-text font-bold">
                        <AnimatedValue
                          value={Math.round(macro.consumed)}
                          suffix="g"
                          className="font-bold text-brand-text"
                        />
                      </strong>{' '}
                      / <AnimatedValue value={Math.round(macro.target)} suffix="g" className="text-brand-muted" />
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
            </div>

            {/* Integrated Water Log Module */}
            <div
              className="mt-5 rounded-2xl border border-brand-border/60 bg-black/20 dark:bg-black/30 p-3.5 backdrop-blur-xs"
              aria-label="Water log"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
                    <Droplets className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">Water intake</p>
                    <p className="font-display text-base font-bold text-brand-text leading-tight">
                      <AnimatedValue value={waterIntake} suffix=" mL" />
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Remove 250 mL of water"
                    disabled={waterIntake <= 0}
                    onClick={() => onAddWater(-250)}
                    className="h-8 rounded-lg border border-brand-border/70 bg-brand-surface/70 px-2.5 text-xs font-bold text-brand-text hover:bg-brand-surface transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    −250 mL
                  </button>
                  <button
                    type="button"
                    aria-label="Add 250 mL of water"
                    onClick={() => onAddWater(250)}
                    className="h-8 rounded-lg bg-brand-green/20 hover:bg-brand-green/30 text-brand-green border border-brand-green/40 px-2.5 text-xs font-bold transition-all flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" />
                    250 mL
                  </button>
                </div>
              </div>

              {/* Water progress bar toward 2,000 mL baseline */}
              <div className="mt-2.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-brand-border/40 dark:bg-zinc-800">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-sky-500 to-teal-400"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(100, Math.max(0, (waterIntake / 2000) * 100))}%`,
                    }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                  />
                </div>
                <span className="font-mono text-[10px] font-semibold text-brand-muted shrink-0">
                  {Math.round((waterIntake / 2000) * 100)}%
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {metrics.provisionalCalories > 0 && (
              <p className="rounded-xl bg-status-pending-bg p-3 text-xs leading-relaxed text-status-pending-text">
                Includes {Math.round(metrics.provisionalCalories)} provisional kcal from outside meals.
              </p>
            )}
            {metrics.unresolvedMealCount > 0 && (
              <p role="status" className="text-xs leading-relaxed text-status-pending-text">
                {metrics.unresolvedMealCount} outside meal{metrics.unresolvedMealCount === 1 ? '' : 's'} with incomplete
                nutrition. Unresolved items are excluded from totals.
              </p>
            )}
            <div className="flex items-center justify-between rounded-2xl bg-black/25 dark:bg-black/35 px-4 py-3 text-xs">
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
        <section
          aria-label="Scheduled meals"
          className="flex min-h-full min-w-0 flex-col justify-between"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-1">
            <div>
              <p className="text-xs font-semibold text-brand-green">
                {formatManilaDate(activeDate, { weekday: 'long', month: 'short', day: 'numeric' })}
              </p>
              <h2 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-brand-text">On your menu</h2>
            </div>
            <button
              type="button"
              onClick={onOpenWeeklyPlan}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-brand-border/80 dark:border-[#173e33] bg-brand-surface dark:bg-[#0e271f] px-3.5 text-xs font-bold text-brand-green shadow-xs hover:border-brand-green hover:shadow-sm transition-all"
            >
              <Calendar className="h-4 w-4" /> Weekly plan
            </button>
          </div>
          {pendingMeals.length > 0 && (
            <p className="mb-4 rounded-2xl border border-status-pending-text/20 bg-status-pending-bg/50 p-3.5 text-xs leading-relaxed text-status-pending-text ml-7 sm:ml-10 lg:ml-12">
              Awaiting review: pending meals are previews. Open a preview to see its ingredients; logging becomes
              available after approval.
            </p>
          )}
          <div className="space-y-4 flex-1 pl-7 sm:pl-10 lg:pl-12">
            {meals.map((meal, index) => (
              <DashboardMealRow
                key={meal.id}
                meal={meal}
                index={index}
                onOpen={() => onMealClick(meal.id)}
                onStatusToggle={onStatusToggle}
              />
            ))}
            {pendingMeals.map((meal, index) => (
              <DashboardMealRow
                key={`${meal.mealType}-${index}`}
                meal={meal}
                index={meals.length + index}
                pending
              />
            ))}
          </div>
          {meals.length === 0 && pendingMeals.length === 0 && (
            <p className="rounded-2xl border border-brand-border/70 bg-brand-surface p-6 text-sm text-brand-muted text-center shadow-card ml-7 sm:ml-10 lg:ml-12">
              No meals scheduled for this day. Open your weekly plan to view another day.
            </p>
          )}
        </section>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <MealLocalityPreferenceControl
          value={profile?.mealLocalityPreference ?? 'NATIONAL'}
          regionName={profile?.planningRegionName ?? ''}
          provinceHucName={profile?.planningProvinceHucName ?? ''}
          onChange={onUpdateLocality ?? (() => {})}
          compact
        />
        <Link
          href="/progress"
          className="dashboard-surface dashboard-stat group rounded-2xl p-5 transition-colors hover:border-brand-green"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-muted">
            <Scale className="h-4 w-4 text-brand-green" /> Weight & progress{' '}
            <ArrowUpRight className="ml-auto h-4 w-4" />
          </div>
          <p className="mt-3 font-display text-2xl font-bold text-brand-text">
            {profile?.weightKg ?? '—'} <span className="text-sm font-medium text-brand-muted">kg</span>
          </p>
          <p className="mt-2 text-xs text-brand-muted">
            {profile?.targetWeightKg ? `Goal: ${profile.targetWeightKg} kg` : 'View your weight history and goals'}
          </p>
          <p className="mt-4 text-sm font-semibold text-brand-green">Record your progress →</p>
        </Link>
        <section className="dashboard-surface dashboard-stat rounded-2xl p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-muted">
            <ClipboardCheck className="h-4 w-4 text-brand-green" /> Weekly check-in
          </div>
          <p className="mt-3 font-display text-2xl font-bold text-brand-text">
            {checkinDue ? 'Ready for you' : 'Up to date'}
          </p>
          <p className="mt-2 text-xs text-brand-muted">
            {checkinStreak} week{checkinStreak === 1 ? '' : 's'} in your check-in streak
          </p>
          {checkinDue ? (
            <button
              type="button"
              onClick={onOpenCheckin}
              className="mt-3 min-h-11 rounded-xl bg-brand-accent px-4 text-sm font-extrabold text-[#07100d] shadow-neon hover:brightness-105 transition-all"
            >
              Start check-in →
            </button>
          ) : (
            <Link href="/profile/health" className="mt-4 inline-block text-sm font-semibold text-brand-green">
              Update health profile →
            </Link>
          )}
        </section>
      </div>
    </section>
  );
}

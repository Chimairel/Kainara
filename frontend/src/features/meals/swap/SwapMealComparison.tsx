'use client';

import { dashboardMealCardClasses, DashboardMealPlate } from '@/components/user/DashboardMealCardSurface';
import { formatMealTitle } from '@/lib/meal-title';

import MealImage from '@/components/user/MealImage';

import { ArrowDown, ArrowRight, Sparkles, UtensilsCrossed, X } from 'lucide-react';
import { formatManilaDate } from '@/lib/manila-date';

import type { useMealsWorkspaceModalsModel } from './useMealsWorkspaceModalsModel';
type Model = Extract<ReturnType<typeof useMealsWorkspaceModalsModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<
    Model,
    | 'currentTheme'
    | 'activeSwapMeal'
    | 'confirmSwapMeal'
    | 'replacementTheme'
    | 'isSwapping'
    | 'setConfirmSwapMeal'
    | 'setSwapPreview'
    | 'setGroceryDeltaAcknowledged'
  >;
};
export default function SwapMealComparison({ model }: SectionProps) {
  const {
    currentTheme,
    activeSwapMeal,
    confirmSwapMeal,
    replacementTheme,
    isSwapping,
    setConfirmSwapMeal,
    setSwapPreview,
    setGroceryDeltaAcknowledged,
  } = model;
  if (!activeSwapMeal) return null;
  return (
    <>
      <div
        role="group"
        aria-label="Meal swap comparison"
        className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-3 pb-3 border-b border-brand-border/60"
      >
        {/* Left Card: Current Meal */}
        <div
          className={`dashboard-meal relative min-w-0 overflow-hidden flex h-52 flex-col justify-between rounded-[22px] p-3.5 sm:p-4 text-white shadow-md ${currentTheme?.cardBg} ${currentTheme?.borderColor}`}
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white/80">
                {activeSwapMeal.mealType.toLowerCase()}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide backdrop-blur-md border border-white/25 bg-black/25 text-white shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-white/70" />
                <span>Current Meal</span>
              </span>
            </div>

            <div className="flex items-center gap-3 sm:gap-3.5">
              <DashboardMealPlate
                className={`relative h-16 w-16 sm:h-18 sm:w-18 shrink-0 rounded-full p-1 sm:p-1.5 bg-white dark:bg-[#12362c] shadow-[0_8px_20px_-3px_rgba(0,0,0,0.25),0_3px_8px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_24px_rgba(0,0,0,0.7)] ${currentTheme?.plateRim} z-10`}
              >
                <MealImage
                  image={activeSwapMeal.image}
                  mealName={activeSwapMeal.mealName}
                  mealType={activeSwapMeal.mealType}
                  variant="thumbnail"
                  className="!rounded-full !border-0 h-full w-full object-cover"
                />
              </DashboardMealPlate>
              <div className="min-w-0 flex-1">
                <h4
                  title={formatMealTitle(activeSwapMeal.mealName)}
                  className="h-10 sm:h-11 font-display text-sm sm:text-base font-bold text-white line-clamp-2 leading-snug break-words"
                >
                  {formatMealTitle(activeSwapMeal.mealName)}
                </h4>
                {activeSwapMeal.ricePortion && (
                  <p title={activeSwapMeal.ricePortion} className="text-[11px] font-bold text-white/95 mt-0.5 truncate">
                    + {activeSwapMeal.ricePortion}
                  </p>
                )}
                <p className="text-[10.5px] text-white/75 mt-0.5">
                  {formatManilaDate(activeSwapMeal.scheduledDate, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-white/20">
            <p className="text-[11px] sm:text-xs font-medium text-white/90">
              <strong className="text-white font-bold">{Math.round(activeSwapMeal.calories)}</strong> kcal ·{' '}
              <strong className="text-white font-bold">{Math.round(activeSwapMeal.proteinG)}g</strong> protein ·{' '}
              <strong className="text-white font-bold">{Math.round(activeSwapMeal.carbsG)}g</strong> carbs ·{' '}
              <strong className="text-white font-bold">{Math.round(activeSwapMeal.fatG)}g</strong> fat
            </p>
          </div>
        </div>

        {/* Center Connector */}
        <div className="flex md:flex-col items-center justify-center gap-1.5 py-1 md:py-0 self-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-brand-border/80 bg-brand-surface dark:bg-[#0a201a] text-brand-green dark:text-brand-accent shadow-xs">
            <ArrowRight className="h-4 w-4 hidden md:block" />
            <ArrowDown className="h-4 w-4 md:hidden" />
          </div>
          {confirmSwapMeal && (
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-extrabold shadow-2xs ${
                Math.abs(Math.round(confirmSwapMeal.calories - activeSwapMeal.calories)) <= 50
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                  : Math.round(confirmSwapMeal.calories - activeSwapMeal.calories) > 0
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
              }`}
            >
              {Math.round(confirmSwapMeal.calories - activeSwapMeal.calories) >= 0 ? '+' : ''}
              {Math.round(confirmSwapMeal.calories - activeSwapMeal.calories)} kcal
            </span>
          )}
        </div>

        {/* Right Card: Selected Candidate or Prompt */}
        {confirmSwapMeal && replacementTheme ? (
          <div
            className={`${dashboardMealCardClasses(confirmSwapMeal.mealType ?? activeSwapMeal.mealType)} min-w-0 flex h-52 flex-col justify-between rounded-[22px] p-3.5 sm:p-4`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="min-w-0 truncate text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white/80">
                  {(confirmSwapMeal.mealType || activeSwapMeal.mealType).toLowerCase()}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide backdrop-blur-md border border-white/30 bg-white/20 text-white shadow-xs">
                    <Sparkles className="h-3 w-3 text-amber-300" />
                    <span>Selected Replacement</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (isSwapping) return;
                      setConfirmSwapMeal(null);
                      setSwapPreview(null);
                      setGroceryDeltaAcknowledged(false);
                    }}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-black/30 hover:bg-black/50 text-white/80 hover:text-white border border-white/20 transition-colors"
                    title="Clear selection"
                    aria-label="Clear selection"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 sm:gap-3.5">
                <DashboardMealPlate
                  className={`relative h-16 w-16 sm:h-18 sm:w-18 shrink-0 rounded-full p-1 sm:p-1.5 bg-white dark:bg-[#12362c] shadow-[0_8px_20px_-3px_rgba(0,0,0,0.25),0_3px_8px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_24px_rgba(0,0,0,0.7)] ${replacementTheme.plateRim} z-10`}
                >
                  <MealImage
                    image={confirmSwapMeal.image}
                    mealName={confirmSwapMeal.mealName}
                    mealType={confirmSwapMeal.mealType ?? undefined}
                    variant="thumbnail"
                    className="!rounded-full !border-0 h-full w-full object-cover"
                  />
                </DashboardMealPlate>
                <div className="min-w-0 flex-1">
                  <h4
                    title={formatMealTitle(confirmSwapMeal.mealName)}
                    className="h-10 sm:h-11 font-display text-sm sm:text-base font-bold text-white line-clamp-2 leading-snug break-words"
                  >
                    {formatMealTitle(confirmSwapMeal.mealName)}
                  </h4>
                  <p
                    title={confirmSwapMeal.servingDescription || 'One recipe serving'}
                    className="text-[11px] font-bold text-white/95 mt-0.5 truncate"
                  >
                    {confirmSwapMeal.servingDescription || 'One recipe serving'}
                    {confirmSwapMeal.alreadyPlannedInCycle ? ' · In plan' : ''}
                  </p>
                  <p className="text-[10.5px] text-white/75 mt-0.5 truncate">Ready to compare & confirm</p>
                </div>
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-white/20">
              <p className="text-[11px] sm:text-xs font-medium text-white/90">
                <strong className="text-white font-bold">{Math.round(confirmSwapMeal.calories)}</strong> kcal ·{' '}
                <strong className="text-white font-bold">{Math.round(confirmSwapMeal.proteinG)}g</strong> protein ·{' '}
                <strong className="text-white font-bold">{Math.round(confirmSwapMeal.carbsG)}g</strong> carbs ·{' '}
                <strong className="text-white font-bold">{Math.round(confirmSwapMeal.fatG)}g</strong> fat
              </p>
            </div>
          </div>
        ) : (
          <div className="min-w-0 flex h-52 flex-col items-center justify-center rounded-[22px] border-2 border-dashed border-brand-border/90 bg-brand-surface/40 dark:bg-brand-surface/20 p-4 text-center">
            <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full border-2 border-dashed border-brand-border/90 bg-brand-surface/80 dark:bg-[#071914] text-brand-muted mb-2 shadow-xs">
              <UtensilsCrossed className="h-6 w-6 text-brand-muted/70" />
            </div>
            <p className="text-xs sm:text-sm font-bold text-brand-text">Select a replacement meal below</p>
            <p className="text-[11px] text-brand-muted mt-0.5 max-w-[260px] leading-relaxed">
              Click any plate from the mini library to compare nutrition and balance your day.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

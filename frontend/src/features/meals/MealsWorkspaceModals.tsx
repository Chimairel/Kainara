'use client';

import { formatMealTitle } from '@/lib/meal-title';
import { useState, useMemo, useEffect } from 'react';
import Button from '@/components/ui/Button';
import MealImage from '@/components/user/MealImage';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import NutritionistCredentialModal from '@/components/user/NutritionistCredentialModal';
import { AlertTriangle, ArrowDown, ArrowRight, Check, Sparkles, Soup, UtensilsCrossed, X } from 'lucide-react';
import { formatManilaDate } from '@/lib/manila-date';
import { useMealsWorkspace } from './useMealsWorkspace';
import SwapImpactDetails from './SwapImpactDetails';
import { swapNutritionLabel } from './swap-nutrition-label';
import { getMealTheme } from '@/features/dashboard/DashboardMealRow';

type Props = { workspace: ReturnType<typeof useMealsWorkspace> };

type MiniSortOption = 'best_match' | 'kcal_match';

export function MealsWorkspaceModals({ workspace }: Props) {
  const [groceryDeltaAcknowledged, setGroceryDeltaAcknowledged] = useState(false);
  const [miniSort, setMiniSort] = useState<MiniSortOption>('best_match');

  const {
    activeSwapMeal,
    setActiveSwapMeal,
    swapOptions,
    setSwapOptions,
    isOptionsLoading,
    swapOptionsError,
    setSwapOptionsError,
    confirmSwapMeal,
    setConfirmSwapMeal,
    isSwapping,
    swapPreview,
    setSwapPreview,
    isCheckingPreview,
    previewError,
    selectedVerifier,
    setSelectedVerifier,
    handleSelectSwapOption,
    handleConfirmSwapAnyway,
  } = workspace;

  // Reset the comparison when a different slot opens.
  useEffect(() => {
    if (activeSwapMeal) {
      setMiniSort('best_match');
      setGroceryDeltaAcknowledged(false);
    }
  }, [activeSwapMeal]);

  // Only show the options evaluated for this exact plan slot. The general
  // library can contain recipes that fail its calorie or rice-serving checks.
  const filteredAndSortedOptions = useMemo(() => {
    if (!activeSwapMeal) return [];
    let items = swapOptions.filter((option) => option.id !== activeSwapMeal.libraryMealId);

    // The slot fixes meal time; users cannot broaden it to other meal types.
    items = items.filter((item) =>
      (item.mealTypes?.length ? item.mealTypes : [item.mealType]).includes(activeSwapMeal.mealType)
    );

    // Rank against the report estimates for the planned day, including fresh rice.
    const currentCal = activeSwapMeal.calories;
    return items.sort((a, b) => {
      if (miniSort === 'kcal_match') {
        return (
          Math.abs(a.calories - currentCal) - Math.abs(b.calories - currentCal) || a.mealName.localeCompare(b.mealName)
        );
      }
      if (miniSort === 'best_match') {
        const fit = (a.nutritionFitScore ?? Number.MAX_SAFE_INTEGER) - (b.nutritionFitScore ?? Number.MAX_SAFE_INTEGER);
        if (fit !== 0) return fit;
        const deltaA = Math.abs(a.calories - currentCal);
        const deltaB = Math.abs(b.calories - currentCal);
        if (deltaA !== deltaB) return deltaA - deltaB;
        return a.mealName.localeCompare(b.mealName);
      }
      return 0;
    });
  }, [activeSwapMeal, swapOptions, miniSort]);

  const currentTheme = activeSwapMeal ? getMealTheme(activeSwapMeal.mealType) : null;
  const replacementTheme = confirmSwapMeal ? getMealTheme(confirmSwapMeal.mealType || activeSwapMeal?.mealType) : null;

  return (
    <>
      {selectedVerifier && (
        <NutritionistCredentialModal
          isOpen={true}
          onClose={() => setSelectedVerifier(null)}
          verifier={selectedVerifier}
        />
      )}

      {/* Swap Options Modal */}
      {activeSwapMeal && (
        <Modal
          isOpen={true}
          onClose={() => {
            if (isSwapping) return;
            setActiveSwapMeal(null);
            setSwapOptions([]);
            setConfirmSwapMeal(null);
            setSwapOptionsError(null);
            setSwapPreview(null);
          }}
          title={`Swap ${formatMealTitle(activeSwapMeal.mealName)}`}
          description={`Replace the whole ${activeSwapMeal.mealType.toLowerCase()} plate, including any rice. Each option includes a freshly calculated rice portion where suitable; nutrition totals include rice.`}
          size="3xl"
        >
          <div className="space-y-4 text-left" aria-busy={isSwapping}>
            {/* TOP ROW: BALANCED COMPARISON STAGE */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-stretch gap-3 pb-3 border-b border-brand-border/60">
              {/* Left Card: Current Meal */}
              <div
                className={`dashboard-meal relative overflow-hidden flex flex-col justify-between rounded-[22px] p-3.5 sm:p-4 text-white shadow-md ${currentTheme?.cardBg} ${currentTheme?.borderColor} min-h-[156px]`}
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
                    <div
                      className={`relative h-16 w-16 sm:h-18 sm:w-18 shrink-0 rounded-full p-1 sm:p-1.5 bg-white dark:bg-[#12362c] shadow-[0_8px_20px_-3px_rgba(0,0,0,0.25),0_3px_8px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_24px_rgba(0,0,0,0.7)] ${currentTheme?.plateRim} z-10`}
                    >
                      <div className="relative h-full w-full rounded-full overflow-hidden">
                        <MealImage
                          image={activeSwapMeal.image}
                          mealName={activeSwapMeal.mealName}
                          mealType={activeSwapMeal.mealType}
                          variant="thumbnail"
                          className="!rounded-full !border-0 h-full w-full object-cover"
                        />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-display text-sm sm:text-base font-bold text-white line-clamp-2 leading-snug min-h-[2.5rem] flex items-start">
                        {formatMealTitle(activeSwapMeal.mealName)}
                      </h4>
                      {activeSwapMeal.ricePortion && (
                        <p className="text-[11px] font-bold text-white/95 mt-0.5">
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
                  className={`dashboard-meal relative overflow-hidden flex flex-col justify-between rounded-[22px] p-3.5 sm:p-4 text-white shadow-md ${replacementTheme.cardBg} ${replacementTheme.borderColor} min-h-[156px]`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white/80">
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
                      <div
                        className={`relative h-16 w-16 sm:h-18 sm:w-18 shrink-0 rounded-full p-1 sm:p-1.5 bg-white dark:bg-[#12362c] shadow-[0_8px_20px_-3px_rgba(0,0,0,0.25),0_3px_8px_rgba(0,0,0,0.1)] dark:shadow-[0_10px_24px_rgba(0,0,0,0.7)] ${replacementTheme.plateRim} z-10`}
                      >
                        <div className="relative h-full w-full rounded-full overflow-hidden">
                          <MealImage
                            image={confirmSwapMeal.image}
                            mealName={confirmSwapMeal.mealName}
                            mealType={confirmSwapMeal.mealType ?? undefined}
                            variant="thumbnail"
                            className="!rounded-full !border-0 h-full w-full object-cover"
                          />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-display text-sm sm:text-base font-bold text-white line-clamp-2 leading-snug min-h-[2.5rem] flex items-start">
                          {formatMealTitle(confirmSwapMeal.mealName)}
                        </h4>
                        <p className="text-[11px] font-bold text-white/95 mt-0.5 truncate">
                          {confirmSwapMeal.servingDescription || 'One recipe serving'}
                          {confirmSwapMeal.alreadyPlannedInCycle ? ' · In plan' : ''}
                        </p>
                        <p className="text-[10.5px] text-white/75 mt-0.5 truncate">
                          Ready to compare & confirm
                        </p>
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
                <div className="flex flex-col items-center justify-center rounded-[22px] border-2 border-dashed border-brand-border/90 bg-brand-surface/40 dark:bg-brand-surface/20 p-4 text-center min-h-[156px]">
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

            {/* DEDICATED SWAP IMPACT SECTION */}
            {confirmSwapMeal && (
              <div className="relative overflow-hidden rounded-[24px] border border-brand-border/80 bg-gradient-to-br from-brand-surface via-brand-surface/95 to-brand-bgAlt/50 p-4 sm:p-5 shadow-xs space-y-3.5">
                {/* Bottom Corner Stripe Accent */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-2 -left-2 z-0 h-20 w-20 select-none opacity-20 dark:opacity-15"
                >
                  <svg viewBox="0 0 96 96" fill="none" className="h-full w-full block">
                    <path d="M 88 104 C 80 52 44 16 -8 8" stroke="#f09e6c" strokeWidth="12" strokeLinecap="round" />
                    <path d="M 72 104 C 66 62 34 30 -8 24" stroke="#eb6a38" strokeWidth="10" strokeLinecap="round" />
                  </svg>
                </div>

                <div className="relative z-10 space-y-3">
                  {/* Preview status & Warnings */}
                  {isCheckingPreview ? (
                    <div className="flex items-center justify-center gap-2 py-3 text-xs font-semibold text-brand-muted">
                      <LoadingSpinner size="sm" />
                      <span>Projecting daily balance & grocery impact...</span>
                    </div>
                  ) : previewError ? (
                    <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-600 dark:text-red-400">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>{previewError}</span>
                    </div>
                  ) : swapPreview ? (
                    <div className="space-y-3">
                      {swapPreview.warningRequired && (
                        <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                          <span>
                            <span className="font-bold">Notice:</span> Day total will be{' '}
                            <span className="font-extrabold">{swapPreview.projectedDayTotal} kcal</span> (target:{' '}
                            {swapPreview.dailyTarget} kcal).
                          </span>
                        </div>
                      )}

                      <SwapImpactDetails
                        analysis={swapPreview.nutritionAnalysis}
                        additions={swapPreview.shoppingNeeds}
                        removals={swapPreview.shoppingRemovals}
                      />

                      {swapPreview.groceryDeltaAcknowledgmentRequired && (
                        <label className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-semibold cursor-pointer text-amber-900 dark:text-amber-200">
                          <input
                            disabled={isSwapping}
                            type="checkbox"
                            checked={groceryDeltaAcknowledged}
                            onChange={(e) => setGroceryDeltaAcknowledged(e.target.checked)}
                            className="mt-0.5 rounded border-amber-400 text-brand-green focus:ring-brand-green"
                          />
                          <span>I reviewed the grocery changes above. Shopping has already started.</span>
                        </label>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* BOTTOM SECTION: MINI MEAL LIBRARY BROWSER */}
            <div className="space-y-3 pt-1">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-sm font-bold text-brand-text">Mini Meal Library</h3>
                  <span className="rounded-full bg-brand-bgAlt border border-brand-border/60 px-2 py-0.5 font-mono text-[10px] font-bold text-brand-muted">
                    {filteredAndSortedOptions.length} available
                  </span>
                </div>
              </div>

              <div className="flex justify-end text-xs">
                <select
                  disabled={isSwapping}
                  value={miniSort}
                  onChange={(event) => setMiniSort(event.target.value as MiniSortOption)}
                  className="h-9 rounded-xl border border-brand-border bg-brand-surface px-2.5 text-xs font-medium text-brand-text outline-none focus:border-brand-green"
                  aria-label="Sort mini library recipes"
                >
                  <option value="best_match">Nutrition match</option>
                  <option value="kcal_match">Kcal match</option>
                </select>
              </div>

              <p className="text-[11px] text-brand-muted">
                {miniSort === 'best_match'
                  ? 'Ranked against your report targets for the planned day, including rice. The closest option can still leave macro gaps.'
                  : 'Ranked by calories for the whole plate. Protein, carbs and fat can differ.'}
              </p>
              {miniSort === 'best_match' &&
                filteredAndSortedOptions.length > 0 &&
                filteredAndSortedOptions.every((option) => option.nutritionMatch === 'GAPS_REMAIN') && (
                  <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                    Closest available — macro gaps remain
                  </p>
                )}

              {/* Recipe Cards Grid */}
              <div className="max-h-[44vh] overflow-y-auto pr-1 mt-2">
                {isOptionsLoading ? (
                  <div className="flex flex-col items-center py-12 gap-2">
                    <LoadingSpinner size="md" />
                    <span className="text-xs text-brand-muted font-semibold">
                      Loading compatible replacement plates...
                    </span>
                  </div>
                ) : swapOptionsError ? (
                  <div className="p-3 bg-red-950/20 border border-red-900/60 rounded-xl text-xs text-red-400">
                    {swapOptionsError}
                  </div>
                ) : filteredAndSortedOptions.length === 0 ? (
                  <div className="p-8 text-center border border-brand-border/40 bg-brand-surface/30 rounded-2xl">
                    <Soup className="w-7 h-7 text-brand-green mx-auto mb-2 opacity-70" />
                    <p className="text-xs font-bold text-brand-text">No eligible replacement plates</p>
                    <p className="text-[11px] text-brand-muted mt-0.5">
                      {swapOptions.length
                        ? "Try selecting 'All Types' or resetting search and rice role filters."
                        : 'No available plate meets this meal slot’s calorie, rice preference and review requirements.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {filteredAndSortedOptions.map((option) => {
                      const isSelected = confirmSwapMeal?.id === option.id;
                      const delta = Math.round(option.calories - activeSwapMeal.calories);
                      return (
                        <div
                          key={option.id}
                          role="button"
                          tabIndex={isSwapping ? -1 : 0}
                          aria-disabled={isSwapping}
                          onClick={() => {
                            if (isSwapping) return;
                            setGroceryDeltaAcknowledged(false);
                            handleSelectSwapOption(option);
                          }}
                          onKeyDown={(e) => {
                            if (isSwapping) return;
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setGroceryDeltaAcknowledged(false);
                              handleSelectSwapOption(option);
                            }
                          }}
                          className={`group relative flex flex-col justify-between rounded-xl border p-3 transition-all cursor-pointer text-left outline-none ${
                            isSelected
                              ? 'border-brand-green ring-2 ring-brand-green/30 bg-brand-green/[0.05] dark:border-brand-accent dark:ring-brand-accent/30 dark:bg-brand-accent/[0.05]'
                              : 'border-brand-border/80 bg-brand-surface/60 hover:border-brand-green/50 hover:bg-brand-surface shadow-xs'
                          }`}
                        >
                          {/* Card Content Top */}
                          <div>
                            <div className="flex items-start gap-2.5">
                              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-brand-border/60 shadow-xs">
                                <MealImage
                                  image={option.image}
                                  mealName={option.mealName}
                                  mealType={option.mealType ?? undefined}
                                  variant="thumbnail"
                                />
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-brand-muted truncate">
                                    {(option.mealTypes?.length ? option.mealTypes : [option.mealType]).join(' · ')}
                                  </span>
                                  {isSelected && (
                                    <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-green px-1.5 py-0.2 font-mono text-[8px] font-extrabold uppercase text-white dark:bg-brand-accent dark:text-black">
                                      <Check className="h-2.5 w-2.5 stroke-[3]" /> Selected
                                    </span>
                                  )}
                                </div>

                                <h4 className="font-display text-xs font-bold text-brand-text truncate leading-snug mt-0.5 group-hover:text-brand-green dark:group-hover:text-brand-accent">
                                  {formatMealTitle(option.mealName)}
                                </h4>

                                <p className="text-[10px] text-brand-muted mt-0.5">
                                  {option.ricePortionLabel
                                    ? `+ ${option.ricePortionLabel}`
                                    : option.riceRole === 'PAIR_WITH_RICE'
                                      ? 'Pair with rice'
                                      : option.riceRole === 'INCLUDES_RICE'
                                        ? 'Rice included'
                                        : option.riceRole === 'STANDALONE'
                                          ? 'Standalone'
                                          : 'Rice role unavailable'}
                                  {option.alreadyPlannedInCycle ? ' · In plan' : ''}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Card Content Bottom: Macros & Verifier */}
                          <div className="mt-2.5 border-t border-brand-border/40 pt-1.5 space-y-1">
                            {miniSort === 'best_match' && (
                              <p
                                className={`text-[10px] ${option.nutritionMatch === 'CLOSE' ? 'text-brand-green dark:text-brand-accent' : 'text-brand-muted'}`}
                              >
                                {swapNutritionLabel(option.nutritionMatch)}
                              </p>
                            )}
                            <div className="flex items-center justify-between font-mono text-[10px]">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-brand-text">{Math.round(option.calories)} kcal</span>
                                <span
                                  className={`font-extrabold ${
                                    delta === 0
                                      ? 'text-brand-muted'
                                      : delta > 0
                                        ? 'text-amber-700 dark:text-amber-300'
                                        : 'text-emerald-700 dark:text-emerald-300'
                                  }`}
                                >
                                  ({delta >= 0 ? `+${delta}` : delta})
                                </span>
                              </div>

                              <div className="flex items-center gap-1 text-[9px] font-bold text-brand-muted">
                                <span>{Math.round(option.proteinG)}P</span>
                                <span>·</span>
                                <span>{Math.round(option.carbsG)}C</span>
                                <span>·</span>
                                <span>{Math.round(option.fatG)}F</span>
                              </div>
                            </div>

                            {/* Verifier Badge */}
                            <div className="flex items-center justify-between text-[9px] text-brand-muted pt-0.5">
                              <span className="truncate">
                                {option.reuseBasis === 'PANLASANG_GENERAL_BASE' ? 'Source: ' : 'Verified by: '}
                                {option.verifier ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedVerifier(option.verifier!);
                                    }}
                                    className="text-brand-green dark:text-brand-accent font-bold hover:underline"
                                  >
                                    {option.verifiedBy}
                                  </button>
                                ) : (
                                  <span className="text-brand-green dark:text-brand-accent font-bold">
                                    {option.verifiedBy || 'KAINARA Clinical'}
                                  </span>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* STICKY BOTTOM CONFIRMATION ACTION BAR */}
            {confirmSwapMeal && (
              <div className="sticky -bottom-6 -mx-6 px-6 py-3.5 bg-brand-surface/95 dark:bg-[#071914]/95 backdrop-blur-md border-t border-brand-border/80 shadow-lg z-30 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-brand-muted hidden sm:flex items-center gap-2">
                  {swapPreview?.warningRequired ? (
                    <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-semibold">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                      Notice: Planning estimate differences detected
                    </span>
                  ) : isCheckingPreview ? (
                    <span className="flex items-center gap-1.5 text-brand-muted">
                      <LoadingSpinner size="sm" />
                      Calculating daily balance...
                    </span>
                  ) : swapPreview?.groceryDeltaAcknowledgmentRequired && !groceryDeltaAcknowledged ? (
                    <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 font-semibold">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                      Grocery review acknowledgment required
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                      <Check className="h-3.5 w-3.5" />
                      Plate compatible with daily schedule
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setConfirmSwapMeal(null);
                      setSwapPreview(null);
                      setGroceryDeltaAcknowledged(false);
                    }}
                    disabled={isSwapping}
                    className="text-xs h-9 px-4"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleConfirmSwapAnyway(groceryDeltaAcknowledged)}
                    disabled={
                      isSwapping ||
                      isCheckingPreview ||
                      !swapPreview ||
                      (Boolean(swapPreview?.groceryDeltaAcknowledgmentRequired) && !groceryDeltaAcknowledged)
                    }
                    className="text-xs font-bold h-9 px-5 shadow-sm"
                  >
                    Confirm Swap
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

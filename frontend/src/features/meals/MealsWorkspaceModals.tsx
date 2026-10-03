'use client';

import { formatMealTitle } from '@/lib/meal-title';
import { useState, useMemo, useEffect } from 'react';
import Button from '@/components/ui/Button';
import MealImage from '@/components/user/MealImage';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import NutritionistCredentialModal from '@/components/user/NutritionistCredentialModal';
import { AlertTriangle, ArrowRight, Check, Sparkles, Soup, UtensilsCrossed } from 'lucide-react';
import { formatManilaDate } from '@/lib/manila-date';
import { useMealsWorkspace } from './useMealsWorkspace';
import SwapImpactDetails from './SwapImpactDetails';
import { swapNutritionLabel } from './swap-nutrition-label';

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
          size="2xl"
        >
          <div className="space-y-4 text-left" aria-busy={isSwapping}>
            {/* TOP ROW: COMPARISON SECTION */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-stretch gap-3 pb-4 border-b border-brand-border/60">
              {/* Left Card: Current Meal */}
              <div className="flex flex-col justify-between rounded-2xl border border-brand-border/80 bg-brand-surface/70 p-3.5 shadow-xs">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-brand-muted">
                      Current Meal
                    </span>
                    <span className="rounded-full bg-brand-green/10 dark:bg-brand-accent/15 px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-brand-green dark:text-brand-accent">
                      {activeSwapMeal.mealType}
                    </span>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-brand-border/60 shadow-xs">
                      <MealImage
                        image={activeSwapMeal.image}
                        mealName={activeSwapMeal.mealName}
                        mealType={activeSwapMeal.mealType}
                        variant="thumbnail"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-display text-sm font-bold text-brand-text truncate leading-snug">
                        {formatMealTitle(activeSwapMeal.mealName)}
                      </h4>
                      {activeSwapMeal.ricePortion && (
                        <p className="text-[11px] text-brand-green mt-0.5">+ {activeSwapMeal.ricePortion}</p>
                      )}
                      <p className="text-[11px] text-brand-muted mt-0.5">
                        {formatManilaDate(activeSwapMeal.scheduledDate, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[10px] font-bold">
                        <span className="rounded-md bg-brand-bgAlt px-2 py-0.5 text-brand-text">
                          {Math.round(activeSwapMeal.calories)} kcal
                        </span>
                        <span className="rounded-md px-1.5 py-0.5 text-amber-700 dark:text-amber-400 bg-amber-500/10">
                          {Math.round(activeSwapMeal.proteinG)}g P
                        </span>
                        <span className="rounded-md px-1.5 py-0.5 text-sky-700 dark:text-sky-400 bg-sky-500/10">
                          {Math.round(activeSwapMeal.carbsG)}g C
                        </span>
                        <span className="rounded-md px-1.5 py-0.5 text-rose-700 dark:text-rose-400 bg-rose-500/10">
                          {Math.round(activeSwapMeal.fatG)}g F
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Center Arrow */}
              <div className="hidden md:flex flex-col items-center justify-center px-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-border/80 bg-brand-bgAlt/80 text-brand-green dark:text-brand-accent shadow-xs">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>

              {/* Right Card: Selected Candidate or Prompt */}
              {confirmSwapMeal ? (
                <div className="flex flex-col justify-between rounded-2xl border-2 border-brand-green/60 bg-brand-green/[0.03] dark:border-brand-accent/60 dark:bg-brand-accent/[0.04] p-3.5 shadow-xs">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase tracking-wider text-brand-green dark:text-brand-accent">
                        <Sparkles className="h-3 w-3" /> Selected Replacement
                      </span>
                      {(() => {
                        const delta = Math.round(confirmSwapMeal.calories - activeSwapMeal.calories);
                        const isNeutral = Math.abs(delta) <= 50;
                        return (
                          <span
                            className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-extrabold ${
                              isNeutral
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : delta > 0
                                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            {delta >= 0 ? `+${delta}` : delta} kcal
                          </span>
                        );
                      })()}
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-brand-border/60 shadow-xs">
                        <MealImage
                          image={confirmSwapMeal.image}
                          mealName={confirmSwapMeal.mealName}
                          mealType={confirmSwapMeal.mealType ?? undefined}
                          variant="thumbnail"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-display text-sm font-bold text-brand-text truncate leading-snug">
                          {formatMealTitle(confirmSwapMeal.mealName)}
                        </h4>
                        <p className="text-[11px] text-brand-muted mt-0.5">
                          {confirmSwapMeal.servingDescription || 'One recipe serving'}
                          {confirmSwapMeal.alreadyPlannedInCycle ? ' · In plan' : ''}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[10px] font-bold">
                          <span className="rounded-md bg-brand-bgAlt px-2 py-0.5 text-brand-text">
                            {Math.round(confirmSwapMeal.calories)} kcal
                          </span>
                          <span className="rounded-md px-1.5 py-0.5 text-amber-700 dark:text-amber-400 bg-amber-500/10">
                            {Math.round(confirmSwapMeal.proteinG)}g P
                          </span>
                          <span className="rounded-md px-1.5 py-0.5 text-sky-700 dark:text-sky-400 bg-sky-500/10">
                            {Math.round(confirmSwapMeal.carbsG)}g C
                          </span>
                          <span className="rounded-md px-1.5 py-0.5 text-rose-700 dark:text-rose-400 bg-rose-500/10">
                            {Math.round(confirmSwapMeal.fatG)}g F
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Preview status & Warnings */}
                    {isCheckingPreview ? (
                      <div className="mt-2 flex items-center gap-2 text-xs text-brand-muted py-1">
                        <LoadingSpinner size="sm" />
                        <span>Projecting daily balance...</span>
                      </div>
                    ) : previewError ? (
                      <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-600 dark:text-red-400">
                        {previewError}
                      </div>
                    ) : swapPreview ? (
                      <div className="mt-2 space-y-1.5 text-[11px]">
                        {swapPreview.warningRequired && (
                          <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-amber-800 dark:text-amber-300">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
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
                          <label className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs font-semibold cursor-pointer">
                            <input
                              disabled={isSwapping}
                              type="checkbox"
                              checked={groceryDeltaAcknowledged}
                              onChange={(e) => setGroceryDeltaAcknowledged(e.target.checked)}
                              className="mt-0.5"
                            />
                            <span>I reviewed the grocery changes above. Shopping has already started.</span>
                          </label>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {/* Confirmation Buttons */}
                  <div className="mt-3 flex items-center justify-end gap-2 pt-2 border-t border-brand-border/40">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setConfirmSwapMeal(null);
                        setSwapPreview(null);
                        setGroceryDeltaAcknowledged(false);
                      }}
                      disabled={isSwapping}
                      className="text-xs h-8 px-3"
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
                      className="text-xs font-bold h-8 px-4"
                    >
                      Confirm Swap
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-brand-border/90 bg-brand-bgAlt/30 p-5 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-surface border border-brand-border/80 text-brand-muted mb-2">
                    <UtensilsCrossed className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-bold text-brand-text">Select a replacement meal below</p>
                  <p className="text-[11px] text-brand-muted mt-0.5 max-w-[220px]">
                    Click any recipe from the mini library to compare nutrition and confirm your swap.
                  </p>
                </div>
              )}
            </div>

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
          </div>
        </Modal>
      )}
    </>
  );
}

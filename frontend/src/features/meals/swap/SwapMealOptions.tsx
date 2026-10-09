'use client';
import Dropdown from '@/components/ui/Dropdown';
import { dashboardMealCardClasses, DashboardMealPlate } from '@/components/user/DashboardMealCardSurface';
import { formatMealTitle } from '@/lib/meal-title';

import MealImage from '@/components/user/MealImage';

import LoadingSpinner from '@/components/shared/LoadingSpinner';

import { Check, Soup } from 'lucide-react';

import { swapNutritionLabel } from '../swap-nutrition-label';
import { getMealTheme } from '@/features/dashboard/DashboardMealRow';
import { MiniSortOption } from './MealsWorkspaceModals.shared';
import type { useMealsWorkspaceModalsModel } from './useMealsWorkspaceModalsModel';
type Model = Extract<ReturnType<typeof useMealsWorkspaceModalsModel>, { kind: 'ready' }>;
type SectionProps = {
  calorieSortOnly?: boolean;
  model: Pick<
    Model,
    | 'filteredAndSortedOptions'
    | 'isSwapping'
    | 'miniSort'
    | 'setMiniSort'
    | 'isOptionsLoading'
    | 'swapOptionsError'
    | 'swapOptions'
    | 'confirmSwapMeal'
    | 'setGroceryDeltaAcknowledged'
    | 'handleSelectSwapOption'
    | 'setSelectedVerifier'
  > & { activeSwapMeal: { mealType: string; calories: number } | null };
};
export default function SwapMealOptions({ model, calorieSortOnly = false }: SectionProps) {
  const {
    filteredAndSortedOptions,
    isSwapping,
    miniSort,
    setMiniSort,
    isOptionsLoading,
    swapOptionsError,
    swapOptions,
    confirmSwapMeal,
    activeSwapMeal,
    setGroceryDeltaAcknowledged,
    handleSelectSwapOption,
    setSelectedVerifier,
  } = model;
  if (!activeSwapMeal) return null;
  return (
    <>
      <div className="space-y-3 pt-1">
        {/* Header */}
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="font-display text-sm font-bold text-brand-text">Mini Meal Library</h3>
            <span className="rounded-full bg-brand-bgAlt border border-brand-border/60 px-2 py-0.5 font-mono text-[10px] font-bold text-brand-muted">
              {filteredAndSortedOptions.length} available
            </span>
          </div>
          <div className="ml-auto w-[152px] shrink-0 text-xs sm:w-40">
            <Dropdown
              disabled={isSwapping}
              value={miniSort}
              onChange={(event) => setMiniSort(event as MiniSortOption)}
              className="h-9 rounded-xl border border-brand-border bg-brand-surface px-2.5 text-xs font-medium text-brand-text outline-none focus:border-brand-green"
              aria-label="Sort mini library recipes"
            >
              {!calorieSortOnly && <option value="best_match">Nutrition match</option>}
              <option value="kcal_match">Kcal match</option>
            </Dropdown>
          </div>
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
              <span className="text-xs text-brand-muted font-semibold">Loading compatible replacement plates...</span>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredAndSortedOptions.map((option) => {
                const isSelected = confirmSwapMeal?.id === option.id;
                const delta = Math.round(option.calories - activeSwapMeal.calories);
                const optionTheme = getMealTheme(option.mealType || activeSwapMeal.mealType);
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
                    className={`${dashboardMealCardClasses(option.mealType ?? activeSwapMeal.mealType)} flex flex-col justify-between rounded-[20px] p-3 sm:p-3.5 transition-all cursor-pointer text-left outline-none ${
                      isSelected
                        ? 'ring-2 ring-white/90 shadow-md scale-[1.01]'
                        : 'hover:brightness-105 hover:shadow-md'
                    }`}
                  >
                    {/* Card Content Top: Header + Badge */}
                    <div>
                      <div className="flex items-center justify-between gap-1.5 mb-2">
                        <span className="text-[9.5px] sm:text-[10px] font-bold uppercase tracking-wider text-white/80 truncate">
                          {(option.mealTypes?.length ? option.mealTypes : [option.mealType || activeSwapMeal.mealType])
                            .join(' · ')
                            .toLowerCase()}
                        </span>
                        {isSelected ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/25 backdrop-blur-md border border-white/40 px-2 py-0.5 font-mono text-[8.5px] font-extrabold uppercase text-white shadow-xs">
                            <Check className="h-2.5 w-2.5 stroke-[3]" /> Selected
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[9px] font-extrabold backdrop-blur-md border shadow-2xs ${
                              Math.abs(delta) <= 50
                                ? 'border-white/20 bg-black/25 text-white'
                                : delta > 0
                                  ? 'border-amber-300/30 bg-amber-400/20 text-amber-200'
                                  : 'border-emerald-300/30 bg-emerald-400/20 text-emerald-200'
                            }`}
                          >
                            {delta >= 0 ? `+${delta}` : delta} kcal
                          </span>
                        )}
                      </div>

                      {/* Plate + Info Layout */}
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        {/* Signature Circular Food Plate */}
                        <DashboardMealPlate
                          className={`relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 rounded-full p-1 bg-white dark:bg-[#12362c] shadow-[0_6px_16px_-2px_rgba(0,0,0,0.22),0_2px_6px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_20px_rgba(0,0,0,0.65)] ${optionTheme.plateRim} z-10 transition-transform duration-200 group-hover:scale-105`}
                        >
                          <MealImage
                            image={option.image}
                            mealName={option.mealName}
                            mealType={option.mealType ?? undefined}
                            variant="thumbnail"
                            className="!rounded-full !border-0 h-full w-full object-cover"
                          />
                        </DashboardMealPlate>

                        <div className="min-w-0 flex-1">
                          <h4 className="font-display text-xs sm:text-sm font-bold text-white line-clamp-2 leading-snug group-hover:underline underline-offset-2">
                            {formatMealTitle(option.mealName)}
                          </h4>

                          <p className="text-[10.5px] font-bold text-white/95 mt-0.5 truncate">
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

                          {miniSort === 'best_match' ? (
                            <p
                              className={`text-[9.5px] truncate mt-0.5 ${
                                option.nutritionMatch === 'CLOSE' ? 'text-white font-semibold' : 'text-white/75'
                              }`}
                            >
                              {swapNutritionLabel(option.nutritionMatch)}
                            </p>
                          ) : (
                            <p className="text-[9.5px] text-white/75 truncate mt-0.5">Closest calorie match</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Content Bottom: Macros & Verifier */}
                    <div className="mt-2.5 border-t border-white/20 pt-1.5 space-y-1">
                      <div className="flex items-center justify-between text-white/90">
                        <p className="text-[10px] sm:text-[10.5px] font-medium truncate">
                          <strong className="text-white font-bold">{Math.round(option.calories)}</strong> kcal ·{' '}
                          <strong className="text-white font-bold">{Math.round(option.proteinG)}g</strong> P ·{' '}
                          <strong className="text-white font-bold">{Math.round(option.carbsG)}g</strong> C ·{' '}
                          <strong className="text-white font-bold">{Math.round(option.fatG)}g</strong> F
                        </p>
                      </div>

                      {/* Verifier / Source Badge */}
                      <div className="flex items-center justify-between text-[9px] text-white/75 pt-0.5">
                        <span className="truncate">
                          {option.reuseBasis === 'PANLASANG_GENERAL_BASE' ? 'Source: ' : 'Verified by: '}
                          {option.verifier ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedVerifier(option.verifier!);
                              }}
                              className="text-white font-bold underline hover:text-white/90"
                            >
                              {option.verifiedBy}
                            </button>
                          ) : (
                            <span className="text-white font-bold">{option.verifiedBy || 'Name not recorded'}</span>
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
    </>
  );
}

'use client';

import { useState, useMemo, useEffect } from 'react';
import Button from '@/components/ui/Button';
import MealImage from '@/components/user/MealImage';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import NutritionistCredentialModal from '@/components/user/NutritionistCredentialModal';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Heart,
  Search,
  Sparkles,
  Soup,
  UtensilsCrossed,
} from 'lucide-react';
import { formatManilaDate } from '@/lib/manila-date';
import { useMealsWorkspace, type SwapOption } from './useMealsWorkspace';

type Props = { workspace: ReturnType<typeof useMealsWorkspace> };

type MiniSortOption = 'best_match' | 'cal_asc' | 'cal_desc' | 'alpha';

export function MealsWorkspaceModals({ workspace }: Props) {
  const [groceryDeltaAcknowledged, setGroceryDeltaAcknowledged] = useState(false);
  const [miniMealType, setMiniMealType] = useState<string>('All');
  const [miniSearch, setMiniSearch] = useState<string>('');
  const [miniRiceRole, setMiniRiceRole] = useState<string>('All');
  const [miniFavoriteOnly, setMiniFavoriteOnly] = useState<boolean>(false);
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
    toggleSwapFavorite,
    libraryMeals,
  } = workspace;

  // Whenever activeSwapMeal opens or changes, pre-filter mini library to current slot's meal type
  useEffect(() => {
    if (activeSwapMeal) {
      setMiniMealType(activeSwapMeal.mealType || 'All');
      setMiniSearch('');
      setMiniRiceRole('All');
      setMiniFavoriteOnly(false);
      setMiniSort('best_match');
      setGroceryDeltaAcknowledged(false);
    }
  }, [activeSwapMeal]);

  // Merge slot swap options with library meals so the mini library is never blank
  const filteredAndSortedOptions = useMemo(() => {
    if (!activeSwapMeal) return [];

    const poolMap = new Map<string, SwapOption>();
    for (const opt of swapOptions) {
      if (opt.id !== activeSwapMeal.id) {
        poolMap.set(opt.id, opt);
      }
    }
    for (const lib of libraryMeals) {
      if (lib.id !== activeSwapMeal.id && !poolMap.has(lib.id)) {
        poolMap.set(lib.id, lib);
      }
    }
    let items = Array.from(poolMap.values());

    // 1. Filter by mealType
    if (miniMealType !== 'All') {
      items = items.filter((item) => {
        const types = (item.mealTypes?.length ? item.mealTypes : [item.mealType]) as string[];
        return types.includes(miniMealType);
      });
    }

    // 2. Filter by search
    if (miniSearch.trim()) {
      const q = miniSearch.trim().toLowerCase();
      items = items.filter(
        (item) =>
          item.mealName.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q))
      );
    }

    // 3. Filter by riceRole
    if (miniRiceRole !== 'All') {
      items = items.filter((item) => item.riceRole === miniRiceRole);
    }

    // 4. Filter by favorite
    if (miniFavoriteOnly) {
      items = items.filter((item) => item.isFavorite);
    }

    // 5. Sort options (defaults to best calorie match)
    const currentCal = activeSwapMeal.calories;
    return items.sort((a, b) => {
      if (miniSort === 'best_match') {
        const deltaA = Math.abs(a.calories - currentCal);
        const deltaB = Math.abs(b.calories - currentCal);
        if (deltaA !== deltaB) return deltaA - deltaB;
        if (a.isFavorite && !b.isFavorite) return -1;
        if (!a.isFavorite && b.isFavorite) return 1;
        return a.mealName.localeCompare(b.mealName);
      }
      if (miniSort === 'cal_asc') return a.calories - b.calories;
      if (miniSort === 'cal_desc') return b.calories - a.calories;
      if (miniSort === 'alpha') return a.mealName.localeCompare(b.mealName);
      return 0;
    });
  }, [
    activeSwapMeal,
    swapOptions,
    libraryMeals,
    miniMealType,
    miniSearch,
    miniRiceRole,
    miniFavoriteOnly,
    miniSort,
  ]);

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
            setActiveSwapMeal(null);
            setSwapOptions([]);
            setConfirmSwapMeal(null);
            setSwapOptionsError(null);
            setSwapPreview(null);
          }}
          title={`Swap ${activeSwapMeal.mealName}`}
          description={`Select a verified replacement meal from your library for ${activeSwapMeal.mealType}.`}
          size="2xl"
        >
          <div className="space-y-4 text-left">
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
                        hideRepresentativeBadge
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-display text-sm font-bold text-brand-text truncate leading-snug">
                        {activeSwapMeal.mealName}
                      </h4>
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
                          hideRepresentativeBadge
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-display text-sm font-bold text-brand-text truncate leading-snug">
                          {confirmSwapMeal.mealName}
                        </h4>
                        <p className="text-[11px] text-brand-muted mt-0.5 line-clamp-1">
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
                        {swapPreview.groceryDeltaAcknowledgmentRequired && (
                          <label className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs font-semibold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={groceryDeltaAcknowledged}
                              onChange={(e) => setGroceryDeltaAcknowledged(e.target.checked)}
                              className="mt-0.5"
                            />
                            <span>Shopping started. I reviewed my grocery additions/removals.</span>
                          </label>
                        )}
                        {swapPreview.shoppingNeeds.length > 0 && (
                          <p className="text-[10px] text-brand-muted">
                            +{swapPreview.shoppingNeeds.length} item
                            {swapPreview.shoppingNeeds.length > 1 ? 's' : ''} will be added to groceries.
                          </p>
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
                        (Boolean(swapPreview?.groceryDeltaAcknowledgmentRequired) && !groceryDeltaAcknowledged)
                      }
                      className="text-xs font-bold h-8 px-4"
                    >
                      {isSwapping ? 'Swapping...' : 'Confirm Swap'}
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
              {/* Header with Title and Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-sm font-bold text-brand-text">Mini Meal Library</h3>
                  <span className="rounded-full bg-brand-bgAlt border border-brand-border/60 px-2 py-0.5 font-mono text-[10px] font-bold text-brand-muted">
                    {filteredAndSortedOptions.length} available
                  </span>
                </div>

                {/* Meal Type Filter Chips */}
                <div className="flex items-center gap-1 overflow-x-auto rounded-xl bg-brand-bgAlt/70 p-1 select-none">
                  {['All', 'BREAKFAST', 'LUNCH', 'DINNER'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setMiniMealType(type)}
                      className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                        miniMealType === type
                          ? 'bg-brand-green text-white dark:bg-brand-accent dark:text-black shadow-xs'
                          : 'text-brand-muted hover:bg-brand-surface hover:text-brand-text'
                      }`}
                    >
                      {type === 'All' ? 'All Types' : type.charAt(0) + type.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search, Rice Role, Favorites, and Sort Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 text-xs">
                {/* Search */}
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-muted" />
                  <input
                    type="text"
                    placeholder="Search recipes..."
                    value={miniSearch}
                    onChange={(e) => setMiniSearch(e.target.value)}
                    className="h-9 w-full rounded-xl border border-brand-border bg-brand-bgAlt/50 pl-9 pr-3 text-xs text-brand-text outline-none focus:border-brand-green"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Rice Role */}
                  <select
                    value={miniRiceRole}
                    onChange={(e) => setMiniRiceRole(e.target.value)}
                    className="h-9 rounded-xl border border-brand-border bg-brand-surface px-2.5 text-xs font-medium text-brand-text outline-none focus:border-brand-green"
                    aria-label="Filter by rice role"
                  >
                    <option value="All">All Rice Roles</option>
                    <option value="PAIR_WITH_RICE">Pair with rice</option>
                    <option value="INCLUDES_RICE">Rice included</option>
                    <option value="STANDALONE">Standalone</option>
                  </select>

                  {/* Favorites only */}
                  <button
                    type="button"
                    onClick={() => setMiniFavoriteOnly(!miniFavoriteOnly)}
                    className={`inline-flex items-center gap-1.5 h-9 rounded-xl border px-2.5 text-xs font-bold transition-colors ${
                      miniFavoriteOnly
                        ? 'border-rose-400 bg-rose-50 text-rose-600 dark:border-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                        : 'border-brand-border text-brand-muted hover:text-brand-text'
                    }`}
                  >
                    <Heart className={`h-3.5 w-3.5 ${miniFavoriteOnly ? 'fill-current text-rose-500' : ''}`} />
                    <span>Favorites</span>
                  </button>

                  {/* Sort Order */}
                  <select
                    value={miniSort}
                    onChange={(e) => setMiniSort(e.target.value as MiniSortOption)}
                    className="h-9 rounded-xl border border-brand-border bg-brand-surface px-2.5 text-xs font-medium text-brand-text outline-none focus:border-brand-green"
                    aria-label="Sort mini library recipes"
                  >
                    <option value="best_match">Best calorie match</option>
                    <option value="cal_asc">Calories: Low to High</option>
                    <option value="cal_desc">Calories: High to Low</option>
                    <option value="alpha">Recipe Name (A-Z)</option>
                  </select>
                </div>
              </div>

              {/* Recipe Cards Grid */}
              <div className="max-h-[44vh] overflow-y-auto pr-1 mt-2">
                {isOptionsLoading ? (
                  <div className="flex flex-col items-center py-12 gap-2">
                    <LoadingSpinner size="md" />
                    <span className="text-xs text-brand-muted font-semibold">
                      Loading compatible library recipes...
                    </span>
                  </div>
                ) : swapOptionsError ? (
                  <div className="p-3 bg-red-950/20 border border-red-900/60 rounded-xl text-xs text-red-400">
                    {swapOptionsError}
                  </div>
                ) : filteredAndSortedOptions.length === 0 ? (
                  <div className="p-8 text-center border border-brand-border/40 bg-brand-surface/30 rounded-2xl">
                    <Soup className="w-7 h-7 text-brand-green mx-auto mb-2 opacity-70" />
                    <p className="text-xs font-bold text-brand-text">No meals match your active filters</p>
                    <p className="text-[11px] text-brand-muted mt-0.5">
                      Try selecting &apos;All Types&apos; or resetting search and rice role filters.
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
                          tabIndex={0}
                          onClick={() => {
                            setGroceryDeltaAcknowledged(false);
                            handleSelectSwapOption(option);
                          }}
                          onKeyDown={(e) => {
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
                                  hideRepresentativeBadge
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
                                  {option.mealName}
                                </h4>

                                <p className="text-[10px] text-brand-muted mt-0.5 truncate">
                                  {option.riceRole === 'PAIR_WITH_RICE'
                                    ? 'Pair with rice'
                                    : option.riceRole === 'INCLUDES_RICE'
                                      ? 'Rice included'
                                      : 'Standalone'}
                                  {option.alreadyPlannedInCycle ? ' · In plan' : ''}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Card Content Bottom: Macros & Verifier */}
                          <div className="mt-2.5 border-t border-brand-border/40 pt-1.5 space-y-1">
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

                            {/* Verifier Badge & Favorite */}
                            <div className="flex items-center justify-between text-[9px] text-brand-muted pt-0.5">
                              <span className="truncate">
                                Verified by:{' '}
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

                              <button
                                type="button"
                                aria-label={
                                  option.isFavorite
                                    ? `Remove ${option.mealName} from favorites`
                                    : `Favorite ${option.mealName}`
                                }
                                aria-pressed={option.isFavorite}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSwapFavorite(option);
                                }}
                                className="p-1 text-brand-muted hover:text-rose-500 transition-colors"
                              >
                                <Heart className={`h-3 w-3 ${option.isFavorite ? 'fill-current text-rose-500' : ''}`} />
                              </button>
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

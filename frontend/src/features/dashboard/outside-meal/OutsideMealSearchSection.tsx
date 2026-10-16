'use client';
import { formatMealTitle } from '@/lib/meal-title';

import { CheckCircle2, ChefHat, Loader2, Search, X } from '@/components/ui/icons';

import { displayMacros, emptyMacros } from '../outside-meal-input';

import type { useOutsideMealFormModel } from './useOutsideMealFormModel';
type Model = Extract<ReturnType<typeof useOutsideMealFormModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<
    Model,
    | 'searchContainerRef'
    | 'props'
    | 'handleInputChange'
    | 'suggestions'
    | 'setShowDropdown'
    | 'isSearching'
    | 'searchFeedback'
    | 'setSearchFeedback'
    | 'cancelSearch'
    | 'setSuggestions'
    | 'setSelectedSuggestion'
    | 'setBaseNutrition'
    | 'setRiceReference'
    | 'setSelectedRicePairing'
    | 'setRiceGrams'
    | 'setManual'
    | 'setPortionGrams'
    | 'showDropdown'
    | 'handleSelectSuggestion'
    | 'selectedSuggestion'
    | 'baseNutrition'
    | 'portionGrams'
  >;
};
export default function OutsideMealSearchSection({ model }: SectionProps) {
  const {
    searchContainerRef,
    props,
    handleInputChange,
    suggestions,
    setShowDropdown,
    isSearching,
    searchFeedback,
    setSearchFeedback,
    cancelSearch,
    setSuggestions,
    setSelectedSuggestion,
    setBaseNutrition,
    setRiceReference,
    setSelectedRicePairing,
    setRiceGrams,
    setManual,
    setPortionGrams,
    showDropdown,
    handleSelectSuggestion,
    selectedSuggestion,
    baseNutrition,
    portionGrams,
  } = model;

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-5">
        <div ref={searchContainerRef} className="sm:col-span-3 relative flex flex-col gap-1">
          <label htmlFor="mealNameInput" className="font-display text-sm font-semibold text-brand-text">
            Food or Meal Eaten (required)
          </label>
          <div className="relative flex items-center">
            <div className="pointer-events-none absolute left-3 text-brand-muted">
              <Search className="h-4 w-4" />
            </div>
            <input
              id="mealNameInput"
              type="text"
              placeholder="e.g. Chicken adobo, apple, brown rice"
              value={props.mealName}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowDropdown(true);
              }}
              disabled={props.isLoading}
              required
              aria-describedby="outside-food-search-help outside-food-search-status"
              autoComplete="off"
              className="min-h-12 w-full rounded-xl border border-brand-border bg-brand-bgAlt py-3 pl-9 pr-12 text-sm font-medium text-brand-text placeholder:text-brand-muted outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            />
            {isSearching ? (
              <Loader2 className="absolute right-3 h-4 w-4 animate-spin text-brand-green" />
            ) : props.mealName ? (
              <button
                type="button"
                onClick={() => {
                  cancelSearch();
                  props.onMealNameChange('');
                  setSuggestions([]);
                  setShowDropdown(false);
                  setSelectedSuggestion(null);
                  setBaseNutrition(null);
                  setRiceReference(null);
                  setSelectedRicePairing(null);
                  setRiceGrams(0);
                  setManual(emptyMacros);
                  setPortionGrams('');
                  setSearchFeedback('idle');
                }}
                aria-label="Clear food name"
                className="absolute right-1 flex h-10 w-10 items-center justify-center rounded-lg text-brand-muted hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <p id="outside-food-search-help" className="mt-1 text-xs leading-relaxed text-brand-muted">
            Search saved recipes and FNRI foods. For multiple foods, use commas. Add grams like{' '}
            <strong className="text-brand-text font-semibold">rice (150g)</strong> for FNRI matching.
          </p>
          <p id="outside-food-search-status" role="status" className="text-xs leading-relaxed text-brand-muted">
            {isSearching ? 'Searching saved foods…' : searchFeedback === 'empty'
              ? 'No saved match found. You can enter label values or request an AI estimate.'
              : searchFeedback === 'unavailable' ? 'Saved suggestions could not load. Try typing again, or enter label values.' : ''}
          </p>

          {/* Autocomplete Dropdown List */}
          {showDropdown && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-2xl border border-brand-border bg-brand-surface shadow-card-lg" aria-label="Matching recipes and foods">
              <div className="border-b border-brand-border px-3 py-2 text-xs font-semibold text-brand-muted">
                Matching Recipes & Foods ({suggestions.length})
              </div>
              {suggestions.map((dish) => (
                <button
                  key={`${dish.kind}-${dish.id}`}
                  type="button"
                  onClick={() => handleSelectSuggestion(dish)}
                  className="flex min-h-12 w-full items-center justify-between gap-2 border-b border-brand-border px-3.5 py-3 text-left text-sm transition-colors hover:bg-brand-green/10 focus-visible:bg-brand-bgAlt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-green/40 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {dish.kind === 'ELIGIBLE_LIBRARY' || dish.kind === 'KNOWN_CATALOG' ? (
                        <ChefHat className="h-3.5 w-3.5 shrink-0 text-brand-green" />
                      ) : (
                        <Search className="h-3.5 w-3.5 shrink-0 text-brand-muted" />
                      )}
                      <span className="truncate font-semibold text-brand-text">{formatMealTitle(dish.name)}</span>
                    </div>
                    <span className="text-xs text-brand-muted">
                      {dish.serving ? `${dish.label} · ${dish.serving}` : dish.label}
                    </span>
                  </div>
                  {dish.macros && (
                    <div className="shrink-0 text-right">
                      <span className="font-extrabold text-brand-green">{Math.round(dish.macros.calories)} kcal</span>
                      <span className="block text-[10px] text-brand-muted">
                        {Math.round(dish.macros.proteinG * 10) / 10}g P · {Math.round(dish.macros.carbsG * 10) / 10}g C
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Portion Field */}
        {selectedSuggestion?.kind === 'FNRI_FOOD' && baseNutrition ? (
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label htmlFor="fnriPortionGrams" className="font-display text-sm font-semibold text-brand-text">
              Amount eaten (grams)
            </label>
            <div className="relative">
              <input
                id="fnriPortionGrams"
                type="number"
                min="1"
                step="1"
                required
                placeholder="100"
                value={portionGrams}
                onChange={(event) => {
                  const grams = event.target.value;
                  setPortionGrams(grams);
                  const factor = Number(grams) / 100;
                  setManual(
                    grams && factor > 0
                      ? displayMacros({
                          calories: baseNutrition.calories * factor,
                          proteinG: baseNutrition.proteinG * factor,
                          carbsG: baseNutrition.carbsG * factor,
                          fatG: baseNutrition.fatG * factor,
                        })
                      : emptyMacros
                  );
                }}
                className="min-h-12 w-full rounded-xl border border-brand-border bg-brand-bgAlt py-3 pl-3 pr-8 text-sm font-semibold text-brand-text outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
              />
              <span className="pointer-events-none absolute right-3 top-4 text-xs font-bold text-brand-muted">g</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-brand-muted">Scales the FNRI values from 100 g.</p>
          </div>
        ) : selectedSuggestion?.kind !== 'ELIGIBLE_LIBRARY' ? (
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label htmlFor="outsidePortionGrams" className="font-display text-sm font-semibold text-brand-text">
              Approximate portion in grams (optional)
            </label>
            <div className="relative">
              <input
                id="outsidePortionGrams"
                type="number"
                min="1"
                max="5000"
                step="1"
                placeholder="e.g. 200"
                value={portionGrams}
                onChange={(event) => setPortionGrams(event.target.value)}
                disabled={props.isLoading}
                className="min-h-12 w-full rounded-xl border border-brand-border bg-brand-bgAlt py-3 pl-3 pr-8 text-sm font-semibold text-brand-text outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
              />
              <span className="pointer-events-none absolute right-3 top-4 text-xs font-bold text-brand-muted">g</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-brand-muted">Measured grams help describe your portion.</p>
          </div>
        ) : (
          <div className="flex flex-col justify-center gap-1 rounded-xl bg-brand-bgAlt p-3 sm:col-span-2">
            <span className="flex items-center gap-1 text-sm font-semibold text-brand-text">
              <CheckCircle2 className="h-3.5 w-3.5" /> 1 serving
            </span>
            <span className="break-words text-xs text-brand-muted">
              {selectedSuggestion.serving || 'Recipe serving'}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

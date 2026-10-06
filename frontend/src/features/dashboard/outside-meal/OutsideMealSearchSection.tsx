'use client';
import { formatMealTitle } from '@/lib/meal-title';

import { CheckCircle2, ChefHat, Loader2, Search, X } from 'lucide-react';

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
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-start">
        <div ref={searchContainerRef} className="sm:col-span-3 relative flex flex-col gap-1">
          <label htmlFor="mealNameInput" className="text-xs font-semibold text-brand-muted">
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
              className="w-full rounded-xl border border-brand-border/80 bg-brand-surface pl-9 pr-8 py-2 text-xs font-semibold text-brand-text placeholder-brand-muted/60 outline-none transition focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
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
                }}
                className="absolute right-3 text-brand-muted hover:text-brand-text"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <p className="mt-0.5 text-[11px] text-brand-muted leading-tight">
            For multiple foods, separate each one with a comma. Add a measured portion like{' '}
            <strong className="text-brand-text font-semibold">rice (150g)</strong> for FNRI matching.
          </p>

          {/* Autocomplete Dropdown List */}
          {showDropdown && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-2xl border border-brand-border/80 bg-brand-surface shadow-card-lg backdrop-blur-md">
              <div className="p-1.5 border-b border-brand-border/40 text-[10px] font-bold uppercase tracking-wider text-brand-muted px-3 pt-2 pb-1">
                Matching Recipes & Foods ({suggestions.length})
              </div>
              {suggestions.map((dish) => (
                <button
                  key={`${dish.kind}-${dish.id}`}
                  type="button"
                  onClick={() => handleSelectSuggestion(dish)}
                  className="flex w-full items-center justify-between gap-2 border-b border-brand-border/30 px-3.5 py-2 text-left text-xs transition hover:bg-brand-green/10 last:border-b-0"
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
                    <span className="text-[10px] text-brand-muted">
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
            <label htmlFor="fnriPortionGrams" className="text-xs font-semibold text-brand-muted">
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
                className="w-full rounded-xl border border-brand-border/80 bg-brand-surface px-3 py-2 text-xs font-semibold text-brand-text outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
              />
              <span className="pointer-events-none absolute right-3 top-2 text-xs font-bold text-brand-muted">g</span>
            </div>
            <p className="mt-0.5 text-[11px] text-brand-muted leading-tight">Per 100g reference.</p>
          </div>
        ) : selectedSuggestion?.kind !== 'ELIGIBLE_LIBRARY' ? (
          <div className="sm:col-span-2 flex flex-col gap-1">
            <label htmlFor="outsidePortionGrams" className="text-xs font-semibold text-brand-muted">
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
                className="w-full rounded-xl border border-brand-border/80 bg-brand-surface px-3 py-2 text-xs font-semibold text-brand-text outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
              />
              <span className="pointer-events-none absolute right-3 top-2 text-xs font-bold text-brand-muted">g</span>
            </div>
            <p className="mt-0.5 text-[11px] text-brand-muted leading-tight">Optional measured grams.</p>
          </div>
        ) : (
          <div className="sm:col-span-2 flex flex-col justify-center rounded-xl border border-brand-border/60 bg-brand-bgAlt/40 p-2 text-center h-[58px]">
            <span className="text-[11px] font-semibold text-brand-green flex items-center justify-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> 1 serving
            </span>
            <span className="text-[10px] text-brand-muted truncate">
              {selectedSuggestion.serving || 'Recipe serving'}
            </span>
          </div>
        )}
      </div>
    </>
  );
}

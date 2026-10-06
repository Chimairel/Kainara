'use client';

import { useState, useMemo, useEffect } from 'react';

import { getMealTheme } from '@/features/dashboard/DashboardMealRow';
import { Props, MiniSortOption } from './MealsWorkspaceModals.shared';
export function useMealsWorkspaceModalsModel({ workspace }: Props) {
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

  return {
    kind: 'ready' as const,
    selectedVerifier,
    setSelectedVerifier,
    activeSwapMeal,
    isSwapping,
    setActiveSwapMeal,
    setSwapOptions,
    setConfirmSwapMeal,
    setSwapOptionsError,
    setSwapPreview,
    currentTheme,
    confirmSwapMeal,
    replacementTheme,
    setGroceryDeltaAcknowledged,
    isCheckingPreview,
    previewError,
    swapPreview,
    groceryDeltaAcknowledged,
    filteredAndSortedOptions,
    miniSort,
    setMiniSort,
    isOptionsLoading,
    swapOptionsError,
    swapOptions,
    handleSelectSwapOption,
    handleConfirmSwapAnyway,
  };
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import api from '@/lib/axios';
import { useRequestScope } from '@/hooks/useRequestScope';

import { useNutritionistLibrary } from '@/features/nutritionist-library/useNutritionistLibrary';

import type { LibraryMeal } from '@/features/nutritionist-library/useNutritionistLibrary';
export function useSharedMealLibraryModel({
  role = 'nutritionist',
  active = true,
  embedded = false,
}: {
  role?: 'admin' | 'nutritionist';
  active?: boolean;
  embedded?: boolean;
}) {
  const isAdmin = role === 'admin';
  const libraryApi = `/${role}/library`;
  const [section, setSection] = useState<'recipes' | 'coverage'>('recipes');
  const workspace = useNutritionistLibrary(section === 'coverage', role, active);
  const scope = JSON.stringify([workspace.ownerId, role]);
  const captureScope = useRequestScope(scope);
  const requestSequence = useRef(0);
  const [stateScope, setStateScope] = useState(scope);
  const [viewedMeal, setViewedMealState] = useState<LibraryMeal | null>(null);
  const [viewingMealId, setViewingMealId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const listScrollTop = useRef(0);
  if (stateScope !== scope) {
    setStateScope(scope);
    setViewedMealState(null);
    setViewingMealId(null);
    setDetailError(null);
  }
  const setViewedMeal = (meal: LibraryMeal | null) => {
    requestSequence.current += 1;
    setViewedMealState(meal);
    setViewingMealId(null);
  };
  const {
    meals,
    totalCount,
    page,
    setPage,
    totalPages,
    isLoading,
    fetchError,
    coverage,
    searchVal,
    setSearchVal,
    mealType,
    setMealType,
    conditionTag,
    setConditionTag,
    verifiedByMe,
    setVerifiedByMe,
    adminDraftsOnly,
    setAdminDraftsOnly,
    status,
    setStatus,
    fetchLibrary,
  } = workspace;

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    const main = document.querySelector('main.portal-main');
    if (main) {
      main.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const openMeal = useCallback(
    async (meal: Pick<LibraryMeal, 'id'>) => {
      const sameScope = captureScope();
      const sequence = ++requestSequence.current;
      const isCurrent = () => sameScope() && requestSequence.current === sequence;
      const main = document.querySelector('main.portal-main');
      listScrollTop.current = main?.scrollTop ?? 0;
      setDetailError(null);
      setViewingMealId(meal.id);
      try {
        const response = await api.get(`${libraryApi}/${meal.id}`);
        if (!isCurrent()) return;
        if (!response.data?.success || !response.data.data) throw new Error('Meal details unavailable.');
        setViewedMealState({ ...meal, ...response.data.data });
        requestAnimationFrame(() => {
          if (isCurrent()) main?.scrollTo({ top: 0 });
        });
      } catch {
        if (isCurrent()) setDetailError('The meal details could not be loaded. Please try again.');
      } finally {
        if (isCurrent()) setViewingMealId(null);
      }
    },
    [captureScope, libraryApi]
  );

  useEffect(() => {
    if (!active || embedded || !workspace.ownerId) return;
    const mealId = new URLSearchParams(window.location.search).get('mealId');
    if (!mealId) return;
    void openMeal({ id: mealId });
  }, [active, embedded, openMeal, scope, workspace.ownerId]);

  return {
    role,
    active,
    embedded,
    isAdmin,
    libraryApi,
    section,
    setSection,
    viewedMeal,
    setViewedMeal,
    viewingMealId,
    setViewingMealId,
    detailError,
    setDetailError,
    listScrollTop,
    workspace,
    meals,
    totalCount,
    page,
    setPage,
    totalPages,
    isLoading,
    fetchError,
    coverage,
    searchVal,
    setSearchVal,
    mealType,
    setMealType,
    conditionTag,
    setConditionTag,
    verifiedByMe,
    setVerifiedByMe,
    adminDraftsOnly,
    setAdminDraftsOnly,
    status,
    setStatus,
    fetchLibrary,
    handlePageChange,
    openMeal,
  };
}

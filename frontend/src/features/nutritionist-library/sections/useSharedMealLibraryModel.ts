'use client';

import { useRef, useState } from 'react';

import api from '@/lib/axios';

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
  const [viewedMeal, setViewedMeal] = useState<LibraryMeal | null>(null);
  const [viewingMealId, setViewingMealId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const listScrollTop = useRef(0);
  const workspace = useNutritionistLibrary(section === 'coverage', role, active);
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

  async function openMeal(meal: Pick<LibraryMeal, 'id'>) {
    const main = document.querySelector('main.portal-main');
    listScrollTop.current = main?.scrollTop ?? 0;
    setDetailError(null);
    setViewingMealId(meal.id);
    try {
      const response = await api.get(`${libraryApi}/${meal.id}`);
      if (!response.data?.success || !response.data.data) throw new Error('Meal details unavailable.');
      setViewedMeal({ ...meal, ...response.data.data });
      requestAnimationFrame(() => main?.scrollTo({ top: 0 }));
    } catch {
      setDetailError('The meal details could not be loaded. Please try again.');
    } finally {
      setViewingMealId(null);
    }
  }

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

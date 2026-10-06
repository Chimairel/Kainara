'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';

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
  const [mealFlagReason, setMealFlagReason] = useState('');
  const [mealReleaseFindings, setMealReleaseFindings] = useState('');
  const [mealFlagBusy, setMealFlagBusy] = useState(false);
  const [mealFlagError, setMealFlagError] = useState<string | null>(null);
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

  async function openMeal(meal: LibraryMeal) {
    const main = document.querySelector('main.portal-main');
    listScrollTop.current = main?.scrollTop ?? 0;
    setDetailError(null);
    setViewingMealId(meal.id);
    try {
      const response = await api.get(`${libraryApi}/${meal.id}`);
      if (!response.data?.success || !response.data.data) throw new Error('Meal details unavailable.');
      setMealFlagError(null);
      setMealFlagReason('');
      setMealReleaseFindings('');
      setViewedMeal({ ...meal, ...response.data.data });
      requestAnimationFrame(() => main?.scrollTo({ top: 0 }));
    } catch {
      setDetailError('The meal details could not be loaded. Please try again.');
    } finally {
      setViewingMealId(null);
    }
  }

  async function changeMealFlag(action: 'flag' | 'release-flag') {
    if (!viewedMeal || mealFlagBusy || (isAdmin && action !== 'flag')) return;
    setMealFlagBusy(true);
    setMealFlagError(null);
    const notice = toast.loading(action === 'flag' ? 'Flagging meal...' : 'Releasing meal flag...');
    let saved = false;
    try {
      const result = await api.post(
        `${libraryApi}/${viewedMeal.id}/${action}`,
        action === 'flag' ? { reason: mealFlagReason.trim() } : { rationale: mealReleaseFindings.trim() }
      );
      if (!result.data?.success) throw new Error('The meal flag could not be updated.');
      saved = true;
      setViewedMeal({ ...viewedMeal, status: action === 'flag' ? 'FLAGGED' : 'APPROVED' });
      toast.success(action === 'flag' ? 'Meal flagged for nutritionist review' : 'Meal flag released', { id: notice });
      const response = await api.get(`${libraryApi}/${viewedMeal.id}`);
      if (!response.data?.success || !response.data.data) throw new Error('Updated details unavailable.');
      setViewedMeal({ ...viewedMeal, ...response.data.data });
      setMealFlagReason('');
      setMealReleaseFindings('');
      await fetchLibrary();
    } catch (error: unknown) {
      const response = error as { response?: { data?: { error?: string } } };
      const message = saved
        ? 'Meal flag saved. Reload to see the updated library.'
        : response.response?.data?.error || 'The meal flag could not be updated. Please try again.';
      setMealFlagError(message);
      if (saved) toast.warning(message, { id: notice });
      else toast.error(message, { id: notice });
    } finally {
      setMealFlagBusy(false);
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
    mealFlagReason,
    setMealFlagReason,
    mealReleaseFindings,
    setMealReleaseFindings,
    mealFlagBusy,
    setMealFlagBusy,
    mealFlagError,
    setMealFlagError,
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
    changeMealFlag,
  };
}

'use client';

import { useAuth } from '@/hooks/useAuth';
import { useBreadcrumb } from '@/lib/context/BreadcrumbContext';
import { formatManilaDate, getManilaDateKey, manilaDateFromKey } from '@/lib/manila-date';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useMealsWorkspace } from '@/features/meals/useMealsWorkspace';

export function useMealsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get('date');
  const mealIdParam = searchParams.get('mealId');
  const [activeModalMealId, setActiveModalMealId] = useState<string | null>(mealIdParam);

  const workspace = useMealsWorkspace(dateParam ? { initialDateKey: dateParam } : undefined);
  const {
    activeTab,
    setActiveTab,
    meals,
    isLoading,
    isPreparing,
    error,
    clinicalEvidenceRequired,
    profileReviewRequired,
    pendingReview,
    awaitingGeneration,
    generationStatus,
    isRetryingMissing,
    retryPlanLoad,
    retryMissingGeneration,
    repairRetiredMeals,
    isRepairingRetired,
    cycles,
    setSelectedPlanDateKey,
    historyLogs,
    isHistoryLoading,
    historyTotalCount,
    historyError,
    historySearch,
    setHistorySearch,
    historySource,
    setHistorySource,
    historyStatus,
    setHistoryStatus,
    selectedHistoryDateKey,
    setSelectedHistoryDateKey,
    handleUpdateLogNotes,
    handleEditOutsideItem,
    handleVoidOutsideLog,
    handleRequestOutsideReview,
    handleReplyToOutsideReview,
    handleObservedConsent,
    handleObservedWithdraw,
    handleSwapClick,
    refreshingSwapMealId,
    handleMealStatusToggle,
    handleRetryPreparation,
    handleHistorySearchSubmit,
    groupHistoryByDate,
    groupedDays,
    groupedPendingDays,
    displayedPlanDays,
    selectedPlanDayIndex,
    selectedPlanDay,
    isStarterPlan,
    nextCycleDay,
    displayedMealCount,
  } = workspace;
  const upcomingOnly =
    !cycles?.current && Boolean(cycles?.upcoming) && (displayedMealCount > 0 || awaitingGeneration.upcoming > 0);
  const awaitingGenerationCount = upcomingOnly ? awaitingGeneration.upcoming : awaitingGeneration.current;
  const activeGenerationStatus = upcomingOnly ? generationStatus.upcoming : generationStatus.current;
  const generationCycleId = upcomingOnly ? cycles?.upcoming?.id : cycles?.current?.id;
  const upcomingStart = cycles?.upcoming?.startDate
    ? formatManilaDate(manilaDateFromKey(getManilaDateKey(cycles.upcoming.startDate)), {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      })
    : null;

  const { setSubTab } = useBreadcrumb();

  // Read initial tab from URL if present
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['plan', 'history', 'library'].includes(tabParam.toLowerCase())) {
      setActiveTab(tabParam.toLowerCase() as 'plan' | 'history' | 'library');
    }
  }, [setActiveTab]);

  useEffect(() => {
    if (dateParam) {
      setSelectedPlanDateKey(dateParam);
    }
  }, [dateParam, setSelectedPlanDateKey]);

  useEffect(() => {
    if (mealIdParam) {
      setActiveModalMealId(mealIdParam);
    }
  }, [mealIdParam]);

  // Sync activeTab with breadcrumb and URL
  useEffect(() => {
    setSubTab(activeTab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (activeTab === 'plan') {
        url.searchParams.delete('tab');
      } else {
        url.searchParams.set('tab', activeTab);
      }
      window.history.replaceState(null, '', url.pathname + url.search);
    }
  }, [activeTab, setSubTab]);

  const activePlanPillRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (activePlanPillRef.current) {
      activePlanPillRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedPlanDay?.dateKey]);

  const isReportPending = Boolean(
    (user?.onboardingDone && user?.tosAccepted && !user?.reportAcknowledged) ||
    (error && error.toLowerCase().includes('nutrition report')) ||
    (historyError && historyError.toLowerCase().includes('nutrition report'))
  );

  return {
    activeTab,
    upcomingOnly,
    isStarterPlan,
    upcomingStart,
    nextCycleDay,
    isLoading,
    cycles,
    isRepairingRetired,
    repairRetiredMeals,
    setActiveTab,
    displayedMealCount,
    historyTotalCount,
    clinicalEvidenceRequired,
    isReportPending,
    generationStatus,
    awaitingGenerationCount,
    displayedPlanDays,
    pendingReview,
    activeGenerationStatus,
    generationCycleId,
    retryMissingGeneration,
    isRetryingMissing,
    selectedPlanDay,
    setSelectedPlanDateKey,
    selectedPlanDayIndex,
    activePlanPillRef,
    error,
    profileReviewRequired,
    groupedDays,
    groupedPendingDays,
    refreshingSwapMealId,
    handleMealStatusToggle,
    handleSwapClick,
    activeModalMealId,
    setActiveModalMealId,
    groupHistoryByDate,
    selectedHistoryDateKey,
    meals,
    historyLogs,
    setSelectedHistoryDateKey,
    handleHistorySearchSubmit,
    historySearch,
    setHistorySearch,
    historySource,
    setHistorySource,
    historyStatus,
    setHistoryStatus,
    isHistoryLoading,
    historyError,
    handleUpdateLogNotes,
    handleEditOutsideItem,
    handleVoidOutsideLog,
    handleRequestOutsideReview,
    handleReplyToOutsideReview,
    handleObservedConsent,
    handleObservedWithdraw,
    workspace,
    isPreparing,
    retryPlanLoad,
    handleRetryPreparation,
  };
}

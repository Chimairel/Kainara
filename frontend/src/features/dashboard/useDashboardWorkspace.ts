'use client';

import type { RetainedMealLog } from '@/features/meals/RetainedMealLogs';
import { useAuth } from '@/hooks/useAuth';
import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import api from '@/lib/axios';
import { LIVE_UPDATE_EVENT } from '@/lib/live-events';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getApiErrorMessage } from '@/lib/api-error';
import { MealPlan } from '@/types';
import type { UserProfileData } from '@/hooks/useProfile';
import { formatManilaDate, getManilaDateKey } from '@/lib/manila-date';
import {
  calculateDashboardMetrics,
  getDashboardCycleDates,
  type CycleMetaSnapshot,
  type OutsideMealLog,
  type PendingReview,
} from '@/features/dashboard/model';
import { useOutsideMealLog } from '@/features/dashboard/useOutsideMealLog';
import { useDashboardDateSelection } from './useDashboardDateSelection';
import { useDashboardPreload } from '@/features/navigation/useDashboardPreload';
import { cachedClinicalProfileStatus, refreshClinicalProfileStatus } from '@/lib/clinical-profile-status';
import { invalidateSessionResource, readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';
import { cachedUserProfile, getRecentUserProfile } from '@/lib/user-profile-resource';

interface CurrentPlanSnapshot {
  retainedMealLogs?: RetainedMealLog[];
  meals: MealPlan[];
  pendingReview: PendingReview | null;
  awaitingGenerationCount?: number;
  generationStatus?: string | null;
  planSnapshot: {
    dailyCalorieTarget: number;
    dailyMacroTargets: Record<string, { calories: number; proteinG: number; carbsG: number; fatG: number }>;
  } | null;
  cycle?: CycleMetaSnapshot;
  upcomingCycle?: CycleMetaSnapshot;
}
const currentPlanResource = 'user-meals-current';
export function useDashboardWorkspace() {
  const { user } = useAuth();
  const ownerId = user?.userId;
  const cachedPlan = readSessionResource<CurrentPlanSnapshot>(ownerId, currentPlanResource);
  const cachedProfile = readSessionResource<UserProfileData>(ownerId, 'user-profile');
  const cachedOutsideMeals = readSessionResource<OutsideMealLog[]>(ownerId, 'dashboard-outside-meals');
  const cachedWater = readSessionResource<number>(ownerId, 'dashboard-water');
  const cachedEligibility = cachedClinicalProfileStatus(ownerId, cachedProfile);
  const profileSafetyRevision = cachedProfile?.userProfile?.safetyRevision;
  const router = useRouter();
  const [retainedHistory, setRetainedHistory] = useState<{ ownerId: string | undefined; meals: RetainedMealLog[] }>({
    ownerId,
    meals: cachedPlan?.retainedMealLogs ?? [],
  });
  const retainedMealLogs = retainedHistory.ownerId === ownerId ? retainedHistory.meals : [];
  const [currentMeals, setCurrentMeals] = useState<MealPlan[]>(cachedPlan?.meals ?? []);
  const [isLoading, setIsLoading] = useState(!cachedPlan);
  const [initialReadsOwner, setInitialReadsOwner] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clinicalEvidenceRequired, setClinicalEvidenceRequired] = useState(false);
  const [profileReviewStatus, setProfileReviewStatus] = useState<'checking' | 'ready' | 'pending' | 'error'>(
    cachedEligibility ? (cachedEligibility.required && !cachedEligibility.approved ? 'pending' : 'ready') : 'checking'
  );
  const [pendingReview, setPendingReview] = useState<PendingReview | null>(cachedPlan?.pendingReview ?? null);
  const [awaitingGenerationCount, setAwaitingGenerationCount] = useState(cachedPlan?.awaitingGenerationCount ?? 0);
  const [generationStatus, setGenerationStatus] = useState(cachedPlan?.generationStatus ?? null);
  const [isRetryingMissing, setIsRetryingMissing] = useState(false);
  const [planSnapshot, setPlanSnapshot] = useState<CurrentPlanSnapshot['planSnapshot']>(
    cachedPlan?.planSnapshot ?? null
  );
  const [currentCycle, setCurrentCycle] = useState<CycleMetaSnapshot | null>(cachedPlan?.cycle ?? null);
  const generationRequestInFlight = useRef(false);
  const currentPlanRequestInFlight = useRef(false);
  const lastPlanRequestAt = useRef(0);
  useEffect(() => {
    if (!ownerId) return;
    let active = true;
    const check = async () => {
      try {
        const status = await refreshClinicalProfileStatus(ownerId, cachedUserProfile(ownerId));
        if (active) setProfileReviewStatus(status.required && !status.approved ? 'pending' : 'ready');
      } catch {
        if (active) setProfileReviewStatus('error');
      }
    };
    void check();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void check();
    }, 15_000);
    const refresh = () => {
      if (document.visibilityState === 'visible') void check();
    };
    window.addEventListener(LIVE_UPDATE_EVENT, refresh);
    return () => {
      active = false;
      window.removeEventListener(LIVE_UPDATE_EVENT, refresh);
      window.clearInterval(interval);
    };
  }, [ownerId, profileSafetyRevision]);
  const isStarterPlan = currentCycle?.planType === 'STARTER' || currentMeals[0]?.planType === 'STARTER';
  const nextCycleDay = React.useMemo(() => {
    if (!isStarterPlan) return null;
    if (currentCycle?.endDate) {
      const dayAfter = new Date(currentCycle.endDate);
      dayAfter.setDate(dayAfter.getDate() + 1);
      return formatManilaDate(dayAfter, { weekday: 'long', month: 'short', day: 'numeric' });
    }
    return null;
  }, [isStarterPlan, currentCycle?.endDate]);

  // Extract unique scheduledDate values in chronological order, keeping full 7-day cycle with past days visible
  const uniqueDates = React.useMemo(() => {
    return getDashboardCycleDates(currentMeals, pendingReview?.meals ?? [], currentCycle);
  }, [currentMeals, pendingReview, currentCycle]);

  const { selectedDayOffset, setSelectedDayOffset } = useDashboardDateSelection(
    uniqueDates,
    `${ownerId ?? 'anonymous'}:${currentCycle?.id ?? 'unassigned'}`
  );

  const activeDashboardPillRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (activeDashboardPillRef.current) {
      activeDashboardPillRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedDayOffset]);

  const outsideLogsVersion = useRef(0);
  const outsideLog = useOutsideMealLog((log) => {
    outsideLogsVersion.current += 1;
    setOutsideMealLogs((previous) => {
      const next = [log, ...previous.filter((row) => row.id !== log.id)];
      writeSessionResource(ownerId, 'dashboard-outside-meals', next);
      return next;
    });
  }, ownerId);
  const isLogging = outsideLog.isLoading;

  // Check-in status

  // User Profile details
  const [userProfile, setUserProfile] = useState<UserProfileData['userProfile']>(cachedProfile?.userProfile ?? null);
  const [outsideMealLogs, setOutsideMealLogs] = useState<OutsideMealLog[]>(cachedOutsideMeals ?? []);

  // Water intake state
  const [waterIntake, setWaterIntake] = useState(cachedWater ?? 0);

  const applyCurrentPlan = useCallback(
    (snapshot: CurrentPlanSnapshot) => {
      setCurrentMeals(snapshot.meals);
      setRetainedHistory({ ownerId, meals: snapshot.retainedMealLogs ?? [] });
      setPendingReview(snapshot.pendingReview);
      setAwaitingGenerationCount(snapshot.awaitingGenerationCount ?? 0);
      setGenerationStatus(snapshot.generationStatus ?? null);
      setPlanSnapshot(snapshot.planSnapshot);
      setCurrentCycle(snapshot.cycle ?? null);
      writeSessionResource(ownerId, currentPlanResource, snapshot);
    },
    [ownerId]
  );

  // Fetch user profile metrics
  const fetchProfile = useCallback(async () => {
    try {
      const profile = await getRecentUserProfile(ownerId);
      setUserProfile(profile.userProfile);
    } catch (err) {
      console.warn('[Dashboard] Failed to fetch user profile', err);
    }
  }, [ownerId]);

  // Hydration is persisted by the backend using the Manila business day.
  const fetchWater = useCallback(async () => {
    if (!user) return;
    await api
      .get('/user/water/today')
      .then((response) => {
        if (response.data?.success) {
          const totalMl = response.data.data.totalMl || 0;
          setWaterIntake(totalMl);
          writeSessionResource(ownerId, 'dashboard-water', totalMl);
        }
      })
      .catch(() => undefined);
  }, [user, ownerId]);

  const handleAddWater = async (amount: number) => {
    const nextWater = Math.max(0, waterIntake + amount);
    setWaterIntake(nextWater);
    try {
      if (amount > 0) {
        const response = await api.post('/user/water', { amountMl: amount });
        const totalMl = response.data?.data?.totalMl ?? nextWater;
        setWaterIntake(totalMl);
        writeSessionResource(ownerId, 'dashboard-water', totalMl);
      } else {
        const response = await api.post('/user/water/remove', { amountMl: Math.abs(amount) });
        const totalMl = response.data?.data?.totalMl ?? nextWater;
        setWaterIntake(totalMl);
        writeSessionResource(ownerId, 'dashboard-water', totalMl);
      }
    } catch {
      setWaterIntake((current) => Math.max(0, current - amount));
    }
  };

  const fetchOutsideMealLogs = useCallback(async () => {
    const version = outsideLogsVersion.current;
    try {
      const res = await api.get('/user/meals/history', {
        params: { source: 'USER_LOGGED', status: 'DONE' },
      });
      if (res.data?.success && version === outsideLogsVersion.current) {
        const logs = Array.isArray(res.data.data) ? res.data.data : [];
        setOutsideMealLogs(logs);
        writeSessionResource(ownerId, 'dashboard-outside-meals', logs);
      }
    } catch (err) {
      console.warn('[Dashboard] Failed to fetch outside-meal history', err);
    }
  }, [ownerId]);

  const isReportPending = Boolean(
    (user?.onboardingDone && user?.tosAccepted && !user?.reportAcknowledged) ||
    (error && error.toLowerCase().includes('nutrition report'))
  );

  // Load active plan meals
  const fetchCurrentPlan = useCallback(
    async (signal?: AbortSignal) => {
      if (currentPlanRequestInFlight.current) return;
      if (user?.onboardingDone && user?.tosAccepted && !user?.reportAcknowledged) {
        setIsLoading(false);
        return;
      }
      currentPlanRequestInFlight.current = true;
      lastPlanRequestAt.current = Date.now();
      try {
        const res = await api.get('/user/meals/current', { signal });
        if (signal?.aborted) return;
        if (res.data && res.data.success) {
          setError(null);
          setClinicalEvidenceRequired(false);
          applyCurrentPlan({
            meals: Array.isArray(res.data.data) ? res.data.data : [],
            retainedMealLogs: res.data.meta?.retainedMealLogs ?? [],
            pendingReview: res.data.meta?.pendingReview ?? null,
            awaitingGenerationCount: res.data.meta?.awaitingGenerationCount ?? 0,
            generationStatus: res.data.meta?.generationStatus ?? null,
            planSnapshot: res.data.meta?.planSnapshot ?? null,
            cycle: res.data.meta?.cycle ?? null,
            upcomingCycle:
              readSessionResource<CurrentPlanSnapshot>(ownerId, currentPlanResource)?.upcomingCycle ?? null,
          });
        }
      } catch (err: unknown) {
        if (signal?.aborted || axios.isCancel(err)) return;
        if (axios.isAxiosError(err) && err.response?.data?.errorCode === 'CLINICAL_EVIDENCE_REQUIRED') {
          setClinicalEvidenceRequired(true);
          setCurrentMeals([]);
          setRetainedHistory({ ownerId, meals: [] });
          setPendingReview(null);
          setCurrentCycle(null);
          setAwaitingGenerationCount(0);
          setGenerationStatus(null);
          invalidateSessionResource(ownerId, currentPlanResource);
        }
        setError(getApiErrorMessage(err, "Failed to load today's scheduled plan."));
      } finally {
        currentPlanRequestInFlight.current = false;
        setIsLoading(false);
      }
    },
    [applyCurrentPlan, user, ownerId]
  );

  const preparingPlan =
    !isLoading &&
    !isReportPending &&
    !clinicalEvidenceRequired &&
    profileReviewStatus === 'ready' &&
    (isGenerating ||
      ['GENERATING', 'WAITING_FOR_AI', 'PROCESSING_AI'].includes(generationStatus ?? '') ||
      (!currentMeals.length && !retainedMealLogs.length && !pendingReview && !error && generationStatus !== 'FAILED'));

  useVisiblePolling(fetchCurrentPlan, {
    enabled: Boolean(ownerId),
    intervalMs: preparingPlan ? 3_000 : 15_000,
    immediate: false,
    scopeKey: ownerId,
  });
  useVisiblePolling(fetchOutsideMealLogs, {
    enabled: Boolean(ownerId) && !isLogging,
    immediate: false,
    scopeKey: ownerId,
  });
  // Upcoming-cycle notices must not hold up the current plan or its failure state.
  useVisiblePolling(
    async (signal) => {
      const response = await api.get('/user/meals/cycles', { signal });
      if (signal.aborted || !response.data?.success) return;
      const upcoming = response.data.data?.upcoming ?? null;
      const snapshot = readSessionResource<CurrentPlanSnapshot>(ownerId, currentPlanResource);
      if (snapshot) writeSessionResource(ownerId, currentPlanResource, { ...snapshot, upcomingCycle: upcoming });
    },
    { enabled: Boolean(ownerId) && !isLoading && !currentCycle, scopeKey: ownerId }
  );

  useEffect(() => {
    if (user) {
      let active = true;
      setInitialReadsOwner(null);
      void Promise.all([fetchCurrentPlan(), fetchProfile(), fetchOutsideMealLogs(), fetchWater()]).then(() => {
        if (active && ownerId) setInitialReadsOwner(ownerId);
      });

      let activeDateKey = getManilaDateKey();
      const refreshForDateRollover = () => {
        const nextDateKey = getManilaDateKey();
        if (nextDateKey !== activeDateKey) {
          activeDateKey = nextDateKey;
          fetchCurrentPlan();
        }
      };
      const refreshIfOld = () => {
        if (Date.now() - lastPlanRequestAt.current >= 15_000) void fetchCurrentPlan();
      };
      const refreshOnFocus = () => refreshIfOld();
      const refreshOnVisibility = () => {
        if (document.visibilityState === 'visible') refreshIfOld();
      };
      const rolloverInterval = window.setInterval(refreshForDateRollover, 60_000);
      window.addEventListener('focus', refreshOnFocus);
      document.addEventListener('visibilitychange', refreshOnVisibility);

      return () => {
        active = false;
        window.clearInterval(rolloverInterval);
        window.removeEventListener('focus', refreshOnFocus);
        document.removeEventListener('visibilitychange', refreshOnVisibility);
      };
    }
  }, [user, ownerId, fetchCurrentPlan, fetchProfile, fetchOutsideMealLogs, fetchWater]);

  useDashboardPreload(
    ownerId,
    Boolean(user?.role === 'USER' && user.onboardingDone && user.tosAccepted && user.reportAcknowledged),
    initialReadsOwner === ownerId &&
      !currentPlanRequestInFlight.current &&
      !isLoading &&
      !isGenerating &&
      !error &&
      !clinicalEvidenceRequired &&
      !isReportPending &&
      profileReviewStatus === 'ready'
  );

  // Handles scheduled meal checkoff toggles
  const handleMealStatusToggle = async (mealPlanId: string, newStatus: 'DONE' | 'SKIPPED' | 'PENDING') => {
    try {
      await api.patch(`/user/meals/${mealPlanId}/status`, { status: newStatus });
      // Fetch plan again to sync local UI check marks and total calories
      const res = await api.get('/user/meals/current');
      if (res.data && res.data.success) {
        applyCurrentPlan({
          meals: Array.isArray(res.data.data) ? res.data.data : [],
          retainedMealLogs: res.data.meta?.retainedMealLogs ?? [],
          pendingReview: res.data.meta?.pendingReview ?? null,
          awaitingGenerationCount: res.data.meta?.awaitingGenerationCount ?? 0,
          generationStatus: res.data.meta?.generationStatus ?? null,
          planSnapshot: res.data.meta?.planSnapshot ?? null,
          cycle: res.data.meta?.cycle ?? null,
        });
      }
    } catch (err) {
      console.error('[Dashboard] Status toggle failed:', err);
    }
  };

  // Triggers 7-day meal plan generation
  const handleGeneratePlan = async () => {
    if (generationRequestInFlight.current || pendingReview) return;

    generationRequestInFlight.current = true;
    setIsGenerating(true);
    setGenerationStatus('GENERATING');
    setError(null);
    try {
      const res = await api.post('/user/meals/generate');
      if (!res.data?.success) throw new Error('Could not generate the weekly plan.');
      if (res.data.success) {
        applyCurrentPlan({
          meals: res.data.data.meals,
          retainedMealLogs: res.data.data.retainedMealLogs ?? [],
          pendingReview: res.data.data.pendingReview ?? null,
          awaitingGenerationCount: res.data.data.awaitingGenerationCount ?? 0,
          generationStatus: res.data.data.generationStatus ?? null,
          planSnapshot: res.data.data.planSnapshot ?? null,
          cycle: res.data.data.cycle ?? null,
        });
      }
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, 'Gemini failed to generate standard plan.');
      if (axios.isAxiosError(err) && err.response?.data?.errorCode === 'CLINICAL_EVIDENCE_REQUIRED') {
        setClinicalEvidenceRequired(true);
      }
      if (axios.isAxiosError(err) && err.response?.data?.errorCode === 'PROFILE_REVIEW_REQUIRED') {
        setProfileReviewStatus('pending');
      }
      setGenerationStatus('FAILED');
      setError(msg);
    } finally {
      generationRequestInFlight.current = false;
      setIsGenerating(false);
    }
  };

  const retryMissingGeneration = async () => {
    if (!currentCycle?.id) return;
    setIsRetryingMissing(true);
    try {
      await api.post(`/user/meals/cycles/${currentCycle.id}/retry-generation`, {});
      await fetchCurrentPlan();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not retry the missing meal slots.'));
    } finally {
      setIsRetryingMissing(false);
    }
  };

  const activeDate = uniqueDates[selectedDayOffset] ?? new Date();
  const metrics = calculateDashboardMetrics({
    activeDate,
    currentMeals,
    retainedMealLogs,
    dailyCalorieTarget: planSnapshot?.dailyCalorieTarget ?? userProfile?.dailyCalorieTarget,
    dailyMacroTargets: planSnapshot?.dailyMacroTargets,
    outsideMealLogs,
    pendingMeals: pendingReview?.meals ?? [],
  });
  const todayKey = getManilaDateKey();
  const daySelectors = uniqueDates.map((date, index) => {
    const dateKey = getManilaDateKey(date);
    return {
      offset: index,
      dayLabel: formatManilaDate(date, { weekday: 'short' }),
      dateLabel: formatManilaDate(date, { day: 'numeric' }),
      isPast: dateKey < todayKey,
      isToday: dateKey === todayKey,
    };
  });

  return {
    error,
    clinicalEvidenceRequired,
    user,
    outsideLog,
    router,
    isLoading,
    currentCycle,
    isStarterPlan,
    nextCycleDay,
    awaitingGenerationCount,
    isReportPending,
    currentMeals,
    retainedMealLogs,
    pendingReview,
    generationStatus,
    retryMissingGeneration,
    isRetryingMissing,
    profileReviewStatus,
    isGenerating,
    fetchCurrentPlan,
    handleGeneratePlan,
    daySelectors,
    selectedDayOffset,
    setSelectedDayOffset,
    activeDashboardPillRef,
    activeDate,
    metrics,
    waterIntake,
    handleAddWater,
    handleMealStatusToggle,
  };
}

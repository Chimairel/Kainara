import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import type { PendingMealPreview } from '@/components/user/PendingMealPreviewCard';
import type { CycleMetaSnapshot } from '@/features/dashboard/model';
import { useMealGenerationProgress } from '@/features/meals/useMealGenerationProgress';
import { useAuth } from '@/hooks/useAuth';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/lib/axios';
import { cachedClinicalProfileStatus, refreshClinicalProfileStatus } from '@/lib/clinical-profile-status';
import { formatManilaDate, getManilaDateKey, manilaDateFromKey } from '@/lib/manila-date';
import { invalidateSessionResource, readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';
import { cachedUserProfile } from '@/lib/user-profile-resource';
import type { MealPlan, PublicVerifier } from '@/types';
import axios from 'axios';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type {
  CurrentPlanSnapshot,
  PendingReviewState,
  SwapOption,
  SwapNutritionAnalysis,
} from './meals-workspace.types';
import { useMealHistory } from './useMealHistory';
import { useMealLibrary } from './useMealLibrary';
import { MEALS_WORKSPACE_RESOURCE, refreshMealsWorkspace } from './meal-workspace-resource';

export type { MealHistoryLog, SwapOption } from './meals-workspace.types';

const planResource = MEALS_WORKSPACE_RESOURCE;
export function useMealsWorkspace(initialOptions?: { initialDateKey?: string | null }) {
  const replanRequest = useRef<string | null>(null);
  const regenerationInFlight = useRef(false);
  const repairInFlight = useRef(false);
  const [isRepairingRetired, setIsRepairingRetired] = useState(false);
  const { user } = useAuth();
  const ownerId = user?.userId;
  const currentPlanResource = planResource;
  const cachedPlan = readSessionResource<CurrentPlanSnapshot>(ownerId, currentPlanResource);
  const cachedProfile = cachedUserProfile(ownerId);
  const cachedEligibility = cachedClinicalProfileStatus(ownerId, cachedProfile);
  const profileSafetyRevision = cachedProfile?.userProfile?.safetyRevision;
  // Tab state
  const [activeTab, setActiveTab] = useState<'plan' | 'history' | 'library'>('plan');

  // Meal Plan states
  const hasPlanData = Boolean(cachedPlan);
  const [meals, setMeals] = useState<MealPlan[]>(cachedPlan?.meals ?? []);
  const [cycles, setCycles] = useState<{
    current?: CycleMetaSnapshot | null;
    upcoming?: CycleMetaSnapshot | null;
  } | null>(cachedPlan?.cycles ?? null);
  const [isLoading, setIsLoading] = useState(!hasPlanData);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const regenerationProgress = useMealGenerationProgress(isRegenerating);
  const [error, setError] = useState<string | null>(null);
  const [clinicalEvidenceRequired, setClinicalEvidenceRequired] = useState(false);
  const [profileReviewRequired, setProfileReviewRequired] = useState(
    Boolean(cachedEligibility?.required && !cachedEligibility?.approved)
  );
  const [pendingReview, setPendingReview] = useState<PendingReviewState | null>(cachedPlan?.pendingReview ?? null);
  const [awaitingGeneration, setAwaitingGeneration] = useState(
    cachedPlan?.awaitingGeneration ?? { current: 0, upcoming: 0 }
  );
  const [generationStatus, setGenerationStatus] = useState(
    cachedPlan?.generationStatus ?? { current: null, upcoming: null }
  );
  const [isRetryingMissing, setIsRetryingMissing] = useState(false);
  const [selectedPlanDateKey, setSelectedPlanDateKey] = useState<string | null>(initialOptions?.initialDateKey ?? null);
  const currentPlanRequestInFlight = useRef<{
    ownerId: string | undefined;
    promise: Promise<boolean>;
  } | null>(null);
  const activePlanOwner = useRef(ownerId);
  useEffect(() => {
    activePlanOwner.current = ownerId;
    return () => {
      activePlanOwner.current = undefined;
    };
  }, [ownerId]);
  useEffect(() => {
    if (!ownerId) return;
    let active = true;
    void refreshClinicalProfileStatus(ownerId, cachedUserProfile(ownerId))
      .then((status) => {
        if (active) setProfileReviewRequired(status.required && !status.approved);
      })
      .catch(() => {
        /* The server generation gate remains authoritative. */
      });
    return () => {
      active = false;
    };
  }, [ownerId, profileSafetyRevision]);

  // Meal swap states
  const [activeSwapMeal, setActiveSwapMeal] = useState<MealPlan | null>(null);
  const [swapOptions, setSwapOptions] = useState<SwapOption[]>([]);
  const [isOptionsLoading, setIsOptionsLoading] = useState(false);
  const [swapOptionsError, setSwapOptionsError] = useState<string | null>(null);
  const [confirmSwapMeal, setConfirmSwapMeal] = useState<SwapOption | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);
  const [refreshingSwapMealId, setRefreshingSwapMealId] = useState<string | null>(null);
  const swapInFlight = useRef(false);

  // Swap preview/warning states
  const [swapPreview, setSwapPreview] = useState<{
    nutritionAnalysis?: SwapNutritionAnalysis;
    originalMealName: string;
    originalCalories: number;
    newMealName: string;
    newCalories: number;
    calorieDelta: number;
    projectedDayTotal: number;
    dailyTarget: number;
    warningRequired: boolean;
    previewToken: string;
    requestKey: string;
    expiresAt: string;
    shoppingStarted: boolean;
    groceryDeltaAcknowledgmentRequired: boolean;
    alreadyPlannedInCycle: boolean;
    shoppingRemovals: Array<{
      ingredientName: string;
      unit: string | null;
      removableQuantity: number | null;
    }>;
    shoppingNeeds: Array<{
      ingredientName: string;
      unit: string | null;
      additionalQuantity: number | null;
      remainingQuantity: number | null;
    }>;
  } | null>(null);
  const [isCheckingPreview, setIsCheckingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [selectedHistoryDateKey, setSelectedHistoryDateKey] = useState<string | null>(null);
  const [selectedVerifier, setSelectedVerifier] = useState<PublicVerifier | null>(null);

  const applyCurrentPlan = useCallback(
    (snapshot: CurrentPlanSnapshot) => {
      setMeals(snapshot.meals);
      setPendingReview(snapshot.pendingReview);
      setAwaitingGeneration(snapshot.awaitingGeneration ?? { current: 0, upcoming: 0 });
      setGenerationStatus(snapshot.generationStatus ?? { current: null, upcoming: null });
      setCycles(snapshot.cycles ?? null);
      writeSessionResource(ownerId, currentPlanResource, snapshot);
    },
    [ownerId, currentPlanResource]
  );

  const loadCurrentPlan = useCallback(
    (freshAfterSwap = false): Promise<boolean> => {
      const existing = currentPlanRequestInFlight.current;
      if (!freshAfterSwap && existing && existing.ownerId === ownerId) return existing.promise;
      if (!freshAfterSwap && swapInFlight.current) return Promise.resolve(false);
      // A committed swap must not adopt a request started before the mutation.
      if (freshAfterSwap) invalidateSessionResource(ownerId, currentPlanResource);
      const request = { ownerId, promise: Promise.resolve(false) };
      currentPlanRequestInFlight.current = request;
      const isCurrent = () => activePlanOwner.current === ownerId && currentPlanRequestInFlight.current === request;
      request.promise = (async () => {
        try {
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              await refreshMealsWorkspace(ownerId);
            } catch (err) {
              if (!isCurrent()) return false;
              const status = axios.isAxiosError(err) ? err.response?.status : undefined;
              const cancelled = axios.isCancel(err);
              const transient =
                axios.isAxiosError(err) && (!err.response || status === 408 || status === 429 || (status ?? 0) >= 500);
              if (attempt === 0 && (cancelled || (freshAfterSwap && transient))) continue;
              throw err;
            }
            if (!isCurrent()) return false;
            // A live event can invalidate this read. Retry once without publishing
            // stale data or flashing a failure while the replacement read is pending.
            const snapshot = readSessionResource<CurrentPlanSnapshot>(ownerId, currentPlanResource);
            if (!snapshot) continue;
            setError(null);
            setClinicalEvidenceRequired(false);
            applyCurrentPlan(snapshot);
            return true;
          }
          throw new Error('The meal plan changed while loading. Please retry loading.');
        } catch (err: unknown) {
          if (!isCurrent()) return false;
          const gate = axios.isAxiosError(err) ? err.response?.data?.errorCode : undefined;
          if (axios.isAxiosError(err) && err.response?.data?.errorCode === 'CLINICAL_EVIDENCE_REQUIRED') {
            setClinicalEvidenceRequired(true);
            setMeals([]);
            setPendingReview(null);
            setCycles(null);
            setAwaitingGeneration({ current: 0, upcoming: 0 });
            setGenerationStatus({ current: null, upcoming: null });
            invalidateSessionResource(ownerId, currentPlanResource);
          }
          if (axios.isAxiosError(err) && err.response?.data?.errorCode === 'PROFILE_REVIEW_REQUIRED') {
            setProfileReviewRequired(true);
            setMeals([]);
            setPendingReview(null);
            setCycles(null);
            invalidateSessionResource(ownerId, currentPlanResource);
          }
          // The committed swap will perform its own fresh read. An older background
          // failure must not overwrite its progress, but safety gates still apply.
          if (
            freshAfterSwap ||
            !swapInFlight.current ||
            gate === 'CLINICAL_EVIDENCE_REQUIRED' ||
            gate === 'PROFILE_REVIEW_REQUIRED'
          ) {
            setError(
              getApiErrorMessage(
                err,
                freshAfterSwap
                  ? 'Meal swapped, but the updated plan could not be loaded. Please retry.'
                  : 'Failed to fetch weekly plan menu.'
              )
            );
          }
          return false;
        } finally {
          if (isCurrent()) {
            currentPlanRequestInFlight.current = null;
            setIsLoading(false);
          }
        }
      })();
      return request.promise;
    },
    [applyCurrentPlan, ownerId, currentPlanResource]
  );

  const fetchMeals = useCallback(async () => {
    await loadCurrentPlan();
  }, [loadCurrentPlan]);

  useVisiblePolling(
    async () => {
      await fetchMeals();
      const status = await refreshClinicalProfileStatus(ownerId, cachedUserProfile(ownerId));
      setProfileReviewRequired(status.required && !status.approved);
    },
    { enabled: Boolean(ownerId), immediate: false, scopeKey: ownerId }
  );

  useEffect(() => {
    if (!cycles || cycles.current || generationStatus.current === 'FAILED' || error) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void fetchMeals();
    }, 5_000);
    return () => window.clearInterval(interval);
  }, [cycles, generationStatus, error, fetchMeals]);

  const history = useMealHistory(ownerId, activeTab === 'history', fetchMeals);
  const {
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
    fetchHistory,
    groupHistoryByDate,
    handleUpdateLogNotes,
    handleEditOutsideItem,
    handleVoidOutsideLog,
    handleRequestOutsideReview,
    handleReplyToOutsideReview,
    handleObservedConsent,
    handleObservedWithdraw,
  } = history;
  const libraryDate = selectedPlanDateKey ?? getManilaDateKey(meals[0]?.scheduledDate ?? new Date());
  const library = useMealLibrary(ownerId, activeTab === 'library', libraryDate);
  const {
    libraryMeals,
    isLibraryLoading,
    libraryTotalCount,
    libraryError,
    librarySearch,
    setLibrarySearch,
    libraryMealType,
    setLibraryMealType,
    libraryRiceRole,
    setLibraryRiceRole,
    libraryNextCursor,
    fetchLibrary,
  } = library;

  useEffect(() => {
    if (ownerId) {
      fetchMeals();

      let activeDateKey = getManilaDateKey();
      const refreshForDateRollover = () => {
        const nextDateKey = getManilaDateKey();
        if (nextDateKey !== activeDateKey) {
          activeDateKey = nextDateKey;
          fetchMeals();
        }
      };
      const refreshOnFocus = () => fetchMeals();
      const refreshOnVisibility = () => {
        if (document.visibilityState === 'visible') fetchMeals();
      };
      const rolloverInterval = window.setInterval(refreshForDateRollover, 60_000);
      window.addEventListener('focus', refreshOnFocus);
      document.addEventListener('visibilitychange', refreshOnVisibility);

      return () => {
        window.clearInterval(rolloverInterval);
        window.removeEventListener('focus', refreshOnFocus);
        document.removeEventListener('visibilitychange', refreshOnVisibility);
      };
    }
  }, [ownerId, fetchMeals]);

  useEffect(() => {
    const sourceMeals = [...meals, ...(pendingReview?.meals ?? [])];
    const availableDateKeys = Array.from(new Set(sourceMeals.map((meal) => getManilaDateKey(meal.scheduledDate))))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    if (availableDateKeys.length === 0) {
      setSelectedPlanDateKey(null);
      return;
    }

    setSelectedPlanDateKey((currentDateKey) => {
      if (currentDateKey && availableDateKeys.includes(currentDateKey)) return currentDateKey;
      const todayKey = getManilaDateKey();
      return (
        availableDateKeys.find((dateKey) => dateKey >= todayKey) ?? availableDateKeys[availableDateKeys.length - 1]
      );
    });
  }, [meals, pendingReview]);

  // Open Swap options modal and fetch eligible replacement meals
  const handleSwapClick = async (mealId: string, preferred?: SwapOption) => {
    if (swapInFlight.current) return;
    const meal = meals.find((m) => m.id === mealId);
    if (!meal) return;

    setActiveSwapMeal(meal);
    setIsOptionsLoading(true);
    setSwapOptionsError(null);
    setConfirmSwapMeal(null);
    setSwapPreview(null);

    try {
      const res = await api.get(`/user/meals/${mealId}/swap-options`);
      if (res.data?.success) {
        setSwapOptions(res.data.data.swapOptions);
        if (preferred) {
          if (!res.data.data.swapOptions.some((option: SwapOption) => option.id === preferred.id))
            throw new Error('This recipe is not eligible for that slot.');
          const preview = await api.get('/user/meals/' + mealId + '/swap-preview', {
            params: { libraryMealId: preferred.id },
          });
          setConfirmSwapMeal({ ...preferred, ...preview.data.data.replacement });
          setSwapPreview(preview.data.data);
        }
      }
    } catch (err: unknown) {
      setSwapOptionsError(getApiErrorMessage(err, 'Failed to load eligible swap options.'));
    } finally {
      setIsOptionsLoading(false);
    }
  };

  // Select a replacement meal options and call preview check
  const handleSelectSwapOption = async (option: SwapOption) => {
    if (!activeSwapMeal || swapInFlight.current) return;

    setConfirmSwapMeal(option);
    setIsCheckingPreview(true);
    setPreviewError(null);
    setSwapPreview(null);

    try {
      const res = await api.get(`/user/meals/${activeSwapMeal.id}/swap-preview`, {
        params: { libraryMealId: option.id },
      });
      if (res.data?.success) {
        const preview = res.data.data;
        setSwapPreview(preview);
        if (preview.replacement) setConfirmSwapMeal({ ...option, ...preview.replacement });
      }
    } catch (err: unknown) {
      setPreviewError(getApiErrorMessage(err, 'Failed to check swap preview.'));
    } finally {
      setIsCheckingPreview(false);
    }
  };

  // Submits the swap with warning acknowledged
  const handleConfirmSwapAnyway = async (groceryDeltaAcknowledged = false) => {
    if (swapInFlight.current || !activeSwapMeal || !confirmSwapMeal || !swapPreview) return;

    swapInFlight.current = true;
    const submittingOwner = ownerId;
    const toastId = `meal-swap-${swapPreview.requestKey}`;
    setIsSwapping(true);
    setSwapOptionsError(null);
    toast.loading('Swapping meal…', { id: toastId, description: 'Updating your meal plan and grocery list.' });

    try {
      const res = await api.post(`/user/meals/${activeSwapMeal.id}/swap`, {
        newLibraryMealId: confirmSwapMeal.id,
        previewToken: swapPreview.previewToken,
        requestKey: swapPreview.requestKey,
        warningShown: swapPreview.warningRequired,
        warningAcknowledged: true,
        groceryDeltaAcknowledged,
      });

      if (activePlanOwner.current !== submittingOwner) {
        toast.dismiss(toastId);
        return;
      }
      if (!res.data?.success) throw new Error(res.data?.error || 'Failed to complete swap.');
      const remaining = res.data.data?.swapsRemaining;
      setRefreshingSwapMealId(activeSwapMeal.id);
      window.dispatchEvent(new Event('nutrimind:notifications-updated'));
      setActiveSwapMeal(null);
      setSwapOptions([]);
      setConfirmSwapMeal(null);
      setSwapPreview(null);
      toast.loading('Meal swapped. Refreshing plan…', { id: toastId, description: 'Loading your updated meal plan.' });
      const refreshed = await loadCurrentPlan(true);
      if (activePlanOwner.current !== submittingOwner) {
        toast.dismiss(toastId);
        return;
      }
      if (refreshed) {
        toast.success('Meal swapped', {
          id: toastId,
          description: `${confirmSwapMeal.mealName} is now in your plan.${Number.isInteger(remaining) && remaining >= 0 ? ` ${remaining} ${remaining === 1 ? 'swap' : 'swaps'} left in this plan cycle.` : ''}`,
        });
      } else {
        toast.error('Meal swapped; plan refresh unavailable', {
          id: toastId,
          description: 'Your swap was saved. Reload the plan to see the update.',
        });
      }
    } catch (err: unknown) {
      if (activePlanOwner.current !== submittingOwner) {
        toast.dismiss(toastId);
        return;
      }
      const message = getApiErrorMessage(err, 'Failed to complete swap.');
      setSwapOptionsError(message);
      toast.error('Could not confirm meal swap', { id: toastId, description: message });
    } finally {
      swapInFlight.current = false;
      setIsSwapping(false);
      if (activePlanOwner.current === submittingOwner) setRefreshingSwapMealId(null);
    }
  };

  // Handles scheduled status checkoff toggles in the weekly view
  const handleMealStatusToggle = async (mealPlanId: string, newStatus: 'DONE' | 'SKIPPED' | 'PENDING') => {
    try {
      await api.patch(`/user/meals/${mealPlanId}/status`, { status: newStatus });
      // Reload current meals to update checkboxes and macro sums
      const res = await api.get('/user/meals/workspace');
      if (res.data && res.data.success) {
        applyCurrentPlan({
          meals: Array.isArray(res.data.data) ? res.data.data : [],
          pendingReview: res.data.meta?.pendingReview ?? null,
          awaitingGeneration: res.data.meta?.awaitingGeneration ?? { current: 0, upcoming: 0 },
          generationStatus: res.data.meta?.generationStatus ?? { current: null, upcoming: null },
          cycles: res.data.meta?.cycles ?? null,
        });
      }
      // Reload history so history tab and heatmap immediately update
      await fetchHistory();
    } catch (err) {
      console.error('[WeeklyPlan] Status toggle failed:', err);
    }
  };

  // Triggers full 7-day meal plan regeneration
  const handleRegeneratePlan = useCallback(
    async (options?: { replaceExisting?: boolean; skipConfirm?: boolean }) => {
      if (regenerationInFlight.current || pendingReview) return;

      if (meals.length > 0 && !options?.skipConfirm) {
        if (!confirm('Are you sure you want to cancel your current plan and generate a completely new 7-day AI plan?'))
          return;
      }

      regenerationInFlight.current = true;
      setIsRegenerating(true);
      regenerationProgress.begin('Preparing a replacement weekly plan.');
      setError(null);
      try {
        replanRequest.current ??= crypto.randomUUID();
        const res = await api.post('/user/meals/generate', {
          replaceExisting: options?.replaceExisting ?? meals.length > 0,
          requestKey: replanRequest.current,
        });
        if (!res.data?.success) throw new Error('Could not regenerate the weekly plan.');
        if (res.data.success) {
          replanRequest.current = null;
          regenerationProgress.complete('Your replacement plan is ready for review.');
          await fetchMeals();
        }
      } catch (err: unknown) {
        const msg = getApiErrorMessage(err, 'Gemini failed to regenerate weekly plan.');
        if (axios.isAxiosError(err) && err.response?.data?.errorCode === 'PROFILE_REVIEW_REQUIRED')
          setProfileReviewRequired(true);
        regenerationProgress.fail(msg);
        setError(msg);
      } finally {
        regenerationInFlight.current = false;
        setIsRegenerating(false);
      }
    },
    [pendingReview, meals.length, regenerationProgress, fetchMeals]
  );

  const retryMissingGeneration = async (cycleId: string) => {
    setIsRetryingMissing(true);
    try {
      await api.post(`/user/meals/cycles/${cycleId}/retry-generation`, {});
      await fetchMeals();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not retry the missing meal slots.'));
    } finally {
      setIsRetryingMissing(false);
    }
  };

  const repairRetiredMeals = async (cycleId: string) => {
    if (repairInFlight.current) return;
    repairInFlight.current = true;
    setIsRepairingRetired(true);
    setError(null);
    try {
      await api.post(`/user/meals/cycles/${cycleId}/replace-retired`, {});
      await fetchMeals();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not replace retired meals.'));
    } finally {
      repairInFlight.current = false;
      setIsRepairingRetired(false);
    }
  };

  const autoRegeneratedRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined' || autoRegeneratedRef.current) return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('regenerate') === 'true') {
        autoRegeneratedRef.current = true;
        window.history.replaceState({}, '', window.location.pathname);
        handleRegeneratePlan({ replaceExisting: true, skipConfirm: true });
      }
    } catch {
      // Safe fallback in non-browser environments
    }
  }, [handleRegeneratePlan]);

  const handleHistorySearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHistory();
  };

  const handleLibrarySearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLibrary();
  };

  // Group meals by date
  const groupMealsByDate = () => {
    const grouped: Record<string, MealPlan[]> = {};

    meals.forEach((meal) => {
      const dateKey = getManilaDateKey(meal.scheduledDate);
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(meal);
    });

    // Sort the keys chronologically
    return Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b))
      .map((dateKey) => {
        const dayMeals = grouped[dateKey];
        const parsedDate = manilaDateFromKey(dateKey);
        const weekday = formatManilaDate(parsedDate, { weekday: 'long' });
        const dateStr = formatManilaDate(parsedDate, { month: 'short', day: 'numeric' });

        // Sum calories and macros targets for the day
        const dayCalories = dayMeals.reduce((sum, m) => sum + m.calories, 0);
        const dayProtein = dayMeals.reduce((sum, m) => sum + m.proteinG, 0);
        const dayCarbs = dayMeals.reduce((sum, m) => sum + m.carbsG, 0);
        const dayFat = dayMeals.reduce((sum, m) => sum + m.fatG, 0);

        return {
          dateKey,
          weekday,
          dateStr,
          mealsList: dayMeals,
          dayCalories,
          dayProtein,
          dayCarbs,
          dayFat,
        };
      });
  };

  const groupPendingMealsByDate = () => {
    const grouped: Record<string, PendingMealPreview[]> = {};

    pendingReview?.meals.forEach((meal) => {
      const dateKey = getManilaDateKey(meal.scheduledDate);
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(meal);
    });

    return Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b))
      .map((dateKey) => {
        const parsedDate = manilaDateFromKey(dateKey);
        return {
          dateKey,
          weekday: formatManilaDate(parsedDate, { weekday: 'long' }),
          dateStr: formatManilaDate(parsedDate, { month: 'short', day: 'numeric' }),
          mealsList: grouped[dateKey],
        };
      });
  };

  const groupedDays = groupMealsByDate();
  const groupedPendingDays = groupPendingMealsByDate();
  const displayedPlanDays = Array.from(
    new Set([...groupedDays.map((day) => day.dateKey), ...groupedPendingDays.map((day) => day.dateKey)])
  )
    .sort((a, b) => a.localeCompare(b))
    .map((dateKey) => {
      const approvedDay = groupedDays.find((day) => day.dateKey === dateKey);
      const pendingDay = groupedPendingDays.find((day) => day.dateKey === dateKey);
      const parsedDate = manilaDateFromKey(dateKey);
      return {
        dateKey,
        weekday: approvedDay?.weekday ?? pendingDay?.weekday ?? formatManilaDate(parsedDate, { weekday: 'long' }),
        dateStr:
          approvedDay?.dateStr ??
          pendingDay?.dateStr ??
          formatManilaDate(parsedDate, { month: 'short', day: 'numeric' }),
        mealsList: [...(approvedDay?.mealsList ?? []), ...(pendingDay?.mealsList ?? [])],
      };
    });
  const selectedPlanDayIndex = Math.max(
    0,
    displayedPlanDays.findIndex((day) => day.dateKey === selectedPlanDateKey)
  );
  const selectedPlanDay = displayedPlanDays[selectedPlanDayIndex] ?? null;
  const isStarterPlan =
    cycles?.current?.planType === 'STARTER' ||
    (!cycles?.current && (meals[0]?.planType === 'STARTER' || pendingReview?.planType === 'STARTER'));

  const starterMeals = [
    ...meals.filter((m) => m.planType === 'STARTER'),
    ...(pendingReview?.meals?.filter((m) => m.planType === 'STARTER') ?? []),
  ].sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());

  const starterFirstDate =
    isStarterPlan && starterMeals.length > 0
      ? manilaDateFromKey(getManilaDateKey(starterMeals[0].scheduledDate))
      : isStarterPlan && cycles?.current?.startDate
        ? manilaDateFromKey(getManilaDateKey(cycles.current.startDate))
        : null;

  const starterLastDate =
    isStarterPlan && starterMeals.length > 0
      ? manilaDateFromKey(getManilaDateKey(starterMeals[starterMeals.length - 1].scheduledDate))
      : isStarterPlan && cycles?.current?.endDate
        ? manilaDateFromKey(getManilaDateKey(cycles.current.endDate))
        : null;

  const nextCycleDay = (() => {
    if (!isStarterPlan) return null;
    if (cycles?.upcoming?.startDate) {
      return formatManilaDate(manilaDateFromKey(getManilaDateKey(cycles.upcoming.startDate)), {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
    }
    const weeklyMeals = [
      ...meals.filter((m) => m.planType === 'WEEKLY'),
      ...(pendingReview?.meals?.filter((m) => m.planType === 'WEEKLY') ?? []),
    ].sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
    if (weeklyMeals.length > 0) {
      return formatManilaDate(manilaDateFromKey(getManilaDateKey(weeklyMeals[0].scheduledDate)), {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
    }
    if (starterLastDate) {
      const dayAfter = new Date(starterLastDate);
      dayAfter.setDate(dayAfter.getDate() + 1);
      return formatManilaDate(dayAfter, { weekday: 'long', month: 'short', day: 'numeric' });
    }
    return null;
  })();
  const displayedMealCount = meals.length + (pendingReview?.mealCount ?? 0);
  const completedMealCount = meals.filter((meal) => meal.mealLogs?.some((log) => log.status === 'DONE')).length;
  return {
    ownerId,
    user,
    activeTab,
    setActiveTab,
    meals,
    isLoading,
    isRegenerating,
    regenerationProgress,
    error,
    clinicalEvidenceRequired,
    profileReviewRequired,
    pendingReview,
    awaitingGeneration,
    generationStatus,
    isRetryingMissing,
    retryPlanLoad: fetchMeals,
    retryMissingGeneration,
    repairRetiredMeals,
    isRepairingRetired,
    cycles,
    selectedPlanDateKey,
    setSelectedPlanDateKey,
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
    refreshingSwapMealId,
    swapPreview,
    setSwapPreview,
    isCheckingPreview,
    previewError,
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
    libraryMeals,
    isLibraryLoading,
    libraryTotalCount,
    libraryError,
    librarySearch,
    setLibrarySearch,
    selectedVerifier,
    setSelectedVerifier,
    libraryMealType,
    setLibraryMealType,
    libraryRiceRole,
    setLibraryRiceRole,
    libraryNextCursor,
    retryLibrary: () => fetchLibrary(),
    loadMoreLibrary: () => (libraryNextCursor ? fetchLibrary(libraryNextCursor) : Promise.resolve()),
    handleSwapClick,
    handleSelectSwapOption,
    handleConfirmSwapAnyway,
    handleMealStatusToggle,
    handleRegeneratePlan,
    setIsRegenerating,
    handleHistorySearchSubmit,
    handleLibrarySearchSubmit,
    groupHistoryByDate,
    groupedDays,
    groupedPendingDays,
    displayedPlanDays,
    selectedPlanDayIndex,
    selectedPlanDay,
    isStarterPlan,
    starterFirstDate,
    starterLastDate,
    nextCycleDay,
    displayedMealCount,
    completedMealCount,
  };
}

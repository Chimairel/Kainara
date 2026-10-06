import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import { normalizeFoodCulture } from '@/lib/profile-normalization';
import { useAuth } from '@/hooks/useAuth';
import { readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';
import { getRecentUserProfile, refreshUserProfile } from '@/lib/user-profile-resource';
import type { UserProfileData } from '@/hooks/useProfile';
import { groupWeightObservations } from './weight-chart-data';

export type ProgressSection = 'overview' | 'profile' | 'safety' | 'history';
export type ProgressWorkspaceMode = 'progress' | 'health' | 'planning';

export interface WeightLog {
  id: string;
  weightKg: number;
  note: string | null;
  loggedAt: string;
  source?: 'ONBOARDING' | 'INITIAL_REPORT' | 'LOG';
}

export interface DailyNutritionLog {
  id: string;
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  targetCalories: number;
  adherencePct: number;
  logDate: string;
}

export type ProfileDetails = UserProfileData;

export interface ProgressHistory {
  weightLogs: WeightLog[];
  dailyNutritionLogs: DailyNutritionLog[];
}

interface ProgressPageSnapshot {
  history: ProgressHistory | null;
  profileData: ProfileDetails | null;
}

export function useProgressWorkspace(mode: ProgressWorkspaceMode) {
  const router = useRouter();
  const { user, updateUserSession } = useAuth();
  const ownerId = user?.userId;
  const cachedPage = readSessionResource<ProgressPageSnapshot>(ownerId, 'user-progress-page');
  const cachedProfile = cachedPage?.profileData?.userProfile;
  const [activeSection, setActiveSection] = useState<ProgressSection>(mode !== 'progress' ? 'profile' : 'overview');
  const [history, setHistory] = useState<ProgressHistory | null>(cachedPage?.history ?? null);
  const [profileData, setProfileData] = useState<ProfileDetails | null>(cachedPage?.profileData ?? null);
  const [isLoading, setIsLoading] = useState(!cachedPage);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'year'>('week');

  // Form State - Biometrics & Preferences
  const [age, setAge] = useState(String(cachedProfile?.age || ''));
  const [heightCm, setHeightCm] = useState(String(cachedProfile?.heightCm || ''));
  const [weightKg, setWeightKg] = useState(String(cachedProfile?.weightKg || ''));
  const [targetWeightKg, setTargetWeightKg] = useState(
    String(cachedProfile?.targetWeightKg ?? (cachedProfile?.goal === 'MAINTAIN' ? cachedProfile?.weightKg : '') ?? '')
  );
  const [biologicalSex, setBiologicalSex] = useState(cachedProfile?.biologicalSex || 'MALE');
  const [goal, setGoal] = useState(cachedProfile?.goal || 'MAINTAIN');
  const [activityLevel, setActivityLevel] = useState(cachedProfile?.activityLevel || 'SEDENTARY');
  const [dietaryPreference, setDietaryPreference] = useState(cachedProfile?.dietaryPreference || 'OMNIVORE');
  const [ricePreference, setRicePreference] = useState(cachedProfile?.ricePreference || 'FLEXIBLE');
  const [foodCulture, setFoodCulture] = useState(normalizeFoodCulture(cachedProfile?.foodCulture));
  const [shoppingDayOfWeek, setShoppingDayOfWeek] = useState(
    typeof cachedProfile?.shoppingDayOfWeek === 'number'
      ? cachedProfile.shoppingDayOfWeek
      : cachedProfile?.shoppingDayGroup === 'WEEKDAY'
        ? 0
        : 6
  );
  const [isSavingBiometrics, setIsSavingBiometrics] = useState(false);
  const [biometricsSuccess, setBiometricsSuccess] = useState<string | null>(null);
  const [biometricsError, setBiometricsError] = useState<string | null>(null);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);

  const [healthSuccess, setHealthSuccess] = useState<string | null>(null);

  // Form State - New Weight Reading
  const [isLogFormOpen, setIsLogFormOpen] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [isSubmittingWeight, setIsSubmittingWeight] = useState(false);
  const [weightFormError, setWeightFormError] = useState<string | null>(null);
  const [weightSuccess, setWeightSuccess] = useState<string | null>(null);

  // Fetch progress history and profile info
  const fetchPageData = useCallback(
    async (silent = false, signal?: AbortSignal) => {
      setError(null);
      try {
        const [historyRes, profileRes] = await Promise.all([
          mode === 'progress'
            ? api.get('/user/progress/history', { signal }).catch((err: unknown) => {
                setError(getApiErrorMessage(err, 'Failed to fetch progress metrics.'));
                return { data: { success: false, data: null } };
              })
            : Promise.resolve({ data: { success: false, data: null } }),
          (silent ? refreshUserProfile(ownerId) : getRecentUserProfile(ownerId)).then((data) => ({
            data: { success: true, data },
          })),
        ]);

        if (signal?.aborted) return;
        const nextHistory = historyRes.data?.success ? (historyRes.data.data as ProgressHistory) : null;
        const nextProfile = profileRes.data?.success ? (profileRes.data.data as ProfileDetails) : null;

        if (historyRes.data && historyRes.data.success) {
          setHistory(nextHistory);
        }
        if (profileRes.data && profileRes.data.success) {
          const data = nextProfile as ProfileDetails;
          setProfileData(data);

          // Pre-populate biometric form states
          if (data.userProfile && !silent) {
            setAge(String(data.userProfile.age || ''));
            setHeightCm(String(data.userProfile.heightCm || ''));
            setWeightKg(String(data.userProfile.weightKg || ''));
            setTargetWeightKg(
              String(
                data.userProfile.targetWeightKg ??
                  (data.userProfile.goal === 'MAINTAIN' ? data.userProfile.weightKg : '') ??
                  ''
              )
            );
            setBiologicalSex(data.userProfile.biologicalSex || 'MALE');
            setGoal(data.userProfile.goal || 'MAINTAIN');
            setActivityLevel(data.userProfile.activityLevel || 'SEDENTARY');
            setDietaryPreference(data.userProfile.dietaryPreference || 'OMNIVORE');
            setRicePreference(data.userProfile.ricePreference || 'FLEXIBLE');
            setFoodCulture(normalizeFoodCulture(data.userProfile.foodCulture));
            setShoppingDayOfWeek(
              typeof data.userProfile.shoppingDayOfWeek === 'number'
                ? data.userProfile.shoppingDayOfWeek
                : data.userProfile.shoppingDayGroup === 'WEEKDAY'
                  ? 0
                  : 6
            );
          }
        }
        writeSessionResource(ownerId, 'user-progress-page', {
          history: nextHistory,
          profileData: nextProfile,
        });
        if (nextProfile) writeSessionResource(ownerId, 'user-profile', nextProfile);
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, 'Failed to fetch progress metrics.'));
      } finally {
        setIsLoading(false);
      }
    },
    [ownerId, mode]
  );

  useVisiblePolling(
    async (signal) => {
      await fetchPageData(true, signal);
    },
    { enabled: Boolean(ownerId) && !isSavingBiometrics && !isSubmittingWeight, immediate: false, scopeKey: ownerId }
  );

  useEffect(() => {
    if (ownerId) {
      fetchPageData();
    }
  }, [ownerId, fetchPageData]);

  useEffect(() => {
    if (!ownerId || (!history && !profileData)) return;
    writeSessionResource(ownerId, 'user-progress-page', { history, profileData });
  }, [ownerId, history, profileData]);

  // Handles updating biometrics and preferences form
  const handleBiometricsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBiometrics(true);
    setBiometricsError(null);
    setBiometricsSuccess(null);

    try {
      // 1. Save profile stats and shopping day preference in a single call
      const payload: Record<string, unknown> = {
        dietaryPreference,
        ricePreference,
        shoppingDayOfWeek,
      };

      const parsedAge = parseInt(age, 10);
      if (Number.isFinite(parsedAge) && parsedAge >= 18) {
        payload.age = parsedAge;
      } else if (profileData?.userProfile?.age) {
        payload.age = profileData.userProfile.age;
      }

      const parsedHeight = parseFloat(heightCm);
      if (Number.isFinite(parsedHeight) && parsedHeight > 0) {
        payload.heightCm = parsedHeight;
      } else if (profileData?.userProfile?.heightCm) {
        payload.heightCm = profileData.userProfile.heightCm;
      }

      const parsedWeight = parseFloat(weightKg);
      if (Number.isFinite(parsedWeight) && parsedWeight > 0) {
        payload.weightKg = parsedWeight;
      } else if (profileData?.userProfile?.weightKg) {
        payload.weightKg = profileData.userProfile.weightKg;
      }

      const effectiveGoal = goal || profileData?.userProfile?.goal || 'MAINTAIN';
      payload.goal = effectiveGoal;

      const effectiveWeight = (payload.weightKg as number | undefined) ?? profileData?.userProfile?.weightKg ?? 60;
      const parsedTargetWeight = parseFloat(targetWeightKg);

      if (effectiveGoal === 'MAINTAIN') {
        payload.targetWeightKg = effectiveWeight;
      } else if (Number.isFinite(parsedTargetWeight) && parsedTargetWeight >= 30) {
        payload.targetWeightKg = parsedTargetWeight;
      } else if (profileData?.userProfile?.targetWeightKg) {
        payload.targetWeightKg = profileData.userProfile.targetWeightKg;
      } else {
        payload.targetWeightKg = effectiveWeight;
      }

      if (biologicalSex) {
        payload.biologicalSex = biologicalSex;
      } else if (profileData?.userProfile?.biologicalSex) {
        payload.biologicalSex = profileData.userProfile.biologicalSex;
      }

      if (activityLevel) {
        payload.activityLevel = activityLevel;
      } else if (profileData?.userProfile?.activityLevel) {
        payload.activityLevel = profileData.userProfile.activityLevel;
      }

      if (mode === 'health') {
        // A body correction must not submit hidden planning controls or derive a new goal.
        for (const field of [
          'dietaryPreference',
          'ricePreference',
          'planningGeographyLevel',
          'planningRegionName',
          'planningProvinceHucName',
          'shoppingDayOfWeek',
        ])
          delete payload[field];
        if (goal === profileData?.userProfile?.goal) delete payload.goal;
        if (activityLevel === profileData?.userProfile?.activityLevel) delete payload.activityLevel;
        const savedTarget =
          profileData?.userProfile?.targetWeightKg ??
          (profileData?.userProfile?.goal === 'MAINTAIN' ? profileData?.userProfile?.weightKg : '') ??
          '';
        if (targetWeightKg === String(savedTarget)) delete payload.targetWeightKg;
      }

      const profileUpdate = await api.put('/user/profile', payload);

      if (profileUpdate.data && profileUpdate.data.success) {
        const savedReport = profileUpdate.data.data.nutritionReport;
        updateUserSession({
          reportAcknowledged:
            profileUpdate.data.data.reportAcknowledged ?? (!!savedReport?.acknowledgedAt && !savedReport?.isStale),
        });
        setBiometricsSuccess('Biometrics and dietary preferences updated successfully! Calorie budget recalculated.');
        setProfileData(profileUpdate.data.data);
        writeSessionResource(ownerId, 'user-progress-page', {
          history,
          profileData: profileUpdate.data.data,
        });
        writeSessionResource(ownerId, 'user-profile', profileUpdate.data.data);
        setShowRegenerateModal(true);
      }
    } catch (err: unknown) {
      setBiometricsError(getApiErrorMessage(err, 'Failed to update biometrics.'));
    } finally {
      setIsSavingBiometrics(false);
    }
  };

  // Handles logging a new weight reading
  const handleLogWeightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const weightNum = parseFloat(weightInput);
    if (isNaN(weightNum) || weightNum <= 0) {
      setWeightFormError('Please enter a valid positive weight.');
      return;
    }

    setIsSubmittingWeight(true);
    setWeightFormError(null);
    setWeightSuccess(null);
    try {
      const res = await api.post('/user/progress/weight', {
        weightKg: weightNum,
        ...(noteInput.trim() ? { note: noteInput.trim() } : {}),
      });

      if (res.data && res.data.success) {
        setWeightSuccess('Weight logged! Your daily calorie target has been recalculated.');
        setWeightInput('');
        setNoteInput('');
        setIsLogFormOpen(false);

        // Reload history & profile info to update graphs and target labels
        const [historyRes, profileRes] = await Promise.all([
          api.get('/user/progress/history'),
          api.get('/user/profile'),
        ]);

        if (historyRes.data && historyRes.data.success) {
          setHistory(historyRes.data.data);
        }
        if (profileRes.data && profileRes.data.success) {
          setProfileData(profileRes.data.data);
          const savedReport = profileRes.data.data.nutritionReport;
          updateUserSession({
            reportAcknowledged:
              profileRes.data.data.reportAcknowledged ?? (!!savedReport?.acknowledgedAt && !savedReport?.isStale),
          });
        }
        writeSessionResource(ownerId, 'user-progress-page', {
          history: historyRes.data?.success ? historyRes.data.data : history,
          profileData: profileRes.data?.success ? profileRes.data.data : profileData,
        });
        if (profileRes.data?.success) {
          writeSessionResource(ownerId, 'user-profile', profileRes.data.data);
        }
      }
    } catch (err: unknown) {
      setWeightFormError(getApiErrorMessage(err, 'Failed to log weight.'));
    } finally {
      setIsSubmittingWeight(false);
    }
  };

  const groupedLogs = React.useMemo(
    () => groupWeightObservations(history?.weightLogs ?? [], timeframe),
    [history?.weightLogs, timeframe]
  );

  const targetWeight = profileData?.userProfile?.targetWeightKg || 0;
  const currentWeight = profileData?.userProfile?.weightKg || 0;
  const dailyCalorieTarget = profileData?.userProfile?.dailyCalorieTarget || 0;

  return {
    router,
    user,
    activeSection,
    setActiveSection,
    history,
    profileData,
    setProfileData,
    isLoading,
    error,
    timeframe,
    setTimeframe,
    age,
    setAge,
    heightCm,
    setHeightCm,
    weightKg,
    setWeightKg,
    targetWeightKg,
    setTargetWeightKg,
    biologicalSex,
    setBiologicalSex,
    goal,
    setGoal,
    activityLevel,
    setActivityLevel,
    dietaryPreference,
    setDietaryPreference,
    ricePreference,
    setRicePreference,
    foodCulture,
    setFoodCulture,
    shoppingDayOfWeek,
    setShoppingDayOfWeek,
    isSavingBiometrics,
    biometricsSuccess,
    biometricsError,
    showRegenerateModal,
    setShowRegenerateModal,
    healthSuccess,
    setHealthSuccess,
    isLogFormOpen,
    setIsLogFormOpen,
    weightInput,
    setWeightInput,
    noteInput,
    setNoteInput,
    isSubmittingWeight,
    weightFormError,
    setWeightFormError,
    weightSuccess,
    setWeightSuccess,
    handleBiometricsSubmit,
    handleLogWeightSubmit,
    groupedLogs,
    targetWeight,
    currentWeight,
    dailyCalorieTarget,
    fetchPageData,
  };
}

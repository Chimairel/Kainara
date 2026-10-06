'use client';

import { useEffect } from 'react';

import { useBreadcrumb } from '@/lib/context/BreadcrumbContext';

import { useProgressWorkspace, type ProgressWorkspaceMode } from '@/features/progress/useProgressWorkspace';
import { useMembership } from '@/features/membership/MembershipProvider';

export function useProgressWorkspaceModel({ mode = 'progress' }: { mode?: ProgressWorkspaceMode }) {
  const { data: membership } = useMembership();
  const {
    router,
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
  } = useProgressWorkspace(mode);

  const { setSubTab } = useBreadcrumb();

  // Read initial tab from URL if present
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    const allowed =
      mode === 'progress'
        ? ['overview', 'history', 'adherence']
        : mode === 'health'
          ? ['profile', 'safety']
          : ['profile'];
    if (tabParam && allowed.includes(tabParam.toLowerCase())) {
      const mapped =
        tabParam.toLowerCase() === 'adherence' ? 'history' : (tabParam.toLowerCase() as typeof activeSection);
      setActiveSection(mapped);
    }
  }, [setActiveSection, mode]);

  // Sync activeSection with breadcrumb and URL
  useEffect(() => {
    const label = activeSection === 'history' ? 'adherence' : activeSection;
    setSubTab(label);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (activeSection === 'overview') {
        url.searchParams.delete('tab');
      } else {
        url.searchParams.set('tab', label);
      }
      window.history.replaceState(null, '', url.pathname + url.search);
    }
  }, [activeSection, setSubTab]);

  return {
    kind: 'ready' as const,
    mode,
    setIsLogFormOpen,
    activeSection,
    isLogFormOpen,
    setActiveSection,
    setWeightFormError,
    setWeightSuccess,
    router,
    membership,
    error,
    fetchPageData,
    weightSuccess,
    isLoading,
    currentWeight,
    targetWeight,
    weightFormError,
    handleLogWeightSubmit,
    weightInput,
    setWeightInput,
    noteInput,
    setNoteInput,
    isSubmittingWeight,
    dailyCalorieTarget,
    timeframe,
    setTimeframe,
    groupedLogs,
    history,
    goal,
    biometricsSuccess,
    biometricsError,
    handleBiometricsSubmit,
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
    setGoal,
    activityLevel,
    setActivityLevel,
    dietaryPreference,
    setDietaryPreference,
    ricePreference,
    setRicePreference,
    shoppingDayOfWeek,
    setShoppingDayOfWeek,
    isSavingBiometrics,
    healthSuccess,
    profileData,
    setHealthSuccess,
    setProfileData,
    showRegenerateModal,
    setShowRegenerateModal,
  };
}

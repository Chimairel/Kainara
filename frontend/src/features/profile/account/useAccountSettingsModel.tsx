'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useMembership } from '@/features/membership/MembershipProvider';
import { readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';

import api, { setSessionRefreshSuppressed } from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';

import { ProfilePanel, ACCOUNT_DELETION_CONFIRMATION, BasicMealLog } from './AccountSettings.shared';
export function useAccountSettingsModel({ initialPanel = 'account' }: { initialPanel?: ProfilePanel }) {
  const { logout, completeAccountDeletion, user, updateUserSession } = useAuth();
  const { profile } = useProfile();
  const { data: membership } = useMembership();
  const [activePanel, setActivePanel] = useState<ProfilePanel>(initialPanel);

  // Meal history state for personal stats
  const [mealLogs, setMealLogs] = useState<BasicMealLog[]>(() => {
    return readSessionResource<BasicMealLog[]>(user?.userId, 'user-meal-history-all') || [];
  });

  useEffect(() => {
    if (user?.role !== 'USER') return;
    let active = true;
    api
      .get('/user/meals/history')
      .then((res) => {
        if (active && res.data?.success && Array.isArray(res.data.data)) {
          setMealLogs(res.data.data);
          writeSessionResource(user?.userId, 'user-meal-history-all', res.data.data);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [user?.role, user?.userId]);

  // Derived user statistics and biometrics
  const profileData = profile?.userProfile;
  const heightCm = profileData?.heightCm;
  const weightKg = profileData?.weightKg;
  const targetWeightKg = profileData?.targetWeightKg;

  const bmi = heightCm && weightKg && heightCm > 0 ? Number((weightKg / Math.pow(heightCm / 100, 2)).toFixed(1)) : null;

  const bmiCategory = bmi
    ? bmi < 18.5
      ? { label: 'Underweight', badge: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400' }
      : bmi < 25
        ? {
            label: 'Normal weight',
            badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
          }
        : bmi < 30
          ? { label: 'Overweight', badge: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400' }
          : { label: 'Obese', badge: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400' }
    : null;

  const weightDelta = weightKg && targetWeightKg ? Number((weightKg - targetWeightKg).toFixed(1)) : null;

  const completedLogs = mealLogs.filter((m) => m.status === 'DONE');
  const insideMealsCount = completedLogs.filter((m) => m.source !== 'USER_LOGGED').length;
  const outsideMealsCount = completedLogs.filter((m) => m.source === 'USER_LOGGED').length;
  const totalCompletedMeals = insideMealsCount + outsideMealsCount;
  const insideRatio = totalCompletedMeals > 0 ? Math.round((insideMealsCount / totalCompletedMeals) * 100) : 0;
  const outsideRatio = totalCompletedMeals > 0 ? 100 - insideRatio : 0;

  const trackedDaysCount = new Set(completedLogs.map((m) => (m.loggedAt ? m.loggedAt.split('T')[0] : ''))).size;

  const conditionsCount = profile?.healthConditions?.length ?? 0;
  const allergiesCount = profile?.allergies?.length ?? 0;
  const restrictionsCount = conditionsCount + allergiesCount;

  const membershipTitle =
    membership && membership.enabled
      ? membership.level === 'TRIAL'
        ? 'Health'
        : membership.level === 'MEMBER'
          ? membership.tier === 'LIFESTYLE'
            ? 'Lifestyle Member'
            : 'Health Member'
          : 'Free Member'
      : 'Standard Member';

  // Account settings form state
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [accountSuccess, setAccountSuccess] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);

  // Password update form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [deletionPassword, setDeletionPassword] = useState('');
  const [deletionConfirmation, setDeletionConfirmation] = useState('');
  const [deletionError, setDeletionError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const deletionConfirmed =
    deletionConfirmation === ACCOUNT_DELETION_CONFIRMATION || deletionConfirmation === 'DELETE MY NUTRIMIND ACCOUNT';
  const deletionConfirmationMismatch = deletionConfirmation.length > 0 && !deletionConfirmed;
  const passwordLoginEnabled = user?.authMethods?.password !== false;

  const deleteAccount = async (credential: { password?: string }) => {
    setSessionRefreshSuppressed(true);
    try {
      await api.delete('/user/account', {
        data: {
          ...credential,
          confirmation: deletionConfirmation,
        },
      });
      completeAccountDeletion();
    } catch (error) {
      setSessionRefreshSuppressed(false);
      throw error;
    }
  };

  const handleDeleteAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsDeleting(true);
    setDeletionError(null);
    try {
      await deleteAccount(passwordLoginEnabled ? { password: deletionPassword } : {});
    } catch (error: unknown) {
      setDeletionError(getApiErrorMessage(error, 'Account deletion failed.'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Save Account Credentials Update
  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAccount(true);
    setAccountError(null);
    setAccountSuccess(null);

    try {
      const res = await api.put('/user/profile/settings', {
        name,
        email,
      });

      if (res.data && res.data.success) {
        setAccountSuccess('Account settings updated successfully!');
        updateUserSession({
          name: res.data.data.name,
          email: res.data.data.email,
          emailVerified: res.data.data.emailVerified,
        });
      }
    } catch (err: unknown) {
      setAccountError(getApiErrorMessage(err, 'Failed to update account settings.'));
    } finally {
      setIsSavingAccount(false);
    }
  };

  // Handle Password Update
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      const res = await api.put('/user/profile/settings', {
        currentPassword,
        newPassword,
      });

      if (res.data && res.data.success) {
        setPasswordSuccess('Password changed. Please sign in again.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        await logout();
      }
    } catch (err: unknown) {
      setPasswordError(getApiErrorMessage(err, 'Failed to update password.'));
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (!user) {
    return {
      kind: 'early' as const,
      view: <div className="text-brand-muted text-center mt-20">Please log in to view settings.</div>,
    };
  }

  return {
    kind: 'ready' as const,
    initialPanel,
    user,
    activePanel,
    setActivePanel,
    totalCompletedMeals,
    insideRatio,
    insideMealsCount,
    outsideRatio,
    outsideMealsCount,
    trackedDaysCount,
    bmiCategory,
    weightKg,
    heightCm,
    targetWeightKg,
    weightDelta,
    bmi,
    profileData,
    restrictionsCount,
    membershipTitle,
    accountSuccess,
    accountError,
    handleAccountSubmit,
    name,
    setName,
    email,
    setEmail,
    isSavingAccount,
    passwordLoginEnabled,
    passwordSuccess,
    passwordError,
    handlePasswordSubmit,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    passwordsMismatch,
    isUpdatingPassword,
    updateUserSession,
    handleDeleteAccount,
    deletionError,
    deletionPassword,
    setDeletionPassword,
    deletionConfirmation,
    setDeletionConfirmation,
    deletionConfirmationMismatch,
    isDeleting,
    deletionConfirmed,
    logout,
  };
}

'use client';

import Link from 'next/link';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useMembership } from '@/features/membership/MembershipProvider';
import { readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PasswordInput from '@/components/ui/PasswordInput';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import Avatar from '@/components/ui/Avatar';
import AvatarSettings from '@/features/profile/AvatarSettings';
import api, { setSessionRefreshSuppressed } from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  User,
  Lock,
  CheckCircle,
  AlertTriangle,
  LogOut,
  Mail,
  Palette,
  ShieldCheck,
  Trash2,
  Utensils,
  ChefHat,
  Compass,
  Scale,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

type ProfilePanel = 'account' | 'security' | 'avatar' | 'privacy';
const ACCOUNT_DELETION_CONFIRMATION = 'DELETE MY KAINARA ACCOUNT';

interface BasicMealLog {
  id: string;
  source?: string;
  status?: string;
  loggedAt?: string;
  calories?: number;
}

export default function AccountSettings({ initialPanel = 'account' }: { initialPanel?: ProfilePanel }) {
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

  const bmi =
    heightCm && weightKg && heightCm > 0
      ? Number((weightKg / Math.pow(heightCm / 100, 2)).toFixed(1))
      : null;

  const bmiCategory = bmi
    ? bmi < 18.5
      ? { label: 'Underweight', badge: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400' }
      : bmi < 25
        ? { label: 'Normal weight', badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' }
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

  const trackedDaysCount = new Set(
    completedLogs.map((m) => (m.loggedAt ? m.loggedAt.split('T')[0] : ''))
  ).size;

  const conditionsCount = profile?.healthConditions?.length ?? 0;
  const allergiesCount = profile?.allergies?.length ?? 0;
  const restrictionsCount = conditionsCount + allergiesCount;

  const membershipTitle =
    membership && membership.enabled
      ? membership.level === 'TRIAL'
        ? 'Health Trial'
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
  const googleLoginEnabled = Boolean(user?.authMethods?.google);

  const deleteAccount = async (credential: { password?: string; googleIdToken?: string }) => {
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
      await deleteAccount({ password: deletionPassword });
    } catch (error: unknown) {
      setDeletionError(getApiErrorMessage(error, 'Account deletion failed.'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGoogleDeleteAccount = async (googleIdToken: string) => {
    setIsDeleting(true);
    setDeletionError(null);
    try {
      await deleteAccount({ googleIdToken });
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
        setPasswordSuccess('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: unknown) {
      setPasswordError(getApiErrorMessage(err, 'Failed to update password.'));
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (!user) {
    return <div className="text-brand-muted text-center mt-20">Please log in to view settings.</div>;
  }

  return (
    <div className="portal-page max-w-5xl space-y-5 text-left text-brand-text">
      <Link href="/profile" className="inline-block text-sm font-semibold text-brand-green">
        ← Profile
      </Link>
      <PortalPageHeader
        icon={User}
        eyebrow="Personal identity"
        title={initialPanel === 'account' ? 'Personal details' : 'Security & privacy'}
        description="Manage your identity, security, and profile appearance from one focused workspace."
        className="mb-6"
      />

      <section className="relative overflow-hidden rounded-[28px] border border-brand-border/70 bg-brand-surface p-5 shadow-card sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-brand-green/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar
            size="lg"
            src={user.image}
            fallbackText={user.name}
            className="h-20 w-20 rounded-full shadow-lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-display text-2xl font-black tracking-tight text-brand-text">{user.name}</h2>
              <span className="rounded-full bg-brand-green/10 px-2.5 py-1 font-mono text-[8px] font-bold uppercase tracking-wider text-brand-green">
                {user.role}
              </span>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-brand-muted">
              <Mail className="h-3.5 w-3.5" />
              {user.email}
            </p>
            <p className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-brand-green">
              <ShieldCheck className="h-3.5 w-3.5" />
              Email and account details
            </p>
          </div>
        </div>
      </section>

      <nav
        className="grid grid-cols-2 gap-1 rounded-[22px] border border-brand-border/70 bg-brand-surface/80 p-1.5 shadow-sm sm:grid-cols-2"
        aria-label="Profile settings sections"
      >
        {(
          [
            ['account', 'Account', User],
            ['security', 'Security', Lock],
            ['avatar', 'Avatar', Palette],
            ['privacy', 'Privacy', Trash2],
          ] as const
        )
          .filter(([value]) =>
            initialPanel === 'account' ? ['account', 'avatar'].includes(value) : ['security', 'privacy'].includes(value)
          )
          .map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActivePanel(value)}
              aria-current={activePanel === value ? 'page' : undefined}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-2xl px-3 text-xs font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-brand-green/30 ${activePanel === value ? 'bg-brand-accent text-[#07100d] shadow-neon' : 'text-brand-muted hover:bg-brand-bgAlt hover:text-brand-text'}`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
      </nav>

      {activePanel === 'account' && (
        <div className="space-y-6">
          {user.role === 'USER' && (
            <div className="space-y-5">
              {/* Header */}
              <div>
                <h2 className="font-display text-base font-black text-brand-text">Personal Activity & Nutrition Profile</h2>
                <p className="mt-0.5 text-xs text-brand-muted">
                  Habits, biometric baseline, and meals tracked across your KAINARA journey.
                </p>
              </div>

              {/* Meals Eaten: Inside KAINARA vs Outside Dining */}
              <Card className="overflow-hidden border-brand-border/70 bg-brand-surface p-5 sm:p-6 shadow-card">
                <div className="flex flex-col gap-2 border-b border-brand-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand-green/20 bg-brand-green/10 text-brand-green dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-400">
                      <Utensils className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="font-display text-sm font-bold text-brand-text">Meals Inside vs Outside KAINARA</h3>
                      <p className="text-[11px] text-brand-muted">Distribution of planned home nutrition vs logged outside dining</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-brand-border bg-brand-bgAlt px-3 py-1 font-mono text-[11px] font-semibold text-brand-text dark:border-white/[0.08] dark:bg-white/[0.04]">
                      {totalCompletedMeals} total meal{totalCompletedMeals === 1 ? '' : 's'} recorded
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Inside Kainara Card */}
                  <div className="relative overflow-hidden rounded-2xl border border-brand-green/25 bg-gradient-to-br from-brand-green/[0.06] to-transparent p-4 dark:border-emerald-500/20 dark:bg-emerald-950/15">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-green/15 text-brand-green dark:bg-emerald-500/20 dark:text-emerald-400">
                          <ChefHat className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-xs font-bold text-brand-text">Inside KAINARA</p>
                          <p className="text-[10px] text-brand-muted">Planned & prepared meals</p>
                        </div>
                      </div>
                      <span className="rounded-full border border-brand-green/30 bg-brand-green/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-brand-green dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400">
                        {insideRatio}%
                      </span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="font-display text-3xl font-black text-brand-text">{insideMealsCount}</span>
                      <span className="text-xs text-brand-muted">eaten to plan</span>
                    </div>
                  </div>

                  {/* Outside Dining Card */}
                  <div className="relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-500/[0.06] to-transparent p-4 dark:border-amber-500/20 dark:bg-amber-950/15">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                          <Compass className="h-4 w-4" />
                        </span>
                        <div>
                          <p className="text-xs font-bold text-brand-text">Outside Dining</p>
                          <p className="text-[10px] text-brand-muted">Restaurant & logged meals</p>
                        </div>
                      </div>
                      <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-400">
                        {outsideRatio}%
                      </span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="font-display text-3xl font-black text-brand-text">{outsideMealsCount}</span>
                      <span className="text-xs text-brand-muted">outside meals</span>
                    </div>
                  </div>
                </div>

                {/* Visual Ratio Progress Bar */}
                <div className="mt-5 space-y-2">
                  <div className="flex justify-between text-[11px] font-semibold text-brand-muted">
                    <span>Intake Ratio</span>
                    <span>{totalCompletedMeals > 0 ? `${insideRatio}% KAINARA · ${outsideRatio}% Outside` : 'No completed meals yet'}</span>
                  </div>
                  <div className="flex h-3 w-full overflow-hidden rounded-full border border-brand-border/60 bg-brand-bgAlt dark:border-white/[0.08] dark:bg-white/[0.04]">
                    {totalCompletedMeals > 0 ? (
                      <>
                        <div
                          style={{ width: `${insideRatio}%` }}
                          className="h-full bg-brand-green transition-all duration-500 dark:bg-emerald-500"
                        />
                        <div
                          style={{ width: `${outsideRatio}%` }}
                          className="h-full bg-amber-500 transition-all duration-500"
                        />
                      </>
                    ) : (
                      <div className="h-full w-full bg-brand-muted/15" />
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[11px] text-brand-muted">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-brand-green dark:bg-emerald-500" />
                        <span>Inside KAINARA ({insideMealsCount})</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        <span>Outside dining ({outsideMealsCount})</span>
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-brand-muted">
                      {trackedDaysCount} active tracking day{trackedDaysCount === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              </Card>

              {/* 2 Grids: Biometrics & Dietary Blueprint */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Biometrics & Weight Blueprint */}
                <Card className="overflow-hidden border-brand-border/70 bg-brand-surface p-5 shadow-card">
                  <div className="flex items-center justify-between border-b border-brand-border/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green dark:bg-emerald-500/10 dark:text-emerald-400">
                        <Scale className="h-4 w-4" />
                      </span>
                      <div>
                        <h3 className="font-display text-xs font-bold text-brand-text">Biometrics & Body Target</h3>
                        <p className="text-[10px] text-brand-muted">Baseline body composition & metrics</p>
                      </div>
                    </div>
                    {bmiCategory && (
                      <span className={`rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider border ${bmiCategory.badge}`}>
                        {bmiCategory.label}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/50 p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted">Current Weight</span>
                      <p className="mt-1 font-display text-lg font-black text-brand-text">
                        {weightKg ? `${weightKg} kg` : '—'}
                      </p>
                      <span className="text-[10px] text-brand-muted">
                        {heightCm ? `${heightCm} cm height` : 'Height not set'}
                      </span>
                    </div>

                    <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/50 p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted">Target Weight</span>
                      <p className="mt-1 font-display text-lg font-black text-brand-text">
                        {targetWeightKg ? `${targetWeightKg} kg` : 'Maintain'}
                      </p>
                      <span className="text-[10px] text-brand-muted">
                        {weightDelta !== null
                          ? `${Math.abs(weightDelta)} kg ${weightDelta > 0 ? 'to lose' : weightDelta < 0 ? 'to gain' : 'at target'}`
                          : 'Maintain weight'}
                      </span>
                    </div>

                    <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/50 p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted">Estimated BMI</span>
                      <p className="mt-1 font-display text-lg font-black text-brand-text">
                        {bmi ? `${bmi}` : '—'}
                      </p>
                      <span className="text-[10px] text-brand-muted">
                        {bmi ? 'WHO / FNRI standard' : 'Requires height & weight'}
                      </span>
                    </div>

                    <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/50 p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-muted">Daily Target</span>
                      <p className="mt-1 font-display text-lg font-black text-brand-text">
                        {profileData?.dailyCalorieTarget ? `${profileData.dailyCalorieTarget.toLocaleString()} kcal` : '—'}
                      </p>
                      <span className="text-[10px] text-brand-muted">Metabolic calorie target</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-brand-border/50 pt-3 text-xs">
                    <span className="text-[11px] text-brand-muted">Update your measurements</span>
                    <Link
                      href="/profile/health"
                      className="inline-flex items-center gap-1 font-semibold text-brand-green hover:underline dark:text-emerald-400"
                    >
                      <span>Health profile</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </Card>

                {/* Dietary & Lifestyle Blueprint */}
                <Card className="overflow-hidden border-brand-border/70 bg-brand-surface p-5 shadow-card">
                  <div className="flex items-center justify-between border-b border-brand-border/60 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green dark:bg-emerald-500/10 dark:text-emerald-400">
                        <Sparkles className="h-4 w-4" />
                      </span>
                      <div>
                        <h3 className="font-display text-xs font-bold text-brand-text">Dietary & Cultural Blueprint</h3>
                        <p className="text-[10px] text-brand-muted">Habits, rice customization & safeguards</p>
                      </div>
                    </div>
                    <span className="rounded-full border border-brand-border bg-brand-bgAlt px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-brand-muted dark:border-white/[0.08] dark:bg-white/[0.04]">
                      {profileData?.dietaryPreference || 'Omnivore'}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2.5">
                    <div className="flex items-center justify-between rounded-xl border border-brand-border/60 bg-brand-bgAlt/40 p-2.5 text-xs dark:border-white/[0.06] dark:bg-white/[0.02]">
                      <span className="text-brand-muted">Dietary Pattern</span>
                      <span className="font-bold text-brand-text">
                        {profileData?.dietaryPreference
                          ? profileData.dietaryPreference.charAt(0) + profileData.dietaryPreference.slice(1).toLowerCase()
                          : 'Omnivore'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-brand-border/60 bg-brand-bgAlt/40 p-2.5 text-xs dark:border-white/[0.06] dark:bg-white/[0.02]">
                      <span className="text-brand-muted">Rice Preference</span>
                      <span className="font-bold text-brand-text">
                        {profileData?.ricePreference
                          ? profileData.ricePreference.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
                          : 'Flexible'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-brand-border/60 bg-brand-bgAlt/40 p-2.5 text-xs dark:border-white/[0.06] dark:bg-white/[0.02]">
                      <span className="text-brand-muted">Food Culture & Region</span>
                      <span className="font-bold text-brand-text">
                        {profileData?.foodCulture || 'Filipino Heritage'}
                        {profileData?.planningRegionName ? ` · ${profileData.planningRegionName}` : ''}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-brand-border/60 bg-brand-bgAlt/40 p-2.5 text-xs dark:border-white/[0.06] dark:bg-white/[0.02]">
                      <span className="text-brand-muted">Clinical Safeguards</span>
                      <span className="font-bold text-brand-text">
                        {restrictionsCount > 0 ? `${restrictionsCount} active protection${restrictionsCount === 1 ? '' : 's'}` : 'None declared'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-brand-border/60 bg-brand-bgAlt/40 p-2.5 text-xs dark:border-white/[0.06] dark:bg-white/[0.02]">
                      <span className="text-brand-muted">Membership Tier</span>
                      <span className="font-bold text-brand-text">
                        {membershipTitle}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-brand-border/50 pt-3 text-xs">
                    <span className="text-[11px] text-brand-muted">
                      {profileData?.checkinStreak ? `${profileData.checkinStreak} week check-in streak` : 'Weekly check-in active'}
                    </span>
                    <Link
                      href="/profile/nutrition-report"
                      className="inline-flex items-center gap-1 font-semibold text-brand-green hover:underline dark:text-emerald-400"
                    >
                      <span>Nutrition report</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* Account information credentials card */}
          <Card className="overflow-hidden border-brand-border/70 bg-brand-surface p-0 shadow-card">
            <div className="border-b border-brand-border/60 px-5 py-4 sm:px-6">
              <h2 className="font-display text-base font-black text-brand-text">Account information</h2>
              <p className="mt-1 text-xs text-brand-muted">
                Update the name and email shown across your KAINARA workspace.
              </p>
            </div>
            <div className="p-5 sm:p-6">
              {accountSuccess && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-status-verified-text/25 bg-status-verified-bg/10 p-3.5 text-xs font-bold text-status-verified-text">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  {accountSuccess}
                </div>
              )}
              {accountError && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-status-error-text/25 bg-status-error-bg/10 p-3.5 text-xs font-bold text-status-error-text">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {accountError}
                </div>
              )}
              <form onSubmit={handleAccountSubmit} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    id="account-name"
                    name="name"
                    autoComplete="name"
                    label="Display Name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                  <Input
                    id="account-email"
                    name="email"
                    autoComplete="email"
                    label="Email Address"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="flex justify-end border-t border-brand-border/60 pt-4">
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={isSavingAccount}
                    className="px-6 py-2.5 text-xs font-bold shadow-md"
                  >
                    {isSavingAccount ? 'Saving Settings...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}

      {activePanel === 'security' && (
        <Card className="overflow-hidden border-brand-border/70 bg-brand-surface p-0 shadow-card">
          <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
            <div className="border-b border-brand-border/60 bg-brand-bgAlt/55 p-5 lg:border-b-0 lg:border-r sm:p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green">
                <Lock className="h-5 w-5" />
              </span>
              <h2 className="mt-5 font-display text-lg font-black text-brand-text">Password</h2>
              <p className="mt-2 text-xs leading-relaxed text-brand-muted">
                {passwordLoginEnabled
                  ? 'Use a unique password you do not reuse elsewhere. Changing it will protect future sessions.'
                  : 'This account uses Google sign-in and does not have a KAINARA password.'}
              </p>
            </div>
            <div className="p-5 sm:p-6">
              {passwordSuccess && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-status-verified-text/25 bg-status-verified-bg/10 p-3.5 text-xs font-bold text-status-verified-text">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  {passwordSuccess}
                </div>
              )}
              {passwordError && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-status-error-text/25 bg-status-error-bg/10 p-3.5 text-xs font-bold text-status-error-text">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {passwordError}
                </div>
              )}
              {!passwordLoginEnabled && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-brand-cyan/25 bg-brand-cyan/10 p-3.5 text-xs font-semibold leading-relaxed text-brand-text">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-cyan" />
                  <span>
                    Continue using the Google account connected to {user.email}. Password reset and password sign-in are
                    unavailable for this account.
                  </span>
                </div>
              )}
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <PasswordInput
                  id="current-password"
                  name="currentPassword"
                  label="Current Password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  disabled={!passwordLoginEnabled}
                  required
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <PasswordInput
                    id="new-password"
                    name="newPassword"
                    label="New Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={!passwordLoginEnabled}
                    required
                  />
                  <PasswordInput
                    id="confirm-new-password"
                    name="confirmPassword"
                    label="Confirm New Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={!passwordLoginEnabled}
                    error={passwordsMismatch ? 'New passwords do not match.' : undefined}
                    required
                  />
                </div>
                <div className="flex justify-end border-t border-brand-border/60 pt-4">
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={isUpdatingPassword || !passwordLoginEnabled}
                    className="px-6 py-2.5 text-xs font-bold shadow-md"
                  >
                    {isUpdatingPassword
                      ? 'Updating Password...'
                      : passwordLoginEnabled
                        ? 'Update Password'
                        : 'Google sign-in account'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </Card>
      )}

      <AvatarSettings visible={activePanel === 'avatar'} user={user} updateUserSession={updateUserSession} />

      {activePanel === 'privacy' && (
        <Link
          href="/export"
          className="block rounded-xl border border-brand-border bg-brand-surface p-4 text-sm font-semibold text-brand-green"
        >
          Download my data and nutrition summary →
        </Link>
      )}
      {activePanel === 'privacy' && (
        <Card className="overflow-hidden border-red-500/25 bg-brand-surface p-0 shadow-card">
          <div className="border-b border-red-500/15 p-5 sm:p-6">
            <h2 className="font-display text-base font-black text-red-500">Delete account and health data</h2>
            <p className="mt-1 text-xs leading-relaxed text-brand-muted">
              This permanently removes your profile, restrictions, plans, logs, grocery lists, hydration entries, and
              sessions. Download your JSON export first if you need a copy.
            </p>
          </div>
          <form onSubmit={handleDeleteAccount} className="space-y-4 p-5 sm:p-6">
            {deletionError && (
              <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs font-bold text-red-500">
                {deletionError}
              </div>
            )}
            {passwordLoginEnabled && (
              <PasswordInput
                id="delete-account-password"
                name="currentPassword"
                autoComplete="current-password"
                label="Current password"
                value={deletionPassword}
                onChange={(event) => setDeletionPassword(event.target.value)}
              />
            )}
            <Input
              id="delete-account-confirmation"
              name="confirmation"
              label="Type DELETE MY KAINARA ACCOUNT"
              value={deletionConfirmation}
              onChange={(event) => setDeletionConfirmation(event.target.value)}
              error={deletionConfirmationMismatch ? `Type ${ACCOUNT_DELETION_CONFIRMATION} exactly.` : undefined}
              required
            />
            {passwordLoginEnabled && (
              <div className="flex justify-end border-t border-brand-border/60 pt-4">
                <Button
                  variant="danger"
                  type="submit"
                  disabled={isDeleting || !deletionConfirmed || deletionPassword.length < 8}
                >
                  {isDeleting ? 'Deleting account...' : 'Permanently delete account'}
                </Button>
              </div>
            )}
            {googleLoginEnabled && (
              <>
                {passwordLoginEnabled && (
                  <div className="flex items-center gap-3" aria-hidden="true">
                    <span className="h-px flex-1 bg-brand-border/70" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">or</span>
                    <span className="h-px flex-1 bg-brand-border/70" />
                  </div>
                )}
                <div className="space-y-2">
                  <p className="text-xs leading-relaxed text-brand-muted">
                    Reauthenticate with the Google identity connected to this KAINARA account to permanently delete it.
                  </p>
                  <GoogleSignInButton
                    label="continue_with"
                    disabled={isDeleting || !deletionConfirmed}
                    onCredential={handleGoogleDeleteAccount}
                  />
                </div>
              </>
            )}
          </form>
        </Card>
      )}

      <section className="flex flex-col gap-3 rounded-[22px] border border-red-500/15 bg-red-500/[0.035] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold text-brand-text">End this session</p>
          <p className="mt-0.5 text-[11px] text-brand-muted">You can sign back in at any time.</p>
        </div>
        <Button
          variant="secondary"
          onClick={logout}
          className="flex items-center justify-center gap-2 border-red-500/20 px-5 py-2.5 text-xs font-bold text-red-500 hover:bg-red-500/10"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </section>
    </div>
  );
}

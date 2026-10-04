'use client';
import WorkspaceTabs from '@/components/ui/WorkspaceTabs';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useBreadcrumb } from '@/lib/context/BreadcrumbContext';
import Button from '@/components/ui/Button';
import WeightGraph from '@/features/progress/WeightGraph';
import {
  DIETARY_OPTIONS,
  RICE_OPTIONS,
  SHOPPING_DAY_OPTIONS,
  BIOLOGICAL_SEX_OPTIONS,
  GOAL_OPTIONS,
  ACTIVITY_OPTIONS,
} from '@/features/progress/profile-options';
import ProgressSkeleton from '@/features/progress/ProgressSkeleton';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import AnnouncementBanner from '@/components/shared/AnnouncementBanner';
import StructuredSafetyIntake from '@/components/user/StructuredSafetyIntake';
import api from '@/lib/axios';
import { safetyInputsFromProfile } from '@/lib/safety-intake';
import {
  TrendingUp,
  Plus,
  CheckCircle,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  BarChart3,
  Heart,
  Settings,
  Scale,
  Activity,
  ClipboardList,
  Sparkles,
} from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { useProgressWorkspace, type ProgressWorkspaceMode } from '@/features/progress/useProgressWorkspace';
import { useMembership } from '@/features/membership/MembershipProvider';

import PersonalizationTabs from '@/components/user/PersonalizationTabs';

export function ProgressWorkspace({ mode = 'progress' }: { mode?: ProgressWorkspaceMode }) {
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

  return (
    <div className="portal-page max-w-5xl text-brand-text">
      {mode !== 'progress' && <PersonalizationTabs activeTab={mode === 'planning' ? 'planning' : 'health'} />}
      {/* HEADER SECTION */}
      <PortalPageHeader
        icon={mode === 'health' ? Heart : TrendingUp}
        eyebrow={mode !== 'progress' ? 'Personalization' : 'Health trajectory'}
        title={mode === 'planning' ? 'Food & planning' : mode === 'health' ? 'Health & goals' : 'Progress'}
        description={
          mode === 'health'
            ? 'Update your body measurements, goals, conditions and allergies whenever they change.'
            : mode === 'planning'
              ? 'Choose your dietary patterns, rice preferences and shopping schedule.'
              : 'Your weight, daily intake and progress over time.'
        }
        className="mb-6"
        actions={
          mode === 'progress' ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  setIsLogFormOpen(activeSection === 'overview' ? !isLogFormOpen : true);
                  setActiveSection('overview');
                  setWeightFormError(null);
                  setWeightSuccess(null);
                }}
                className="text-xs font-bold py-2 shadow-lg shadow-brand-green/10 flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Log today&apos;s weight</span>
              </Button>
              <Button
                variant="secondary"
                onClick={() => router.push('/profile/health')}
                className="text-xs font-bold py-2 flex items-center gap-1.5"
              >
                <Activity className="w-4 h-4" />
                <span>Update health</span>
              </Button>
            </div>
          ) : undefined
        }
      />

      {mode !== 'progress' && membership?.enabled && (
        <p className="mb-5 rounded-2xl border border-brand-border bg-brand-surface p-4 text-sm text-brand-muted">
          You can save profile updates on any plan. Applying ordinary changes to meal planning requires Lifestyle; case
          planning and health-context updates require Health. Your first report and unchanged weekly reports are free.{' '}
          <Link href="/membership" className="font-semibold text-brand-green">
            View your benefits and limits
          </Link>
        </p>
      )}

      {error && error.toLowerCase().includes('nutrition report') ? (
        <AnnouncementBanner
          className="mb-6"
          title="Action required:"
          message="Use your nutrition report for meal planning before using this feature."
          action={{
            label: 'View Nutrition Report',
            href: '/profile/nutrition-report',
          }}
        />
      ) : error ? (
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-status-error-text/30 bg-status-error-bg/20 p-4 text-status-error-text">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="secondary" onClick={() => fetchPageData()} className="h-8 px-3 text-xs">
              Retry
            </Button>
          </div>
        </div>
      ) : null}

      {mode !== 'planning' && (
        <WorkspaceTabs
          value={activeSection}
          onChange={setActiveSection}
          label={mode === 'health' ? 'Health profile sections' : 'Progress sections'}
          className="mb-6"
          items={
            mode === 'health'
              ? [
                  { value: 'profile', label: 'Body & goals', icon: <Settings className="h-4 w-4" /> },
                  { value: 'safety', label: 'Conditions & allergies', icon: <Heart className="h-4 w-4" /> },
                ]
              : [
                  { value: 'overview', label: 'Overview', icon: <TrendingUp className="h-4 w-4" /> },
                  { value: 'history', label: 'Daily Adherence', icon: <ClipboardList className="h-4 w-4" /> },
                ]
          }
        />
      )}

      {weightSuccess && (
        <div className="p-4 rounded-xl bg-status-verified-bg/10 border border-status-verified-text/25 text-status-verified-text text-sm font-semibold flex items-center gap-2 text-left mb-6">
          <CheckCircle className="w-4 h-4 text-status-verified-text shrink-0" />
          <span>{weightSuccess}</span>
        </div>
      )}

      {isLoading ? (
        <ProgressSkeleton />
      ) : (
        <>
          {activeSection === 'overview' && (
            <>
              {/* WEIGHT LOGGER COLLAPSIBLE BLOCK */}
              {isLogFormOpen && (
                <Card className="p-5 border-brand-border bg-brand-surface/40 backdrop-blur-md text-left mb-8 shadow-2xl transition-all duration-300">
                  <h3 className="text-base font-bold text-brand-text mb-4">LOG TODAY&apos;S WEIGHT</h3>

                  {weightFormError && (
                    <div className="p-3.5 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-xs font-bold mb-4 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
                      <span>{weightFormError}</span>
                    </div>
                  )}

                  <form onSubmit={handleLogWeightSubmit} className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Weight (kg)"
                        type="number"
                        step="0.1"
                        placeholder="e.g. 68.5"
                        value={weightInput}
                        onChange={(e) => setWeightInput(e.target.value)}
                        required
                      />
                      <Input
                        label="Note / Comments (Optional)"
                        type="text"
                        placeholder="e.g. Logged empty stomach in the morning"
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2 justify-end mt-2">
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={() => setIsLogFormOpen(false)}
                        className="text-xs py-2 px-4"
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        type="submit"
                        disabled={isSubmittingWeight}
                        className="text-xs py-2 px-4"
                      >
                        {isSubmittingWeight ? 'Recording...' : 'Save Reading'}
                      </Button>
                    </div>
                  </form>
                </Card>
              )}

              <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  {
                    label: 'Current weight',
                    value: currentWeight ? `${currentWeight} kg` : '--',
                    icon: Scale,
                    color: 'text-brand-green',
                    bgColor: 'bg-brand-green/10',
                    badge: 'Latest log',
                  },
                  {
                    label: 'Target weight',
                    value: targetWeight ? `${targetWeight} kg` : '--',
                    icon: TrendingUp,
                    color: 'text-brand-accent',
                    bgColor: 'bg-brand-accent/10',
                    badge: targetWeight > 0 ? 'Goal target' : undefined,
                  },
                  {
                    label: 'Distance to goal',
                    value:
                      currentWeight && targetWeight ? `${Math.abs(targetWeight - currentWeight).toFixed(1)} kg` : '--',
                    icon: Activity,
                    color: 'text-brand-cyan',
                    bgColor: 'bg-brand-cyan/10',
                    badge:
                      currentWeight && targetWeight
                        ? targetWeight > currentWeight
                          ? 'to gain'
                          : targetWeight < currentWeight
                            ? 'to lose'
                            : 'achieved'
                        : undefined,
                  },
                  {
                    label: 'Daily calorie target',
                    value: dailyCalorieTarget ? `${dailyCalorieTarget} kcal` : '--',
                    icon: Lightbulb,
                    color: 'text-amber-500',
                    bgColor: 'bg-amber-500/10',
                    badge: 'Metabolic allowance',
                  },
                ].map((metric) => {
                  const MetricIcon = metric.icon;
                  return (
                    <div
                      key={metric.label}
                      className="group relative rounded-2xl border border-brand-border/70 bg-brand-surface p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-brand-border transition-all duration-200"
                    >
                      <div className="flex items-center justify-between">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-xl ${metric.bgColor} ${metric.color}`}
                        >
                          <MetricIcon className="h-4.5 w-4.5" />
                        </div>
                        {metric.badge && (
                          <span className="text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full bg-brand-bgAlt text-brand-muted border border-brand-border/50">
                            {metric.badge}
                          </span>
                        )}
                      </div>
                      <p className="mt-4 font-display text-2xl font-black text-brand-text tracking-tight">
                        {metric.value}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-brand-muted">{metric.label}</p>
                    </div>
                  );
                })}
              </section>

              {/* GRAPH & SUMMARY BLOCKS */}
              <div className="mb-8 text-left">
                {/* Graph Card */}
                <Card className="p-5 sm:p-6 border-brand-border/70 bg-brand-surface shadow-card">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-green/10 text-brand-green">
                          <Scale className="w-4 h-4" />
                        </div>
                        <h3 className="text-base font-extrabold text-brand-text font-display">Weight Progress</h3>
                      </div>
                      <p className="text-xs text-brand-muted mt-1 ml-9">
                        {targetWeight > 0 ? `Target: ${targetWeight} kg · ` : ''}Real observations over time
                      </p>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      {/* Legend */}
                      <div className="hidden md:flex items-center gap-3 text-[11px] font-bold text-brand-muted mr-1 select-none">
                        <span className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-brand-green" />
                          Logged weight
                        </span>
                        {targetWeight > 0 && (
                          <span className="flex items-center gap-1.5">
                            <span className="h-1.5 w-3 border-b-2 border-dashed border-brand-accent" />
                            Target ({targetWeight} kg)
                          </span>
                        )}
                      </div>

                      <Select
                        aria-label="Weight progress period"
                        value={timeframe}
                        onChange={(value) => setTimeframe(value as 'week' | 'month' | 'year')}
                        className="w-40"
                        options={[
                          { value: 'week', label: 'Weekly Progress' },
                          { value: 'month', label: 'Monthly Progress' },
                          { value: 'year', label: 'Yearly Progress' },
                        ]}
                      />
                    </div>
                  </div>
                  <WeightGraph groupedLogs={groupedLogs} targetWeight={targetWeight} />
                </Card>
              </div>
            </>
          )}

          {/* EDITABLE BIOMETRICS & PREFERENCES */}
          {activeSection === 'profile' && (
            <Card className="p-6 border-brand-border/70 bg-brand-surface shadow-card text-left mb-8">
              <h3 className="text-sm font-extrabold text-brand-green uppercase tracking-wide mb-5 font-display flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-brand-green" />
                <span>{mode === 'planning' ? 'Food preferences & shopping' : 'Body measurements & goals'}</span>
              </h3>

              {biometricsSuccess && (
                <div className="p-3.5 rounded-xl bg-status-verified-bg/10 border border-status-verified-text/25 text-status-verified-text text-xs font-bold mb-4 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-status-verified-text shrink-0" />
                  <span>{biometricsSuccess}</span>
                </div>
              )}

              {biometricsError && (
                <div className="p-3.5 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-xs font-bold mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
                  <span>{biometricsError}</span>
                </div>
              )}

              <form onSubmit={handleBiometricsSubmit} className="flex flex-col gap-5">
                {mode === 'health' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <Input
                        id="profile-age"
                        label="Age (Years)"
                        type="number"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        required
                      />
                      <Input
                        id="profile-height"
                        label="Height (cm)"
                        type="number"
                        step="0.1"
                        value={heightCm}
                        onChange={(e) => setHeightCm(e.target.value)}
                        required
                      />
                      <Input
                        id="profile-weight"
                        label="Weight (kg)"
                        type="number"
                        step="0.1"
                        value={weightKg}
                        onChange={(e) => setWeightKg(e.target.value)}
                        required
                      />
                      <Input
                        id="profile-target-weight"
                        label="Target Weight (kg)"
                        type="number"
                        step="0.1"
                        value={targetWeightKg}
                        onChange={(e) => setTargetWeightKg(e.target.value)}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label
                          htmlFor="profile-biological-sex"
                          className="block text-xs font-bold tracking-wider text-brand-muted uppercase mb-2"
                        >
                          Biological Sex
                        </label>
                        <Select
                          id="profile-biological-sex"
                          value={biologicalSex}
                          onChange={setBiologicalSex}
                          options={BIOLOGICAL_SEX_OPTIONS}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="profile-goal"
                          className="block text-xs font-bold tracking-wider text-brand-muted uppercase mb-2"
                        >
                          Primary Goal
                        </label>
                        <Select id="profile-goal" value={goal} onChange={setGoal} options={GOAL_OPTIONS} />
                      </div>
                      <div>
                        <label
                          htmlFor="profile-activity"
                          className="block text-xs font-bold tracking-wider text-brand-muted uppercase mb-2"
                        >
                          Activity Level
                        </label>
                        <Select
                          id="profile-activity"
                          value={activityLevel}
                          onChange={setActivityLevel}
                          options={ACTIVITY_OPTIONS}
                        />
                      </div>
                    </div>
                  </>
                )}
                {mode === 'planning' && (
                  <>
                    {/* Top Row: Dietary, rice, and grocery shopping day */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label
                          htmlFor="profile-diet"
                          className="block text-xs font-bold tracking-wider text-brand-muted uppercase mb-2"
                        >
                          Dietary Preference
                        </label>
                        <Select
                          id="profile-diet"
                          value={dietaryPreference}
                          onChange={setDietaryPreference}
                          options={DIETARY_OPTIONS}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="profile-rice"
                          className="block text-xs font-bold tracking-wider text-brand-muted uppercase mb-2"
                        >
                          Rice Preference
                        </label>
                        <Select
                          id="profile-rice"
                          value={ricePreference}
                          onChange={(value) => setRicePreference(value as typeof ricePreference)}
                          options={RICE_OPTIONS}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="profile-shopping-day"
                          className="block text-xs font-bold tracking-wider text-brand-muted uppercase mb-2"
                        >
                          Grocery Shopping Day
                        </label>
                        <Select
                          id="profile-shopping-day"
                          value={String(shoppingDayOfWeek)}
                          onChange={(val) => setShoppingDayOfWeek(Number(val))}
                          options={SHOPPING_DAY_OPTIONS}
                        />
                      </div>
                    </div>
                  </>
                )}
                {/* Plan Cycle & Regeneration Notice */}
                <div className="flex items-start gap-3 rounded-2xl bg-brand-green/[0.06] p-4 text-xs leading-relaxed text-brand-muted mt-2">
                  <Sparkles className="h-4 w-4 shrink-0 text-brand-green mt-0.5" />
                  <div>
                    <strong className="text-brand-text block mb-0.5">Plan Cycle Notice</strong>
                    Planning changes take effect on your next weekly meal cycle. Safety restrictions block conflicting
                    uneaten meals immediately.
                  </div>
                </div>

                <div className="flex justify-end mt-2">
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={isSavingBiometrics}
                    className="text-xs font-bold py-2.5 px-6 shadow-md"
                  >
                    {isSavingBiometrics ? 'Saving Profile...' : 'Save Profile Details'}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* HEALTH CONDITIONS & CLINICAL SAFETY */}
          {activeSection === 'safety' && (
            <Card className="p-6 border-brand-border/70 bg-brand-surface shadow-card text-left mb-8">
              <h3 className="text-sm font-extrabold text-brand-green uppercase tracking-wide mb-2 font-display flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-brand-green" />
                <span>Conditions, allergies & foods to avoid</span>
              </h3>
              <p className="text-xs text-brand-muted mb-6 leading-relaxed">
                Save these together so your meals can be checked against your latest information. You can update them at
                any time.
              </p>

              {healthSuccess && (
                <div className="p-3.5 rounded-xl bg-status-verified-bg/10 border border-status-verified-text/25 text-status-verified-text text-xs font-bold mb-4 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-status-verified-text shrink-0" />
                  <span>{healthSuccess}</span>
                </div>
              )}

              <StructuredSafetyIntake
                initialEntries={safetyInputsFromProfile(profileData)}
                editableDomains={['CONDITION', 'ALLERGY', 'INTOLERANCE', 'AVOIDED_INGREDIENT']}
                submitLabel="Save safety changes"
                onSaved={async (_entries, changed) => {
                  setHealthSuccess(
                    changed
                      ? 'Safety settings saved. Affected meals are being checked again and your nutrition report must be refreshed.'
                      : 'Your safety settings are already up to date.'
                  );
                  if (changed) {
                    router.push('/profile/nutrition-report');
                    return;
                  }
                  const response = await api.get('/user/profile');
                  if (response.data?.success) setProfileData(response.data.data);
                }}
              />
            </Card>
          )}

          {/* ADHERENCE CALENDAR BLOCK */}
          {activeSection === 'history' &&
            (() => {
              const logs = history?.dailyNutritionLogs || [];
              const averageAdherence =
                logs.length > 0
                  ? Math.round(logs.reduce((acc, curr) => acc + curr.adherencePct, 0) / logs.length)
                  : null;
              const onTargetDays = logs.filter((log) => log.adherencePct >= 90 && log.adherencePct <= 110).length;

              return (
                <div className="text-left space-y-6">
                  {/* Educational Banner */}
                  <div className="rounded-2xl border border-brand-green/20 bg-brand-green/5 p-5 shadow-sm">
                    <div className="flex items-start gap-3.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green">
                        <Lightbulb className="h-5 w-5" />
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-sm font-extrabold text-brand-text font-display">
                          Understanding Calorie Adherence
                        </h4>
                        <p className="text-xs text-brand-muted leading-relaxed">
                          Daily adherence measures how closely your total food intake matched your prescribed metabolic
                          target. Scores compile automatically every night based on meals you mark as eaten on your
                          daily dashboard.
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            90%–110%: Target Achieved
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#8c3b00]/15 px-2.5 py-1 text-[11px] font-bold text-[#8c3b00] dark:text-[#ff8a3d]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#8c3b00] dark:bg-[#ff8a3d]" />
                            70%–89%: Acceptable Buffer
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            &lt;70% or &gt;110%: Off Track
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-brand-border/70 bg-brand-surface p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-brand-muted">Average Consistency</span>
                        <BarChart3 className="h-4 w-4 text-brand-green" />
                      </div>
                      <p className="mt-3 font-display text-2xl font-black text-brand-text">
                        {averageAdherence !== null ? `${averageAdherence}%` : '--'}
                      </p>
                      <p className="mt-1 text-[11px] text-brand-muted">Across all logged days</p>
                    </div>

                    <div className="rounded-2xl border border-brand-border/70 bg-brand-surface p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-brand-muted">Optimal Target Days</span>
                        <CheckCircle className="h-4 w-4 text-brand-green" />
                      </div>
                      <p className="mt-3 font-display text-2xl font-black text-brand-text">
                        {logs.length > 0 ? `${onTargetDays} / ${logs.length}` : '--'}
                      </p>
                      <p className="mt-1 text-[11px] text-brand-muted">Days within 90%–110% zone</p>
                    </div>

                    <div className="rounded-2xl border border-brand-border/70 bg-brand-surface p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-brand-muted">Logged Days</span>
                        <Activity className="h-4 w-4 text-brand-cyan" />
                      </div>
                      <p className="mt-3 font-display text-2xl font-black text-brand-text">{logs.length}</p>
                      <p className="mt-1 text-[11px] text-brand-muted">Historical compilations</p>
                    </div>
                  </div>

                  {/* Table or Empty State Card */}
                  <Card className="p-5 border-brand-border/70 bg-brand-surface shadow-card">
                    <h3 className="text-sm font-extrabold text-brand-green uppercase tracking-wide mb-5 font-display flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-brand-green" />
                      <span>Daily Intake Log History</span>
                    </h3>

                    {logs.length === 0 ? (
                      <div className="p-8 text-center border border-dashed border-brand-border rounded-2xl text-brand-muted flex flex-col items-center justify-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green">
                          <BarChart3 className="w-6 h-6" />
                        </div>
                        <div className="max-w-md">
                          <h4 className="text-sm font-bold text-brand-text">No Overnight Adherence Records Yet</h4>
                          <p className="mt-1 text-xs text-brand-muted leading-relaxed">
                            Adherence scores compile automatically overnight from your logged meals. Mark today&apos;s
                            scheduled meals as eaten or log outside meals to record your first score.
                          </p>
                        </div>
                        <Link
                          href="/dashboard"
                          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-brand-accent px-4 py-2 text-xs font-extrabold text-[#07100d] shadow-sm hover:brightness-105"
                        >
                          Go to Today&apos;s Dashboard
                        </Link>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-brand-border/60 text-brand-muted uppercase font-bold tracking-wider text-[10px]">
                              <th className="pb-3 px-3">Date</th>
                              <th className="pb-3 px-3">Calories Consumed</th>
                              <th className="pb-3 px-3">Daily Target</th>
                              <th className="pb-3 px-3 text-center">Adherence</th>
                            </tr>
                          </thead>
                          <tbody>
                            {logs.map((log) => {
                              let badgeVar: 'verified' | 'pending' | 'rejected' = 'verified';
                              if (log.adherencePct < 70 || log.adherencePct > 110) badgeVar = 'rejected';
                              else if (log.adherencePct < 90) badgeVar = 'pending';

                              return (
                                <tr
                                  key={log.id}
                                  className="border-b border-brand-border/40 hover:bg-brand-surface/30 transition-all duration-150"
                                >
                                  <td className="py-3 px-3 font-semibold">
                                    {new Date(log.logDate).toLocaleDateString(undefined, {
                                      weekday: 'short',
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </td>
                                  <td className="py-3 px-3 font-bold text-brand-text">
                                    {Math.round(log.totalCalories)} kcal
                                  </td>
                                  <td className="py-3 px-3 font-bold text-brand-muted">
                                    {Math.round(log.targetCalories)} kcal
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <Badge variant={badgeVar} showIcon={false} className="py-0.5 px-2.5 font-bold">
                                      {Math.round(log.adherencePct)}% Adherence
                                    </Badge>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                </div>
              );
            })()}
        </>
      )}

      {/* Regeneration prompt modal after saving profile details */}
      <Modal
        isOpen={showRegenerateModal}
        onClose={() => setShowRegenerateModal(false)}
        title="Profile Details Saved"
        description="Your health context and planning preferences have been updated."
        size="md"
        footer={
          <div className="flex w-full flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5">
            <Button
              variant="primary"
              onClick={() => {
                setShowRegenerateModal(false);
                router.push('/profile/nutrition-report');
              }}
              className="text-xs font-bold w-full sm:w-auto shadow-md"
            >
              Review Updated Report
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-2xl border border-brand-green/20 bg-brand-green/[0.06] p-4 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-brand-green shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-brand-muted">
              <strong className="text-brand-text block mb-1">When will your changes take effect?</strong>
              Your saved preferences apply to future planning. Existing meals are checked again for safety.
              <br className="mb-2" />
              Review and acknowledge your updated nutrition report now. Your active plan keeps its original planning
              targets unless a new safety restriction blocks an uneaten meal.
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

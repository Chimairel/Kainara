'use client';
import WorkspaceTabs from '@/components/ui/WorkspaceTabs';

import Link from 'next/link';

import Button from '@/components/ui/Button';

import ProgressSkeleton from '@/features/progress/ProgressSkeleton';

import PortalPageHeader from '@/components/shared/PortalPageHeader';
import AnnouncementBanner from '@/components/shared/AnnouncementBanner';

import { TrendingUp, Plus, CheckCircle, AlertTriangle, Heart, Settings, Activity, ClipboardList } from 'lucide-react';

import { type ProgressWorkspaceMode } from '@/features/progress/useProgressWorkspace';

import PersonalizationTabs from '@/components/user/PersonalizationTabs';
import MealReminderSettingsPanel from '@/features/meal-reminders/MealReminderSettingsPanel';

import { useProgressWorkspaceModel } from '@/features/progress/sections/useProgressWorkspaceModel';
import ProgressOverviewSection from '@/features/progress/sections/ProgressOverviewSection';
import ProgressProfileSection from '@/features/progress/sections/ProgressProfileSection';
import ProgressSafetySection from '@/features/progress/sections/ProgressSafetySection';
import ProgressHistorySection from '@/features/progress/sections/ProgressHistorySection';
import ProgressRegenerationModal from '@/features/progress/sections/ProgressRegenerationModal';
export function ProgressWorkspace({ mode = 'progress' }: { mode?: ProgressWorkspaceMode }) {
  const model = useProgressWorkspaceModel({ mode });

  const {
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
  } = model;
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
        <ProgressSkeleton section={activeSection} mode={mode} />
      ) : (
        <>
          <ProgressOverviewSection model={model} />

          {/* EDITABLE BIOMETRICS & PREFERENCES */}
          <ProgressProfileSection model={model} />
          {mode === 'planning' && <MealReminderSettingsPanel />}

          {/* HEALTH CONDITIONS & CLINICAL SAFETY */}
          <ProgressSafetySection model={model} />

          {/* ADHERENCE CALENDAR BLOCK */}
          <ProgressHistorySection model={model} />
        </>
      )}

      {/* Regeneration prompt modal after saving profile details */}
      <ProgressRegenerationModal model={model} />
    </div>
  );
}

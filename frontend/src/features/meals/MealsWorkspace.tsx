'use client';

import MealsWorkspaceHeader from '@/features/meals/MealsWorkspaceHeader';
import UnavailableMealsNotice from '@/features/meals/UnavailableMealsNotice';
import StateNotice from '@/components/shared/StateNotice';
import MealLibraryPanel from '@/features/meals/MealLibraryPanel';
import { AlertTriangle, BookOpen, Calendar, Clock3, History } from 'lucide-react';
import WorkspaceTabs from '@/components/ui/WorkspaceTabs';
import { MealsWorkspaceModals } from '@/features/meals/MealsWorkspaceModals';
import MealsDateNavigation from './MealsDateNavigation';
import MealsGenerationNotice from './MealsGenerationNotice';
import MealsHistorySection from './MealsHistorySection';
import MealsPlanSection from './MealsPlanSection';
import { useMealsPage } from './useMealsPage';
import { useCallback, useState } from 'react';

export default function MealsWorkspace() {
  const model = useMealsPage();
  const {
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
    error,
    profileReviewRequired,
    workspace,
  } = model;
  const libraryScope = JSON.stringify([
    workspace.ownerId, workspace.librarySearch, workspace.libraryMealType, workspace.libraryRiceRole,
  ]);
  const [libraryCount, setLibraryCount] = useState<{ scope: string; value: number | string | null } | null>(null);
  const handleLibraryCount = useCallback((value: number | string | null) => {
    setLibraryCount({ scope: libraryScope, value });
  }, [libraryScope]);
  return (
    <div className="portal-page select-none pb-32 text-brand-text">
      {/* Main Container */}
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        {/* Header Block */}
        <MealsWorkspaceHeader
          activeTab={activeTab}
          upcomingOnly={upcomingOnly}
          isStarterPlan={isStarterPlan}
          upcomingStart={upcomingStart}
          nextCycleDay={nextCycleDay}
        />
        {!isLoading && (
          <UnavailableMealsNotice
            cycle={cycles?.current ?? null}
            isRepairing={isRepairingRetired}
            onRepair={cycles?.current?.id ? () => void repairRetiredMeals(cycles.current!.id!) : undefined}
          />
        )}
        {!isLoading && (
          <UnavailableMealsNotice
            cycle={cycles?.upcoming ?? null}
            upcoming
            isRepairing={isRepairingRetired}
            onRepair={cycles?.upcoming?.id ? () => void repairRetiredMeals(cycles.upcoming!.id!) : undefined}
          />
        )}

        {/* Tab Bar */}
        <WorkspaceTabs
          value={activeTab}
          onChange={setActiveTab}
          label="Meal workspace sections"
          items={[
            { value: 'plan', label: 'Plan', icon: <Calendar className="h-4 w-4" />, count: displayedMealCount },
            {
              value: 'history',
              label: 'History',
              icon: <History className="h-4 w-4" />,
              count: historyTotalCount ?? '…',
            },
            {
              value: 'library', label: 'Library', icon: <BookOpen className="h-4 w-4" />,
              count: !isReportPending && libraryCount?.scope === libraryScope ? libraryCount.value ?? '…' : '…',
            },
          ]}
        />

        {activeTab === 'plan' && !isLoading && upcomingOnly && !clinicalEvidenceRequired && !isReportPending && (
          <div className="flex items-start gap-3 rounded-xl border border-status-pending-text/30 bg-status-pending-bg/15 px-4 py-3 text-sm text-brand-text">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-status-pending-text" />
            <p>
              {generationStatus.current === 'FAILED'
                ? 'Your first current plan could not be prepared. Its preparation can be retried from your dashboard.'
                : 'Your first current plan is being prepared automatically. The meals below are next week’s draft, not the active plan.'}{' '}
              Meals awaiting review are previews and cannot be logged, swapped, or shopped for yet.
            </p>
          </div>
        )}

        <MealsGenerationNotice model={model} />

        <MealsDateNavigation model={model} />

        {error &&
          !clinicalEvidenceRequired &&
          !profileReviewRequired &&
          !error.toLowerCase().includes('nutrition report') && (
            <div className="p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2 text-left">
              <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
              <span>{error}</span>
            </div>
          )}

        {/* Conditional Content Rendering */}
        <MealsPlanSection model={model} />

        <MealsHistorySection model={model} />

        {activeTab === 'library' &&
          (isReportPending ? (
            <StateNotice
              variant="action-needed"
              description="Please review and acknowledge your personalized nutrition report before browsing the meal library."
              action={{
                label: 'View Nutrition Report',
                href: '/profile/nutrition-report',
              }}
            />
          ) : (
            <MealLibraryPanel workspace={workspace} onCountChange={handleLibraryCount} />
          ))}
      </div>

      <MealsWorkspaceModals workspace={workspace} />
    </div>
  );
}

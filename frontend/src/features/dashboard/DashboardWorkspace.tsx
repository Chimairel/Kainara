'use client';
import FeedbackNotice from '@/components/shared/FeedbackNotice';

import UnavailableMealsNotice from '@/features/meals/UnavailableMealsNotice';
import DashboardContent from './DashboardContent';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import MemberMealActions from '@/components/user/MemberMealActions';

import { OutsideMealModal } from '@/features/dashboard/OutsideMealModal';
import DashboardPlanNotices from './DashboardPlanNotices';
import { useDashboardWorkspace } from './useDashboardWorkspace';
import MealPlanAnnouncements from '@/features/meals/MealPlanAnnouncements';

export default function DashboardWorkspace() {
  const model = useDashboardWorkspace();
  const { error, clinicalEvidenceRequired, user, outsideLog, router, isLoading, currentCycle, isReportPending } = model;
  return (
    <div className="portal-page select-none pb-32 text-brand-text">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        {error && !clinicalEvidenceRequired && !error.toLowerCase().includes('nutrition report') ? (
          <FeedbackNotice>
            <div className="flex items-center gap-2">
              <span>{error}</span>
            </div>
          </FeedbackNotice>
        ) : null}

        {/* Permanent Top Greeting Header */}
        <PortalPageHeader
          title={<>Mabuhay, {user?.name ? user.name.split(' ')[0] : 'Friend'}.</>}
          description="Your meals, daily intake, and next steps — all in one place."
          actions={
            !isReportPending && user?.reportAcknowledged ? (
              <MemberMealActions
                onLogFood={() => outsideLog.setIsOpen(true)}
                onOpenDestination={() => router.push('/meals')}
              />
            ) : null
          }
        />

        {!isLoading && <UnavailableMealsNotice cycle={currentCycle} onRepair={() => router.push('/meals')} />}
        <DashboardPlanNotices model={model} />
        {!isLoading && !isReportPending && !clinicalEvidenceRequired && (
          <MealPlanAnnouncements
            pendingCount={model.pendingReview?.mealCount}
            isStarterPlan={model.isStarterPlan}
            nextCycleDay={model.nextCycleDay}
          />
        )}

        <DashboardContent model={model} />
      </div>

      {!isReportPending && user?.reportAcknowledged && <OutsideMealModal {...outsideLog} />}
    </div>
  );
}

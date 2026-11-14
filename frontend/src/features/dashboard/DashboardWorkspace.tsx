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
  const showPlanNotices = !isLoading && !isReportPending && !clinicalEvidenceRequired && model.profileReviewStatus === 'ready';
  return (
    <div className="portal-page select-none text-brand-text">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-6">
        {error && !clinicalEvidenceRequired && !isReportPending ? (
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

        {showPlanNotices && (
          <>
            <UnavailableMealsNotice cycle={currentCycle} onRepair={() => router.push('/meals')} />
            <DashboardPlanNotices model={model} />
            <MealPlanAnnouncements
              pendingCount={model.pendingReview?.mealCount}
              isStarterPlan={model.isStarterPlan}
              nextCycleDay={model.nextCycleDay}
            />
          </>
        )}

        <DashboardContent model={model} />
      </div>

      {!isReportPending && user?.reportAcknowledged && <OutsideMealModal {...outsideLog} />}
    </div>
  );
}

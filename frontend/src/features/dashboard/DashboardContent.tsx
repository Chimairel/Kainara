'use client';

import RetainedMealLogs from '@/features/meals/RetainedMealLogs';
import ProfileReviewPlanningHold from '@/features/meals/ProfileReviewPlanningHold';
import StateNotice from '@/components/shared/StateNotice';
import { CockpitDashboard } from '@/features/dashboard/CockpitDashboard';
import DashboardSkeleton from '@/features/dashboard/DashboardSkeleton';
import { getManilaDateKey } from '@/lib/manila-date';
import DashboardDateNavigation from './DashboardDateNavigation';
import type { useDashboardWorkspace } from './useDashboardWorkspace';

export default function DashboardContent({ model }: { model: ReturnType<typeof useDashboardWorkspace> }) {
  const {
    error,
    clinicalEvidenceRequired,
    isLoading,
    isReportPending,
    currentMeals,
    retainedMealLogs,
    pendingReview,
    generationStatus,
    profileReviewStatus,
    isGenerating,
    fetchCurrentPlan,
    handleGeneratePlan,
    activeDate,
    metrics,
    waterIntake,
    handleAddWater,
    handleMealStatusToggle,
    router,
  } = model;
  return (
    <>
      {isLoading ? (
        <DashboardSkeleton />
      ) : isReportPending ? (
        <StateNotice
          variant="no-meal-plan"
          eyebrow="Action needed"
          eyebrowVariant="amber"
          title="Meal planning isn't available yet"
          description="Review and acknowledge your current nutrition report first. Your meal plan will begin preparing automatically once you're eligible."
          action={{
            label: 'View Nutrition Report',
            href: '/profile/nutrition-report',
          }}
        />
      ) : clinicalEvidenceRequired ? (
        <StateNotice
          variant="no-meal-plan"
          eyebrow="Action needed"
          eyebrowVariant="amber"
          title="Meal planning isn't available yet"
          description="Your health details need more review before a meal plan can be prepared. Check the requested clinical information and upload a supporting document if required."
          action={{ label: 'Review clinical information', href: '/profile/clinical-evidence' }}
        />
      ) : profileReviewStatus === 'pending' ? (
        <ProfileReviewPlanningHold />
      ) : profileReviewStatus === 'checking' || profileReviewStatus === 'error' ? (
        <div
          role="status"
          className="rounded-xl border border-brand-border bg-brand-surface p-5 text-sm text-brand-muted"
        >
          {profileReviewStatus === 'checking'
            ? 'Checking meal-planning eligibility…'
            : 'We could not check your meal-planning eligibility. Refresh this page to try again.'}
        </div>
      ) : error &&
        currentMeals.length === 0 &&
        !retainedMealLogs.length &&
        !pendingReview &&
        generationStatus !== 'FAILED' &&
        !isGenerating ? (
        <StateNotice
          variant="no-meal-plan"
          title="Could not load your meal plan"
          description="We could not retrieve the latest preparation status. Retry loading your saved plan."
          action={{ label: 'Retry loading', onClick: () => void fetchCurrentPlan() }}
        />
      ) : currentMeals.length === 0 && !retainedMealLogs.length && !pendingReview ? (
        <StateNotice
          variant={generationStatus === 'FAILED' && !isGenerating ? 'preparing-failed' : 'preparing'}
          title={
            generationStatus === 'FAILED' && !isGenerating
              ? 'Meal plan preparation failed'
              : 'Preparing Your First Meal Plan'
          }
          description={
            generationStatus === 'FAILED' && !isGenerating
              ? 'Your nutrition report is acknowledged, but your first meal plan could not be prepared. Retry preparation to try again.'
              : 'Your current meal plan is being prepared automatically. New candidates will appear in Meals as previews and cannot be used until their safety review is complete.'
          }
          action={
            generationStatus === 'FAILED' && !isGenerating
              ? {
                  label: isGenerating ? 'Retrying...' : 'Retry Preparation',
                  onClick: handleGeneratePlan,
                  isLoading: isGenerating,
                }
              : null
          }
        />
      ) : (
        <>
          <DashboardDateNavigation model={model} />
          <RetainedMealLogs meals={retainedMealLogs} dateKey={getManilaDateKey(activeDate)} />

          <CockpitDashboard
            activeDate={activeDate}
            meals={metrics.mealsList}
            pendingMeals={
              pendingReview?.meals.filter(
                (meal) => activeDate && getManilaDateKey(meal.scheduledDate) === getManilaDateKey(activeDate)
              ) ?? []
            }
            metrics={metrics}
            waterIntake={waterIntake}
            onAddWater={handleAddWater}
            onMealClick={(mealId) => {
              const clickedMeal = metrics.mealsList.find((m) => m.id === mealId);
              const dateKey = clickedMeal?.scheduledDate
                ? getManilaDateKey(clickedMeal.scheduledDate)
                : getManilaDateKey(activeDate);
              router.push(`/meals?date=${dateKey}&mealId=${mealId}`);
            }}
            onStatusToggle={handleMealStatusToggle}
            onOpenWeeklyPlan={() => router.push('/meals')}
          />
        </>
      )}
    </>
  );
}

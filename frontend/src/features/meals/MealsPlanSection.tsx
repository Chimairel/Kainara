'use client';

import StateNotice from '@/components/shared/StateNotice';
import MealCard from '@/components/user/MealCard';
import PendingMealPreviewCard from '@/components/user/PendingMealPreviewCard';
import MealPlanSkeleton from '@/features/meals/MealPlanSkeleton';
import MealSwapRefresh from '@/features/meals/MealSwapRefresh';
import MealPlanEmptyState from './MealPlanEmptyState';
import type { useMealsPage } from './useMealsPage';

type Props = {
  model: Pick<
    ReturnType<typeof useMealsPage>,
    | 'activeTab'
    | 'isLoading'
    | 'isReportPending'
    | 'clinicalEvidenceRequired'
    | 'profileReviewRequired'
    | 'groupedDays'
    | 'pendingReview'
    | 'error'
    | 'activeGenerationStatus'
    | 'isPreparing'
    | 'awaitingGenerationCount'
    | 'retryPlanLoad'
    | 'handleRetryPreparation'
    | 'groupedPendingDays'
    | 'selectedPlanDay'
    | 'selectedPlanDayIndex'
    | 'refreshingSwapMealId'
    | 'handleMealStatusToggle'
    | 'handleSwapClick'
    | 'activeModalMealId'
    | 'setActiveModalMealId'
  >;
};
export default function MealsPlanSection({ model }: Props) {
  const {
    activeTab,
    isLoading,
    isReportPending,
    clinicalEvidenceRequired,
    profileReviewRequired,
    groupedDays,
    pendingReview,
    error,
    activeGenerationStatus,
    isPreparing,
    awaitingGenerationCount,
    retryPlanLoad,
    handleRetryPreparation,
    groupedPendingDays,
    selectedPlanDay,
    selectedPlanDayIndex,
    refreshingSwapMealId,
    handleMealStatusToggle,
    handleSwapClick,
    activeModalMealId,
    setActiveModalMealId,
  } = model;

  const emptyPlanState = (
    <MealPlanEmptyState
      error={error}
      generationStatus={activeGenerationStatus}
      isRegenerating={isPreparing}
      awaitingGenerationCount={awaitingGenerationCount}
      onRetryLoad={() => void retryPlanLoad()}
      onRetryPreparation={() => void handleRetryPreparation()}
    />
  );
  return (
    <>
      {activeTab === 'plan' &&
        (isLoading ? (
          <MealPlanSkeleton />
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
        ) : profileReviewRequired ? (
          <StateNotice
            variant="no-meal-plan"
            eyebrow="Awaiting nutritionist"
            eyebrowVariant="amber"
            title="Meal planning isn't available yet"
            description="A nutritionist needs to review your declared health profile before meal candidates can be prepared. Each proposed meal will then receive its own case approval."
          />
        ) : groupedDays.length === 0 && !pendingReview && error ? (
          emptyPlanState
        ) : groupedDays.length === 0 ? (
          pendingReview ? (
            <section className="flex flex-col gap-6 text-left" aria-label="Pending meal plan review">
              {groupedPendingDays
                .filter((day) => day.dateKey === selectedPlanDay?.dateKey)
                .map((day, dayIndex) => (
                  <div key={day.dateKey} className="space-y-4">
                    <div className="flex flex-col gap-3 px-1 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand-green/20 bg-brand-green/10 font-display text-sm font-black text-brand-green">
                          {String(selectedPlanDayIndex + dayIndex + 1).padStart(2, '0')}
                        </div>
                        <div>
                          <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-brand-muted">
                            Plan day
                          </p>
                          <h3 className="mt-0.5 font-display text-lg font-black leading-none text-brand-text">
                            {day.weekday}
                          </h3>
                          <span className="mt-1 block text-[10px] font-bold text-brand-muted">{day.dateStr}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                      {day.mealsList.map((meal, index) => (
                        <PendingMealPreviewCard
                          key={`${meal.scheduledDate}-${meal.mealType}-${index}`}
                          meal={meal}
                          index={index}
                        />
                      ))}
                    </div>
                  </div>
                ))}
            </section>
          ) : (
            emptyPlanState
          )
        ) : (
          <div className="flex flex-col gap-6 text-left">
            {groupedDays
              .filter((day) => day.dateKey === selectedPlanDay?.dateKey)
              .map((day) => (
                <div key={day.dateKey} className="space-y-4">
                  {/* Day Header with sum targets */}
                  <div className="flex flex-col justify-between gap-3 px-1 md:flex-row md:items-center">
                    <div>
                      <h3 className="text-base font-extrabold font-display text-brand-green uppercase leading-none">
                        {day.weekday}
                      </h3>
                      <span className="text-[10px] text-brand-muted font-bold mt-1 block">{day.dateStr}</span>
                    </div>

                    {/* Macros summing indicators */}
                    <div className="flex gap-2 sm:gap-3 flex-wrap text-[10px] font-bold text-brand-text">
                      <span className="rounded-full border border-brand-border bg-brand-surface px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-brand-green shadow-xs">
                        {pendingReview ? 'Approved subtotal' : 'Planned'}: {Math.round(day.dayCalories)} kcal
                      </span>
                      <span
                        className="rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] shadow-xs"
                        style={{
                          backgroundColor: 'var(--macro-protein-bg)',
                          borderColor: 'var(--macro-protein-border)',
                          color: 'var(--macro-protein)',
                        }}
                      >
                        {Math.round(day.dayProtein)}g Protein
                      </span>
                      <span
                        className="rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] shadow-xs"
                        style={{
                          backgroundColor: 'var(--macro-carbs-bg)',
                          borderColor: 'var(--macro-carbs-border)',
                          color: 'var(--macro-carbs)',
                        }}
                      >
                        {Math.round(day.dayCarbs)}g Carbs
                      </span>
                      <span
                        className="rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] shadow-xs"
                        style={{
                          backgroundColor: 'var(--macro-fat-bg)',
                          borderColor: 'var(--macro-fat-border)',
                          color: 'var(--macro-fat)',
                        }}
                      >
                        {Math.round(day.dayFat)}g Fat
                      </span>
                    </div>
                  </div>

                  {/* Day's 3 Floating Meals Column Stack */}
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                    {day.mealsList.map((meal, index) => (
                      <MealSwapRefresh
                        key={meal.id}
                        refreshing={refreshingSwapMealId === meal.id}
                        mealType={meal.mealType}
                      >
                        <MealCard
                          id={meal.id}
                          mealName={meal.mealName}
                          mealType={meal.mealType}
                          description={meal.description || undefined}
                          ricePortion={meal.ricePortion}
                          calories={meal.calories}
                          proteinG={meal.proteinG}
                          carbsG={meal.carbsG}
                          fatG={meal.fatG}
                          status={meal.status}
                          aiConfidenceFlag={meal.aiConfidenceFlag}
                          ingredients={meal.ingredients}
                          mealLogs={meal.mealLogs}
                          onStatusToggle={handleMealStatusToggle}
                          onSwapClick={handleSwapClick}
                          scheduledDate={meal.scheduledDate}
                          cycleScope={meal.cycleScope}
                          verifier={meal.verifier}
                          explanation={meal.explanation}
                          image={meal.image}
                          cookingLink={meal.cookingLink}
                          nutritionistNote={meal.nutritionistNote}
                          reviewedAt={meal.reviewedAt}
                          index={index}
                          defaultOpen={meal.id === activeModalMealId}
                          onCloseModal={() => setActiveModalMealId(null)}
                        />
                      </MealSwapRefresh>
                    ))}
                  </div>
                </div>
              ))}
            {pendingReview &&
              groupedPendingDays
                .filter((day) => day.dateKey === selectedPlanDay?.dateKey)
                .map((day) => (
                  <div key={`pending-${day.dateKey}`} className="space-y-4 pt-2">
                    <div className="flex flex-col gap-1 px-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-display text-base font-extrabold text-brand-text">
                          Awaiting nutritionist review
                        </h3>
                        <p className="mt-1 text-xs text-brand-muted">
                          These meals remain visible as previews and cannot be logged or swapped until approved.
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                      {day.mealsList.map((meal, index) => (
                        <PendingMealPreviewCard
                          key={`${meal.scheduledDate}-${meal.mealType}-${index}`}
                          meal={meal}
                          index={index}
                          defaultOpen={
                            meal.mealName.toLowerCase().replace(/[^a-z0-9]+/g, '-') === activeModalMealId ||
                            meal.mealType === activeModalMealId
                          }
                        />
                      ))}
                    </div>
                  </div>
                ))}
          </div>
        ))}
    </>
  );
}

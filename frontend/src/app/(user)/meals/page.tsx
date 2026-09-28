'use client';

import { useEffect, useRef } from 'react';
import { useBreadcrumb } from '@/lib/context/BreadcrumbContext';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import MealPlanGenerationProgress from '@/components/user/MealPlanGenerationProgress';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import MealCard from '@/components/user/MealCard';
import MealActivityCalendar from '@/components/user/MealActivityCalendar';
import MealHistoryCard from '@/components/user/MealHistoryCard';
import UnloggedMealCatchUpCard from '@/components/user/UnloggedMealCatchUpCard';
import MealLibraryPanel from '@/features/meals/MealLibraryPanel';
import PendingMealPreviewCard from '@/components/user/PendingMealPreviewCard';
import { showPendingReviewNoticeOnce, showStarterPlanNoticeOnce } from '@/features/meals/plan-status-notice';
import StateNotice from '@/components/shared/StateNotice';
import MealPlanSkeleton from '@/features/meals/MealPlanSkeleton';
import {
  Calendar,
  History,
  BookOpen,
  RefreshCw,
  AlertTriangle,
  Search,
  FileText,
  Clock3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { formatManilaDate, getManilaDateKey, manilaDateFromKey } from '@/lib/manila-date';

import { HISTORY_SOURCE_OPTIONS, HISTORY_STATUS_OPTIONS } from '@/features/meals/history-filter-options';
import { useMealsWorkspace } from '@/features/meals/useMealsWorkspace';
import { MealsWorkspaceModals } from '@/features/meals/MealsWorkspaceModals';
import MotionActiveIndicator from '@/components/ui/motion/MotionActiveIndicator';
import { Select } from '@/components/ui/Select';

export default function WeeklyPlanPage() {
  const { user } = useAuth();
  const workspace = useMealsWorkspace();
  const {
    activeTab,
    setActiveTab,
    meals,
    isLoading,
    isRegenerating,
    regenerationProgress,
    error,
    clinicalEvidenceRequired,
    profileReviewRequired,
    pendingReview,
    awaitingGeneration,
    generationStatus,
    isRetryingMissing,
    retryMissingGeneration,
    cycles,
    setSelectedPlanDateKey,
    historyLogs,
    isHistoryLoading,
    historyTotalCount,
    historyError,
    historySearch,
    setHistorySearch,
    historySource,
    setHistorySource,
    historyStatus,
    setHistoryStatus,
    selectedHistoryDateKey,
    setSelectedHistoryDateKey,
    handleUpdateLogNotes,
    handleEditOutsideItem,
    handleVoidOutsideLog,
    handleRequestOutsideReview,
    handleReplyToOutsideReview,
    handleObservedConsent,
    handleObservedWithdraw,
    handleSwapClick,
    handleMealStatusToggle,
    handleRegeneratePlan,
    setIsRegenerating,
    handleHistorySearchSubmit,
    groupHistoryByDate,
    groupedDays,
    groupedPendingDays,
    displayedPlanDays,
    selectedPlanDayIndex,
    selectedPlanDay,
    isStarterPlan,
    nextCycleDay,
    displayedMealCount,
  } = workspace;
  const upcomingOnly = !cycles?.current && Boolean(cycles?.upcoming) && (displayedMealCount > 0 || awaitingGeneration.upcoming > 0);
  const awaitingGenerationCount = upcomingOnly ? awaitingGeneration.upcoming : awaitingGeneration.current;
  const activeGenerationStatus = upcomingOnly ? generationStatus.upcoming : generationStatus.current;
  const generationCycleId = upcomingOnly ? cycles?.upcoming?.id : cycles?.current?.id;
  const upcomingStart = cycles?.upcoming?.startDate
    ? formatManilaDate(manilaDateFromKey(getManilaDateKey(cycles.upcoming.startDate)), {
        weekday: 'long', month: 'short', day: 'numeric',
      })
    : null;

  const { setSubTab } = useBreadcrumb();

  // Read initial tab from URL if present
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['plan', 'history', 'library'].includes(tabParam.toLowerCase())) {
      setActiveTab(tabParam.toLowerCase() as 'plan' | 'history' | 'library');
    }
  }, [setActiveTab]);

  // Sync activeTab with breadcrumb and URL
  useEffect(() => {
    setSubTab(activeTab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (activeTab === 'plan') {
        url.searchParams.delete('tab');
      } else {
        url.searchParams.set('tab', activeTab);
      }
      window.history.replaceState(null, '', url.pathname + url.search);
    }
  }, [activeTab, setSubTab]);

  const activePlanPillRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    showPendingReviewNoticeOnce({
      userId: user?.userId,
      pending: pendingReview,
      currentCycle: cycles?.current ?? null,
      upcomingCycle: cycles?.upcoming ?? null,
      upcomingOnly,
    });
  }, [user?.userId, pendingReview, cycles, upcomingOnly]);

  useEffect(() => {
    showStarterPlanNoticeOnce({
      userId: user?.userId,
      isStarterPlan,
      nextCycleDay,
      currentCycle: cycles?.current ?? null,
    });
  }, [user?.userId, isStarterPlan, nextCycleDay, cycles]);

  useEffect(() => {
    if (activePlanPillRef.current) {
      activePlanPillRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedPlanDay?.dateKey]);

  if (isRegenerating) {
    return (
      <MealPlanGenerationProgress
        progress={regenerationProgress.progress}
        elapsedSeconds={regenerationProgress.elapsedSeconds}
        stageMessage={regenerationProgress.stageMessage}
        isFailed={regenerationProgress.isFailed}
        errorMessage={regenerationProgress.errorMessage}
        onRetry={() => void handleRegeneratePlan({ replaceExisting: true, skipConfirm: true })}
        onCancel={() => setIsRegenerating(false)}
      />
    );
  }

  const isReportPending = Boolean(
    (user?.onboardingDone && user?.tosAccepted && !user?.reportAcknowledged) ||
    (error && error.toLowerCase().includes('nutrition report')) ||
    (historyError && historyError.toLowerCase().includes('nutrition report'))
  );

  return (
    <div className="portal-page select-none pb-32 text-brand-text">
      {/* Main Container */}
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        {/* Header Block */}
        <PortalPageHeader
          title={
            activeTab === 'plan'
              ? upcomingOnly
                ? 'Upcoming meal plan preview'
                : isStarterPlan
                ? 'Starter meal plan'
                : 'Weekly meal plan'
              : activeTab === 'history'
                ? 'Meal history'
                : 'Meal library'
          }
          description={
            activeTab === 'plan'
              ? upcomingOnly
                ? `Automatically prepared ahead of ${upcomingStart ?? 'your next week'}. These meals are not your active plan.`
                : isStarterPlan && nextCycleDay
                ? `Starter kickoff plan. Your full weekly cycle starts ${nextCycleDay}.`
                : 'Your complete scheduled breakdown, macro targets, and meal review states.'
              : activeTab === 'history'
                ? 'Your logged intake history, completion states, and swapped items.'
                : 'Browse compatible, nutritionist-verified recipes for your profile.'
          }
          className="mb-1"
          actions={
            activeTab === 'plan' && !pendingReview ? (
              <details className="relative">
                <summary className="cursor-pointer rounded-xl border border-brand-border bg-brand-surface px-4 py-2 text-sm font-semibold">
                  Plan options
                </summary>
                <div className="mt-2 max-w-xs rounded-xl border border-brand-border bg-brand-surface p-3">
                  <p className="mb-3 text-xs text-brand-muted">
                    Whole-plan replacement is available before shopping or logging. After that, choose individual meal
                    swaps.
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => handleRegeneratePlan()}
                    className="flex items-center gap-1.5 text-xs font-bold"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Replace entire plan</span>
                  </Button>
                </div>
              </details>
            ) : undefined
          }
        />

        {/* Tab Bar */}
        <nav
          className="grid grid-cols-3 gap-1 rounded-[22px] border border-brand-border/70 bg-brand-surface/85 p-1.5 text-left shadow-sm"
          aria-label="Meal workspace sections"
        >
          {(
            [
              ['plan', 'Plan', Calendar, displayedMealCount],
              ['history', 'History', History, historyTotalCount ?? '…'],
              ['library', 'Library', BookOpen, null],
            ] as const
          ).map(([value, label, Icon, count]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value)}
              aria-pressed={activeTab === value}
              className={`group relative flex min-h-12 items-center justify-center gap-2 rounded-2xl px-3 font-display text-xs font-extrabold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface sm:text-sm ${
                activeTab === value
                  ? 'text-[#07100d]'
                  : 'text-brand-muted hover:bg-brand-bgAlt/70 hover:text-brand-text'
              }`}
            >
              {activeTab === value && (
                <MotionActiveIndicator
                  layoutId="meals-workspace-tab-indicator"
                  className="rounded-2xl bg-brand-accent shadow-neon"
                />
              )}
              <span className="relative z-10 flex items-center justify-center gap-2">
                <Icon className="h-4 w-4" />
                <span>{label}</span>
                <span
                  className={`hidden rounded-full px-1.5 py-0.5 font-mono text-[8px] sm:inline ${
                    activeTab === value ? 'bg-[#07100d]/10' : 'bg-brand-bgAlt'
                  }`}
                >
                  {count}
                </span>
              </span>
            </button>
          ))}
        </nav>

        {activeTab === 'plan' && !isLoading && upcomingOnly && !clinicalEvidenceRequired && !isReportPending && (
          <div className="flex items-start gap-3 rounded-xl border border-status-pending-text/30 bg-status-pending-bg/15 px-4 py-3 text-sm text-brand-text">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-status-pending-text" />
            <p>
              {generationStatus.current === 'FAILED'
                ? 'Your first current plan could not be prepared. Its preparation can be retried from your dashboard.'
                : 'Your first current plan is being prepared automatically. The meals below are next week’s draft, not the active plan.'}
              {' '}Meals awaiting review are previews and cannot be logged, swapped, or shopped for yet.
            </p>
          </div>
        )}

        {activeTab === 'plan' && !isLoading && awaitingGenerationCount > 0 && !clinicalEvidenceRequired && !isReportPending && (
          <div role="status" className="flex items-start gap-3 rounded-xl border border-status-pending-text/30 bg-status-pending-bg/15 px-4 py-3 text-sm text-brand-text">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-status-pending-text" />
            <div>
              <p>{awaitingGenerationCount} meal slot{awaitingGenerationCount === 1 ? '' : 's'} {activeGenerationStatus === 'FAILED' ? 'could not be prepared' : 'still awaiting generation'}. {activeGenerationStatus === 'FAILED' ? (displayedMealCount > 0 ? 'Saved candidates remain available while you retry the missing slots.' : 'No meal candidates were saved for this cycle.') : 'KAINARA fills the earliest days first as AI capacity becomes available.'} Empty slots cannot be reviewed, logged, swapped, or added to groceries yet.</p>
              {activeGenerationStatus === 'FAILED' && generationCycleId && (
                <Button variant="secondary" className="mt-3" onClick={() => void retryMissingGeneration(generationCycleId)} disabled={isRetryingMissing}>
                  {isRetryingMissing ? 'Retrying…' : 'Retry missing slots'}
                </Button>
              )}
            </div>
          </div>
        )}



        {activeTab === 'plan' && !isLoading && displayedPlanDays.length > 0 && selectedPlanDay && (
          <section
            className="mx-auto flex max-w-full items-center gap-1.5 sm:gap-2 rounded-[24px] border border-brand-border/60 bg-brand-surface/75 p-2 shadow-card"
            aria-label="Select a meal-plan day"
          >
            <button
              type="button"
              onClick={() =>
                setSelectedPlanDateKey(
                  displayedPlanDays[selectedPlanDayIndex - 1]?.dateKey ?? selectedPlanDay.dateKey
                )
              }
              disabled={selectedPlanDayIndex === 0}
              className="flex h-10 w-8 sm:h-12 sm:w-10 shrink-0 items-center justify-center text-brand-muted hover:text-brand-text hover:bg-black/[0.04] dark:hover:bg-white/[0.06] rounded-xl sm:rounded-2xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-green disabled:cursor-not-allowed disabled:opacity-20"
              aria-label="Previous plan day"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>

            <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto scrollbar-none snap-x snap-mandatory scroll-smooth">
              {displayedPlanDays.map((day) => {
                const isSelected = day.dateKey === selectedPlanDay.dateKey;
                const parsedDate = manilaDateFromKey(day.dateKey);
                const todayKey = getManilaDateKey(new Date());
                const isToday = day.dateKey === todayKey;
                const isPast = day.dateKey < todayKey;
                const dayLabel = formatManilaDate(parsedDate, { weekday: 'short' });
                const dateLabel = formatManilaDate(parsedDate, { day: 'numeric' });

                return (
                  <button
                    key={day.dateKey}
                    ref={isSelected ? activePlanPillRef : undefined}
                    type="button"
                    onClick={() => setSelectedPlanDateKey(day.dateKey)}
                    aria-pressed={isSelected}
                    className={`flex min-w-[66px] sm:min-w-[76px] flex-1 snap-center flex-col items-center justify-center rounded-xl sm:rounded-2xl border px-2 sm:px-4 py-2 sm:py-3 outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg ${
                      isSelected
                        ? 'border-transparent bg-brand-accent text-black font-extrabold shadow-md shadow-brand-accent/20'
                        : isPast
                          ? 'border-transparent bg-black/[0.04] text-slate-400 hover:bg-black/[0.07] hover:text-slate-600 dark:bg-white/[0.03] dark:text-zinc-500 dark:hover:bg-white/[0.07] dark:hover:text-zinc-300'
                          : 'border-transparent bg-transparent text-brand-muted hover:bg-brand-bgAlt/60 hover:text-brand-text'
                    }`}
                  >
                    <span className="flex items-center gap-1 text-[8px] sm:text-[9px] font-extrabold uppercase tracking-[0.14em]">
                      {dayLabel}
                      {isToday && !isSelected && (
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-green" title="Today" />
                      )}
                    </span>
                    <span className="mt-0.5 sm:mt-1 font-display text-lg sm:text-xl font-black leading-none">
                      {dateLabel}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() =>
                setSelectedPlanDateKey(
                  displayedPlanDays[selectedPlanDayIndex + 1]?.dateKey ?? selectedPlanDay.dateKey
                )
              }
              disabled={selectedPlanDayIndex === displayedPlanDays.length - 1}
              className="flex h-10 w-8 sm:h-12 sm:w-10 shrink-0 items-center justify-center text-brand-muted hover:text-brand-text hover:bg-black/[0.04] dark:hover:bg-white/[0.06] rounded-xl sm:rounded-2xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-green disabled:cursor-not-allowed disabled:opacity-20"
              aria-label="Next plan day"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </section>
        )}

        {error && !clinicalEvidenceRequired && !profileReviewRequired && !error.toLowerCase().includes('nutrition report') && (
          <div className="p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2 text-left">
            <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Conditional Content Rendering */}
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
          ) : groupedDays.length === 0 ? (
            pendingReview ? (
              <section className="flex flex-col gap-6 text-left" aria-label="Pending meal plan review">
                {groupedPendingDays
                  .filter((day) => day.dateKey === selectedPlanDay?.dateKey)
                  .map((day, dayIndex) => (
                    <div
                      key={day.dateKey}
                      className="space-y-4"
                    >
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
                          <PendingMealPreviewCard key={`${meal.scheduledDate}-${meal.mealType}-${index}`} meal={meal} index={index} />
                        ))}
                      </div>
                    </div>
                  ))}
              </section>
            ) : awaitingGenerationCount > 0 && activeGenerationStatus !== 'FAILED' ? (
              <div role="status" className="rounded-2xl border border-brand-border bg-brand-surface p-6 text-sm text-brand-muted">
                The first meal candidates are being prepared. Saved candidates and nutritionist review progress will appear here automatically.
              </div>
            ) : (
              <StateNotice
                variant="no-meal-plan"
                imageAlt="Meal plan preparation"
                title={generationStatus.current === 'FAILED' ? 'Meal Preparation Paused' : 'Preparing Your First Meal Plan'}
                description={generationStatus.current === 'FAILED'
                  ? 'Your first plan could not be prepared. Retry to resume preparation.'
                  : 'Your current meal plan is being prepared automatically. Candidates will appear here for nutritionist review.'}
                action={generationStatus.current === 'FAILED' ? {
                  label: isRegenerating ? 'Retrying...' : 'Retry Preparation',
                  onClick: handleRegeneratePlan,
                  isLoading: isRegenerating,
                } : null}
              />
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
                        <MealCard
                          key={meal.id}
                          id={meal.id}
                          mealName={meal.mealName}
                          mealType={meal.mealType}
                          description={meal.description || undefined}
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
                        />
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
                          <PendingMealPreviewCard key={`${meal.scheduledDate}-${meal.mealType}-${index}`} meal={meal} index={index} />
                        ))}
                      </div>
                    </div>
                  ))}
            </div>
          ))}

        {activeTab === 'history' &&
          (isReportPending ? (
            <StateNotice
              variant="action-needed"
              description="Please review and acknowledge your personalized nutrition report before viewing your meal history."
              action={{
                label: 'View Nutrition Report',
                href: '/profile/nutrition-report',
              }}
            />
          ) : (
            (() => {
              const historyDays = groupHistoryByDate();
              const effectiveDateKey =
                selectedHistoryDateKey || (historyDays.length > 0 ? historyDays[0].dateKey : getManilaDateKey());
              const activeDay = historyDays.find((day) => day.dateKey === effectiveDateKey);

              // Check if there are scheduled plan meals matching effectiveDateKey
              const scheduledForDate = effectiveDateKey
                ? meals.filter((m) => getManilaDateKey(m.scheduledDate) === effectiveDateKey)
                : [];

              // An unlogged meal is one where none of its mealLogs have status DONE or SKIPPED
              const unloggedScheduledMeals = scheduledForDate.filter((m) => {
                return !m.mealLogs?.some((l) => l.status === 'DONE' || l.status === 'SKIPPED');
              });

              const todayKey = getManilaDateKey();
              const parsedEffectiveDate = effectiveDateKey ? manilaDateFromKey(effectiveDateKey) : null;
              const isDateInPastOrToday = Boolean(effectiveDateKey && effectiveDateKey <= todayKey);

              // Check if within the 7-day grace window
              const isWithinGraceWindow = Boolean(
                effectiveDateKey &&
                parsedEffectiveDate &&
                (() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const d = new Date(parsedEffectiveDate);
                  d.setHours(0, 0, 0, 0);
                  const diffDays = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
                  return diffDays >= 0 && diffDays <= 7;
                })()
              );

              const hasUnloggedToCatchUp =
                unloggedScheduledMeals.length > 0 && isDateInPastOrToday && isWithinGraceWindow;
              const weekday = parsedEffectiveDate
                ? formatManilaDate(parsedEffectiveDate, { weekday: 'long' })
                : 'Selected Day';
              const dateStr = parsedEffectiveDate
                ? formatManilaDate(parsedEffectiveDate, { month: 'short', day: 'numeric', year: 'numeric' })
                : '';

              return (
                <div className="space-y-6 text-left">
                  {/* Activity Heatmap Calendar Matrix */}
                  <MealActivityCalendar
                    logs={historyLogs}
                    selectedDateKey={effectiveDateKey}
                    onSelectDateKey={(dateKey) => setSelectedHistoryDateKey(dateKey)}
                  />

                  {/* Filters block */}
                  <div className="flex flex-col items-center justify-between gap-3 rounded-[22px] border border-brand-border/70 bg-brand-surface/90 p-3 shadow-sm md:flex-row dark:border-[#173e33] dark:bg-[#0e271f]">
                    <form onSubmit={handleHistorySearchSubmit} className="flex w-full gap-2 md:max-w-sm">
                      <label className="relative min-w-0 flex-1">
                        <span className="sr-only">Search meal history</span>
                        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                        <input
                          type="text"
                          placeholder="Search history..."
                          value={historySearch}
                          onChange={(e) => setHistorySearch(e.target.value)}
                          className="h-10 w-full rounded-xl border border-brand-border bg-brand-bgAlt/60 pl-10 pr-3 text-xs text-brand-text outline-none focus:border-brand-green dark:border-[#173e33] dark:bg-[#071914] dark:text-white"
                        />
                      </label>
                      <Button type="submit" variant="secondary" className="h-10 px-4 text-xs">
                        Apply
                      </Button>
                    </form>
                    <div className="grid w-full grid-cols-2 gap-2 md:w-auto md:flex md:items-center">
                      <div className="w-full md:w-40">
                        <Select
                          value={historySource}
                          onChange={setHistorySource}
                          options={HISTORY_SOURCE_OPTIONS}
                          aria-label="Filter history by source"
                        />
                      </div>
                      <div className="w-full md:w-36">
                        <Select
                          value={historyStatus}
                          onChange={setHistoryStatus}
                          options={HISTORY_STATUS_OPTIONS}
                          aria-label="Filter history by status"
                        />
                      </div>
                    </div>
                  </div>

                  {isHistoryLoading ? (
                    <div className="flex flex-col items-center py-12 gap-2">
                      <LoadingSpinner size="md" />
                      <span className="text-xs text-brand-muted">Loading history logs...</span>
                    </div>
                  ) : historyError ? (
                    <div className="p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
                      <span>{historyError}</span>
                    </div>
                  ) : historyLogs.length === 0 && !hasUnloggedToCatchUp ? (
                    <div className="p-12 text-center border border-brand-border/40 bg-brand-surface/30 rounded-2xl dark:border-[#173e33] dark:bg-[#0e271f]/50">
                      <FileText className="w-8 h-8 text-brand-green dark:text-brand-accent mx-auto mb-2" />
                      <p className="text-sm text-brand-text dark:text-white font-semibold">No Meal Logs Found</p>
                      <p className="text-xs text-brand-muted mt-1 max-w-sm mx-auto">
                        You haven&apos;t logged any meals matching the selected filters yet.
                      </p>
                    </div>
                  ) : activeDay ? (
                    /* Selected Day Section with Macro Summary, Catch-Up Card (if any unlogged), and Logged Meal Cards */
                    <section className="space-y-4">
                      {/* Day Header Banner with Macro Summary */}
                      <div className="flex flex-col justify-between gap-3 rounded-[24px] border border-brand-border/70 bg-brand-surface p-4 sm:p-5 shadow-sm md:flex-row md:items-center dark:border-[#173e33] dark:bg-[#0e271f]">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-brand-green dark:text-brand-accent font-display uppercase tracking-wider">
                              {activeDay.weekday}
                            </span>
                            <span className="text-xs font-semibold text-brand-muted dark:text-white/40">·</span>
                            <span className="text-xs font-bold text-brand-text dark:text-white/80">
                              {activeDay.dateStr}
                            </span>
                          </div>
                          <p className="text-xs text-brand-muted dark:text-white/40 mt-0.5">
                            {activeDay.mealCount} meal{activeDay.mealCount !== 1 ? 's' : ''} logged
                            {hasUnloggedToCatchUp ? ` · ${unloggedScheduledMeals.length} planned awaiting log` : ''}
                          </p>
                        </div>

                        {/* Day Macro Badges */}
                        <div className="flex flex-wrap gap-2 text-xs font-bold">
                          <span className="rounded-xl border border-brand-border bg-brand-bgAlt px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-brand-green dark:border-[#173e33] dark:bg-[#071914] dark:text-brand-accent">
                            {Math.round(activeDay.totalCalories)} kcal
                          </span>
                          <span
                            className="rounded-xl border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider"
                            style={{
                              backgroundColor: 'var(--macro-protein-bg)',
                              borderColor: 'var(--macro-protein-border)',
                              color: 'var(--macro-protein)',
                            }}
                          >
                            {Math.round(activeDay.totalProtein)}g P
                          </span>
                          <span
                            className="rounded-xl border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider"
                            style={{
                              backgroundColor: 'var(--macro-carbs-bg)',
                              borderColor: 'var(--macro-carbs-border)',
                              color: 'var(--macro-carbs)',
                            }}
                          >
                            {Math.round(activeDay.totalCarbs)}g C
                          </span>
                          <span
                            className="rounded-xl border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider"
                            style={{
                              backgroundColor: 'var(--macro-fat-bg)',
                              borderColor: 'var(--macro-fat-border)',
                              color: 'var(--macro-fat)',
                            }}
                          >
                            {Math.round(activeDay.totalFat)}g F
                          </span>
                        </div>
                      </div>

                      {/* Catch-up Section for Unlogged Scheduled Meals on this day */}
                      {hasUnloggedToCatchUp && (
                        <div className="rounded-[24px] border border-amber-500/25 bg-amber-500/[0.04] p-4 sm:p-5 dark:border-amber-500/20 dark:bg-amber-500/[0.03]">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-3.5">
                            <div className="flex items-center gap-2">
                              <Clock3 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                              <h4 className="font-display text-sm font-extrabold text-brand-text dark:text-white">
                                Missed / Unlogged Plan Meals ({unloggedScheduledMeals.length})
                              </h4>
                            </div>
                            <span className="text-[11px] text-brand-muted dark:text-white/40">
                              Log within your 7-day grace window to keep your adherence accurate.
                            </span>
                          </div>
                          <div className="space-y-2.5">
                            {unloggedScheduledMeals.map((meal) => (
                              <UnloggedMealCatchUpCard
                                key={meal.id}
                                meal={meal}
                                onStatusToggle={handleMealStatusToggle}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Logged Meal Cards List with note editor */}
                      <div className="space-y-3">
                        {activeDay.logsList.map((log) => (
                          <MealHistoryCard
                            key={log.id}
                            log={log}
                            onUpdateNotes={handleUpdateLogNotes}
                            onEditOutsideItem={handleEditOutsideItem}
                            onVoidOutsideLog={handleVoidOutsideLog}
                            onRequestOutsideReview={handleRequestOutsideReview}
                            onReplyToOutsideReview={handleReplyToOutsideReview}
                            onObservedConsent={handleObservedConsent}
                            onObservedWithdraw={handleObservedWithdraw}
                          />
                        ))}
                      </div>
                    </section>
                  ) : hasUnloggedToCatchUp ? (
                    /* Unlogged Scheduled Day (0 meals logged yet, but has plan meals) */
                    <section className="space-y-4">
                      {/* Day Header Banner */}
                      <div className="flex flex-col justify-between gap-3 rounded-[24px] border border-brand-border/70 bg-brand-surface p-4 sm:p-5 shadow-sm md:flex-row md:items-center dark:border-[#173e33] dark:bg-[#0e271f]">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-brand-green dark:text-brand-accent font-display uppercase tracking-wider">
                              {weekday}
                            </span>
                            <span className="text-xs font-semibold text-brand-muted dark:text-white/40">·</span>
                            <span className="text-xs font-bold text-brand-text dark:text-white/80">{dateStr}</span>
                          </div>
                          <p className="text-xs text-brand-muted dark:text-white/40 mt-0.5">
                            0 meals logged · {unloggedScheduledMeals.length} planned awaiting log
                          </p>
                        </div>

                        <span className="self-start md:self-auto rounded-xl border border-[#a64600]/30 bg-[#8c3b00] px-2.5 py-1 font-mono text-[10px] font-extrabold uppercase tracking-wider text-white shadow-xs">
                          Catch-up available
                        </span>
                      </div>

                      {/* Catch-up Section */}
                      <div className="rounded-[24px] border border-amber-500/25 bg-amber-500/[0.04] p-4 sm:p-5 dark:border-amber-500/20 dark:bg-amber-500/[0.03]">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-3.5">
                          <div className="flex items-center gap-2">
                            <Clock3 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            <h4 className="font-display text-sm font-extrabold text-brand-text dark:text-white">
                              Missed / Unlogged Plan Meals ({unloggedScheduledMeals.length})
                            </h4>
                          </div>
                          <span className="text-[11px] text-brand-muted dark:text-white/40">
                            Select whether you ate or skipped these meals to record your intake.
                          </span>
                        </div>
                        <div className="space-y-2.5">
                          {unloggedScheduledMeals.map((meal) => (
                            <UnloggedMealCatchUpCard
                              key={meal.id}
                              meal={meal}
                              onStatusToggle={handleMealStatusToggle}
                            />
                          ))}
                        </div>
                      </div>
                    </section>
                  ) : (
                    /* Empty state when clicking a calendar day that has 0 meals and no planned meals */
                    <div className="p-8 text-center border border-dashed border-brand-border/80 bg-brand-surface/40 rounded-2xl dark:border-[#173e33] dark:bg-[#0e271f]/50">
                      <Calendar className="w-8 h-8 text-brand-muted mx-auto mb-2 opacity-50" />
                      <p className="text-sm text-brand-text dark:text-white font-semibold">
                        No Meals Logged on{' '}
                        {effectiveDateKey
                          ? formatManilaDate(manilaDateFromKey(effectiveDateKey), {
                              weekday: 'long',
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'this date'}
                      </p>
                      <p className="text-xs text-brand-muted mt-1 max-w-sm mx-auto">
                        Select any highlighted day on the activity matrix above to view its meals, or click below to
                        view your most recent day.
                      </p>
                      {historyDays.length > 0 && (
                        <Button
                          variant="secondary"
                          onClick={() => setSelectedHistoryDateKey(historyDays[0].dateKey)}
                          className="mt-4 text-xs font-bold"
                        >
                          View Most Recent Day ({historyDays[0].dateStr})
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()
          ))}

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
            <MealLibraryPanel workspace={workspace} />
          ))}
      </div>

      <MealsWorkspaceModals workspace={workspace} />
    </div>
  );
}

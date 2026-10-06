'use client';

import LoadingSpinner from '@/components/shared/LoadingSpinner';
import StateNotice from '@/components/shared/StateNotice';
import Button from '@/components/ui/Button';
import MealActivityCalendar from '@/components/user/MealActivityCalendar';
import HistoryDaySummary from '@/features/meals/HistoryDaySummary';
import MealHistoryCard from '@/components/user/MealHistoryCard';
import UnloggedMealCatchUpCard from '@/components/user/UnloggedMealCatchUpCard';
import { formatManilaDate, getManilaDateKey, manilaDateFromKey } from '@/lib/manila-date';
import { AlertTriangle, Calendar, Clock3, FileText, Search } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { HISTORY_SOURCE_OPTIONS, HISTORY_STATUS_OPTIONS } from '@/features/meals/history-filter-options';
import type { useMealsPage } from './useMealsPage';

type Props = {
  model: Pick<
    ReturnType<typeof useMealsPage>,
    | 'activeTab'
    | 'isReportPending'
    | 'groupHistoryByDate'
    | 'selectedHistoryDateKey'
    | 'meals'
    | 'historyLogs'
    | 'setSelectedHistoryDateKey'
    | 'handleHistorySearchSubmit'
    | 'historySearch'
    | 'setHistorySearch'
    | 'historySource'
    | 'setHistorySource'
    | 'historyStatus'
    | 'setHistoryStatus'
    | 'isHistoryLoading'
    | 'historyError'
    | 'handleMealStatusToggle'
    | 'handleUpdateLogNotes'
    | 'handleEditOutsideItem'
    | 'handleVoidOutsideLog'
    | 'handleRequestOutsideReview'
    | 'handleReplyToOutsideReview'
    | 'handleObservedConsent'
    | 'handleObservedWithdraw'
  >;
};
export default function MealsHistorySection({ model }: Props) {
  const {
    activeTab,
    isReportPending,
    groupHistoryByDate,
    selectedHistoryDateKey,
    meals,
    historyLogs,
    setSelectedHistoryDateKey,
    handleHistorySearchSubmit,
    historySearch,
    setHistorySearch,
    historySource,
    setHistorySource,
    historyStatus,
    setHistoryStatus,
    isHistoryLoading,
    historyError,
    handleMealStatusToggle,
    handleUpdateLogNotes,
    handleEditOutsideItem,
    handleVoidOutsideLog,
    handleRequestOutsideReview,
    handleReplyToOutsideReview,
    handleObservedConsent,
    handleObservedWithdraw,
  } = model;

  return (
    <>
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
                    <HistoryDaySummary activeDay={activeDay} unloggedCount={unloggedScheduledMeals.length} />

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
                        <div className="space-y-3 pl-4 sm:pl-6 md:pl-7">
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
                    <div className="space-y-3 pl-4 sm:pl-6 md:pl-7">
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
                          <span className="text-xs font-semibold text-brand-muted dark:text-white/40">Â·</span>
                          <span className="text-xs font-bold text-brand-text dark:text-white/80">{dateStr}</span>
                        </div>
                        <p className="text-xs text-brand-muted dark:text-white/40 mt-0.5">
                          0 meals logged Â· {unloggedScheduledMeals.length} planned awaiting log
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
                      <div className="space-y-3 pl-4 sm:pl-6 md:pl-7">
                        {unloggedScheduledMeals.map((meal) => (
                          <UnloggedMealCatchUpCard key={meal.id} meal={meal} onStatusToggle={handleMealStatusToggle} />
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
                      Select any highlighted day on the activity matrix above to view its meals, or click below to view
                      your most recent day.
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
    </>
  );
}

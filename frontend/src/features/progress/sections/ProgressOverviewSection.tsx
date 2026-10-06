'use client';

import Button from '@/components/ui/Button';
import WeightGraph from '@/features/progress/WeightGraph';
import WeightLogHistory from '@/features/progress/WeightLogHistory';

import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';

import { TrendingUp, AlertTriangle, Lightbulb, Scale, Activity } from 'lucide-react';
import { Select } from '@/components/ui/Select';

import type { useProgressWorkspaceModel } from './useProgressWorkspaceModel';
type Model = Extract<ReturnType<typeof useProgressWorkspaceModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<
    Model,
    | 'activeSection'
    | 'isLogFormOpen'
    | 'currentWeight'
    | 'targetWeight'
    | 'weightFormError'
    | 'handleLogWeightSubmit'
    | 'weightInput'
    | 'setWeightInput'
    | 'noteInput'
    | 'setNoteInput'
    | 'setIsLogFormOpen'
    | 'isSubmittingWeight'
    | 'dailyCalorieTarget'
    | 'timeframe'
    | 'setTimeframe'
    | 'groupedLogs'
    | 'history'
    | 'goal'
  >;
};
export default function ProgressOverviewSection({ model }: SectionProps) {
  const {
    activeSection,
    isLogFormOpen,
    currentWeight,
    targetWeight,
    weightFormError,
    handleLogWeightSubmit,
    weightInput,
    setWeightInput,
    noteInput,
    setNoteInput,
    setIsLogFormOpen,
    isSubmittingWeight,
    dailyCalorieTarget,
    timeframe,
    setTimeframe,
    groupedLogs,
    history,
    goal,
  } = model;

  return (
    <>
      {activeSection === 'overview' && (
        <>
          {/* WEIGHT LOGGER COLLAPSIBLE BLOCK */}
          {isLogFormOpen && (
            <Card
              variant="highlight"
              className="p-5 sm:p-6 text-left mb-8 shadow-card border-brand-green/30 bg-brand-surface transition-all duration-300 relative overflow-hidden"
            >
              {/* Top accent badge & header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-brand-border/50">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green">
                    <Scale className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-brand-text uppercase tracking-wide font-display">
                      Log Today&apos;s Weight
                    </h3>
                    <p className="text-xs text-brand-muted">
                      Record your weigh-in to recalibrate your daily metabolic allowance and track your trajectory.
                    </p>
                  </div>
                </div>
                <span className="self-start sm:self-auto text-[11px] font-semibold text-brand-muted bg-brand-bgAlt px-2.5 py-1 rounded-full border border-brand-border/60">
                  📅{' '}
                  {new Date().toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>

              {/* Context Hint / Reference Banner */}
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-brand-green/[0.05] border border-brand-green/15 p-3 text-xs text-brand-muted">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-brand-green shrink-0" />
                  <span>
                    <strong>Pro-tip:</strong> Weigh yourself consistently once a week in the morning after waking up,
                    before food or drink.
                  </span>
                </div>
                {currentWeight > 0 && (
                  <span className="text-xs font-bold text-brand-text bg-brand-surface px-2.5 py-1 rounded-lg border border-brand-border/70 shrink-0">
                    Last recorded: <span className="text-brand-green">{currentWeight} kg</span>
                    {targetWeight > 0 && ` · Goal: ${targetWeight} kg`}
                  </span>
                )}
              </div>

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
                    placeholder={currentWeight ? `e.g. ${currentWeight}` : 'e.g. 68.5'}
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    required
                    autoFocus
                  />
                  <Input
                    label="Note / Comments (Optional)"
                    type="text"
                    placeholder="e.g. Morning weigh-in, post-run, light stomach"
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 justify-end pt-2 border-t border-brand-border/40">
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
                    className="text-xs py-2 px-5 font-bold shadow-md shadow-brand-green/10"
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
                value: currentWeight && targetWeight ? `${Math.abs(targetWeight - currentWeight).toFixed(1)} kg` : '--',
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
                  <p className="mt-4 font-display text-2xl font-black text-brand-text tracking-tight">{metric.value}</p>
                  <p className="mt-1 text-xs font-semibold text-brand-muted">{metric.label}</p>
                </div>
              );
            })}
          </section>

          {/* GRAPH & SUMMARY BLOCKS */}
          <div className="mb-6 text-left">
            {/* Graph Card */}
            <Card className="p-4 sm:p-6 border-brand-border/70 bg-brand-surface shadow-card">
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

          <WeightLogHistory logs={history?.weightLogs ?? []} goal={goal} onLogWeight={() => setIsLogFormOpen(true)} />
        </>
      )}
    </>
  );
}

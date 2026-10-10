'use client';

import WorkspaceTable from '@/components/shared/WorkspaceTable';

import Link from 'next/link';

import Card from '@/components/ui/Card';

import Badge from '@/components/ui/Badge';

import { CheckCircle, Lightbulb, BarChart3, Activity } from 'lucide-react';

import MembershipGate from '@/features/membership/MembershipGate';

import type { useProgressWorkspaceModel } from './useProgressWorkspaceModel';
type Model = Extract<ReturnType<typeof useProgressWorkspaceModel>, { kind: 'ready' }>;
type SectionProps = { model: Pick<Model, 'activeSection' | 'history'> };
export default function ProgressHistorySection({ model }: SectionProps) {
  const { activeSection, history } = model;

  return (
    <>
      {activeSection === 'history' && (
        <MembershipGate benefit="Progress insights">
          {(() => {
            const logs = history?.dailyNutritionLogs || [];
            const averageAdherence =
              logs.length > 0 ? Math.round(logs.reduce((acc, curr) => acc + curr.adherencePct, 0) / logs.length) : null;
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
                        target. Scores compile automatically every night based on meals you mark as eaten on your daily
                        dashboard.
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
                      <WorkspaceTable
                        label="Daily intake history"
                        rows={logs}
                        rowKey={(log) => String(log.id)}
                        columns={[
                          { key: 'col-0', header: <>Date</>, headerClassName: 'min-w-[100px]' },
                          { key: 'col-1', header: <>Calories Consumed</>, headerClassName: 'min-w-[100px]' },
                          { key: 'col-2', header: <>Daily Target</>, headerClassName: 'min-w-[100px]' },
                          { key: 'col-3', header: <>Adherence</>, headerClassName: 'min-w-[100px]' },
                        ]}
                        cells={(log) => {
                          let badgeVar: 'verified' | 'pending' | 'rejected' = 'verified';
                          if (log.adherencePct < 70 || log.adherencePct > 110) badgeVar = 'rejected';
                          else if (log.adherencePct < 90) badgeVar = 'pending';
                          return [
                            <>
                              {new Date(log.logDate).toLocaleDateString(undefined, {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </>,
                            <>{Math.round(log.totalCalories)}kcal</>,
                            <>{Math.round(log.targetCalories)}kcal</>,
                            <>
                              <Badge variant={badgeVar} showIcon={false} className="py-0.5 px-2.5 font-bold">
                                {Math.round(log.adherencePct)}% Adherence
                              </Badge>
                            </>,
                          ];
                        }}
                      />
                    </div>
                  )}
                </Card>
              </div>
            );
          })()}
        </MembershipGate>
      )}
    </>
  );
}

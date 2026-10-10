'use client';

import { CheckCircle2, AlertTriangle, Cpu, Sparkles, Database, Activity } from 'lucide-react';

import Card from '@/components/ui/Card';
import WorkspaceTable from '@/components/shared/WorkspaceTable';

import { cn } from '@/lib/utils';

import { humanize, format } from './AdminStatistics.shared';
import type { useAdminStatisticsModel } from './useAdminStatisticsModel';
type Model = Extract<ReturnType<typeof useAdminStatisticsModel>, { kind: 'ready' }>;
type SectionProps = { model: Pick<Model, 'activeTab' | 'aiSuccessRate' | 'data' | 'savedCandidates'> };
export default function RecordedAiActivitySection({ model }: SectionProps) {
  const { activeTab, aiSuccessRate, data, savedCandidates } = model;

  return (
    <>
      <div
        id="analytics-tab-ai-activity"
        role="tabpanel"
        aria-labelledby="analytics-tab-ai-activity-btn"
        hidden={activeTab !== 'ai-activity'}
        className={cn('space-y-6', activeTab !== 'ai-activity' && 'hidden')}
      >
        <section aria-labelledby="ai-history" className="space-y-4">
          <div>
            <h2 id="ai-history" className="portal-section-label">
              Recorded AI activity
            </h2>
            <p className="text-xs text-brand-muted">
              Model operations, planning volume, and candidate selection history.
            </p>
          </div>

          {/* 4 AI Metric Cards */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card variant="metric" className="p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                  {aiSuccessRate}% 24h
                </span>
              </div>
              <p className="mt-3 text-xs font-bold text-brand-muted">Successful AI operations • 24h</p>
              <p className="mt-1 font-display text-3xl font-black text-brand-text">{format(data.aiSuccess24h)}</p>
              <p className="mt-1.5 text-xs text-brand-muted">Recorded completed operations.</p>
            </Card>

            <Card variant="metric" className="p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" />
                </span>
                {data.aiFailures24h === 0 && (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                    Zero failures
                  </span>
                )}
              </div>
              <p className="mt-3 text-xs font-bold text-brand-muted">Failed AI operations • 24h</p>
              <p className="mt-1 font-display text-3xl font-black text-brand-text">{format(data.aiFailures24h)}</p>
              <p className="mt-1.5 text-xs text-brand-muted">Recorded failed operations.</p>
            </Card>

            <Card variant="metric" className="p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                  <Cpu className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-xs font-bold text-brand-muted">Planning AI operations • 30d</p>
              <p className="mt-1 font-display text-3xl font-black text-brand-text">
                {format(data.planningAiOperations30d)}
              </p>
              <p className="mt-1.5 text-xs text-brand-muted">Corpus lookup and meal generation operations.</p>
            </Card>

            <Card variant="metric" className="p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Sparkles className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 text-xs font-bold text-brand-muted">Saved meal candidates • 30d</p>
              <p className="mt-1 font-display text-3xl font-black text-brand-text">{format(savedCandidates)}</p>
              <p className="mt-1.5 text-xs text-brand-muted">
                Saved rows created in the last 30 days, including replaced or cancelled candidates.
              </p>
            </Card>
          </div>

          <p className="text-xs text-brand-muted">
            An operation can try several models. These totals count recorded operations, not individual provider
            requests or retries. Missing telemetry is not included.
          </p>

          {/* 2 Detail Cards */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5 sm:p-6">
              <div className="flex items-center gap-2 border-b border-brand-border/50 pb-3 mb-4">
                <Activity className="h-4 w-4 text-brand-green" />
                <h3 className="font-bold text-sm text-brand-text">Operations • last 30 days</h3>
              </div>
              {data.aiUsageByOperation30d.length ? (
                <WorkspaceTable
                  label="Recorded AI operations"
                  rows={data.aiUsageByOperation30d}
                  rowKey={(row) => `${row.operation}:${row.purpose}:${row.status}`}
                  columns={[
                    {
                      key: 'operation',
                      header: 'Operation',
                      headerClassName: 'min-w-[140px]',
                      cell: (row) => humanize(row.operation),
                    },
                    {
                      key: 'purpose',
                      header: 'Purpose',
                      headerClassName: 'min-w-[180px]',
                      cell: (row) => <span className="text-brand-muted">{humanize(row.purpose)}</span>,
                    },
                    {
                      key: 'status',
                      header: 'Status',
                      cell: (row) => (
                        <span className="rounded-full bg-brand-bgAlt px-2 py-1 text-[10px] font-bold">
                          {humanize(row.status)}
                        </span>
                      ),
                    },
                    {
                      key: 'count',
                      header: 'Count',
                      cell: (row) => <strong className="font-mono">{format(row.count)}</strong>,
                    },
                  ]}
                />
              ) : (
                <p className="text-sm text-brand-muted">No recorded AI operations in this period.</p>
              )}
            </Card>

            <Card className="p-5 sm:p-6">
              <div className="flex items-center gap-2 border-b border-brand-border/50 pb-3 mb-4">
                <Database className="h-4 w-4 text-brand-green" />
                <h3 className="font-bold text-sm text-brand-text">Saved candidate sources • last 30 days</h3>
              </div>
              {data.planSelectionsByProvenance30d.length ? (
                <WorkspaceTable
                  label="Saved candidate sources"
                  rows={data.planSelectionsByProvenance30d}
                  rowKey={(row) => row.provenance}
                  columns={[
                    { key: 'source', header: 'Source', cell: (row) => humanize(row.provenance) },
                    {
                      key: 'count',
                      header: 'Count',
                      cell: (row) => <strong className="font-mono">{format(row.count)}</strong>,
                    },
                  ]}
                />
              ) : (
                <p className="text-sm text-brand-muted">No saved candidates in this period.</p>
              )}
              <p className="mt-4 text-xs text-brand-muted">
                Sources reflect the current saved candidate records, not an immutable history of original planner
                choices.
              </p>
            </Card>
          </div>
        </section>
      </div>
    </>
  );
}

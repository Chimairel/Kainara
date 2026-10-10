'use client';

import WorkspaceTable from '@/components/shared/WorkspaceTable';

import React from 'react';
import { Plus, Scale } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import type { WeightLog } from './useProgressWorkspace';

export default function WeightLogHistory({
  logs,
  goal,
  onLogWeight,
}: {
  logs: WeightLog[];
  goal: string;
  onLogWeight: () => void;
}) {
  const sortedWeightLogs = React.useMemo(() => {
    return [...logs].sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
  }, [logs]);

  const startWeight = React.useMemo(() => {
    if (!sortedWeightLogs.length) return null;
    return sortedWeightLogs[sortedWeightLogs.length - 1].weightKg;
  }, [sortedWeightLogs]);

  const netDelta = React.useMemo(() => {
    if (!sortedWeightLogs.length || startWeight === null) return null;
    return sortedWeightLogs[0].weightKg - startWeight;
  }, [sortedWeightLogs, startWeight]);

  return (
    <div className="mb-8 text-left">
      <Card className="p-5 sm:p-6 border-brand-border/70 bg-brand-surface shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-brand-border/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-brand-text uppercase tracking-wide font-display">
                Weekly Weight Log History
              </h3>
              <p className="text-xs text-brand-muted">
                Chronological record of your weigh-in observations and milestone notes.
              </p>
            </div>
          </div>

          {sortedWeightLogs.length > 0 && (
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-[11px] font-bold text-brand-muted bg-brand-bgAlt px-2.5 py-1 rounded-full border border-brand-border/60">
                {sortedWeightLogs.length} {sortedWeightLogs.length === 1 ? 'entry' : 'entries'}
              </span>
              {netDelta !== null && (
                <span
                  className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full border ${
                    (goal === 'LOSE_WEIGHT' && netDelta <= 0) || (goal === 'GAIN_WEIGHT' && netDelta >= 0)
                      ? 'bg-status-verified-bg/15 text-status-verified-text border-status-verified-text/30'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                  }`}
                >
                  {netDelta > 0 ? `+${netDelta.toFixed(1)}` : netDelta.toFixed(1)} kg net
                </span>
              )}
            </div>
          )}
        </div>

        {sortedWeightLogs.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-brand-border rounded-2xl text-brand-muted flex flex-col items-center justify-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green">
              <Scale className="w-6 h-6" />
            </div>
            <div className="max-w-md">
              <h4 className="text-sm font-bold text-brand-text">No Weight Logs Recorded Yet</h4>
              <p className="mt-1 text-xs text-brand-muted leading-relaxed">
                Record your first weekly weigh-in to begin tracking your physical progress and refining your daily
                nutrition goals.
              </p>
            </div>
            <Button variant="primary" onClick={onLogWeight} className="mt-2 text-xs font-bold py-2 px-4 shadow-sm">
              <Plus className="w-4 h-4 mr-1.5" />
              Log Today&apos;s Weight
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <WorkspaceTable
              label="Weight history"
              rows={sortedWeightLogs}
              rowKey={(log, index) => String(log.id || `weight-log-${index}`)}
              columns={[
                { key: 'col-0', header: <>Date</>, headerClassName: 'min-w-[100px]' },
                { key: 'col-1', header: <>Recorded Weight</>, headerClassName: 'min-w-[100px]' },
                { key: 'col-2', header: <>Change vs Prev</>, headerClassName: 'min-w-[100px]' },
                { key: 'col-3', header: <>vs Start</>, headerClassName: 'min-w-[100px]' },
                { key: 'col-4', header: <>Source</>, headerClassName: 'min-w-[100px]' },
                { key: 'col-5', header: <>Note / Context</>, headerClassName: 'min-w-[100px]' },
              ]}
              cells={(log, index) => {
                const isLatest = index === 0;
                const prevLog = sortedWeightLogs[index + 1];
                const diffPrev = prevLog ? log.weightKg - prevLog.weightKg : null;
                const earliestLog = sortedWeightLogs[sortedWeightLogs.length - 1];
                const diffStart =
                  earliestLog && sortedWeightLogs.length > 1 ? log.weightKg - earliestLog.weightKg : null;
                return [
                  <>
                    <div className="flex items-center gap-1.5">
                      <span>
                        {new Date(log.loggedAt).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      {isLatest && (
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-brand-green/15 text-brand-green border border-brand-green/30">
                          Latest
                        </span>
                      )}
                    </div>
                  </>,
                  <>
                    {log.weightKg.toFixed(1)}
                    <span className="text-[11px] font-medium text-brand-muted">kg</span>
                  </>,
                  <>
                    {diffPrev !== null ? (
                      <span
                        className={`inline-flex items-center font-bold text-xs ${
                          (goal === 'LOSE_WEIGHT' && diffPrev < 0) || (goal === 'GAIN_WEIGHT' && diffPrev > 0)
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : diffPrev === 0
                              ? 'text-brand-muted'
                              : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {diffPrev > 0 ? `+${diffPrev.toFixed(1)}` : diffPrev.toFixed(1)} kg
                      </span>
                    ) : (
                      <span className="text-brand-muted/70 text-xs">—</span>
                    )}
                  </>,
                  <>
                    {diffStart !== null && index < sortedWeightLogs.length - 1 ? (
                      <span
                        className={`font-semibold text-xs ${
                          (goal === 'LOSE_WEIGHT' && diffStart < 0) || (goal === 'GAIN_WEIGHT' && diffStart > 0)
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : diffStart === 0
                              ? 'text-brand-muted'
                              : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {diffStart > 0 ? `+${diffStart.toFixed(1)}` : diffStart.toFixed(1)} kg
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-brand-muted uppercase bg-brand-bgAlt px-1.5 py-0.5 rounded border border-brand-border/50">
                        Baseline
                      </span>
                    )}
                  </>,
                  <>
                    <Badge
                      variant={log.source === 'ONBOARDING' || log.source === 'INITIAL_REPORT' ? 'user' : 'verified'}
                      showIcon={false}
                      className="text-[10px] font-bold py-0.5 px-2"
                    >
                      {log.source === 'ONBOARDING'
                        ? 'Onboarding'
                        : log.source === 'INITIAL_REPORT'
                          ? 'Report'
                          : 'Weekly Log'}
                    </Badge>
                  </>,
                  <>
                    {log.note ? (
                      <span className="text-brand-text/90 italic" title={log.note}>
                        &ldquo;{log.note}&rdquo;
                      </span>
                    ) : (
                      <span className="text-brand-muted/40">—</span>
                    )}
                  </>,
                ];
              }}
            />
          </div>
        )}
      </Card>
    </div>
  );
}

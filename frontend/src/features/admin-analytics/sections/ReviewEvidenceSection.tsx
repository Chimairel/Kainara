'use client';

import {
  BookOpen,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CalendarClock,
  Cpu,
  RotateCcw,
  Sparkles,
  Activity,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import Card from '@/components/ui/Card';

import { cn } from '@/lib/utils';

import { humanize, format, SignalCard } from './AdminStatistics.shared';
import type { useAdminStatisticsModel } from './useAdminStatisticsModel';
type Model = Extract<ReturnType<typeof useAdminStatisticsModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<Model, 'activeTab' | 'data' | 'completePercent' | 'incompletePercent' | 'stalePercent'>;
};
export default function ReviewEvidenceSection({ model }: SectionProps) {
  const { activeTab, data, completePercent, incompletePercent, stalePercent } = model;

  return (
    <>
      <div
        id="analytics-tab-review-signals"
        role="tabpanel"
        aria-labelledby="analytics-tab-review-signals-btn"
        hidden={activeTab !== 'review-signals'}
        className={cn('space-y-8', activeTab !== 'review-signals' && 'hidden')}
      >
        <section aria-labelledby="review-signals" className="space-y-4">
          <div>
            <h2 id="review-signals" className="portal-section-label">
              Review & preparation signals
            </h2>
            <p className="text-xs text-brand-muted">
              Operational health indicators for clinical review queues and preparation workers.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Panel 1: Clinical Review Pipeline */}
            <Card className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-brand-border/50 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="font-display text-sm font-bold text-brand-text">Clinical review queue</h3>
                    <p className="text-xs text-brand-muted">Queue claims, review delays, and license status</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <SignalCard
                  label="Upcoming slots awaiting review"
                  count={data.pendingReviews}
                  note={`${format(data.activeReviewClaims)} slots have a current eligible reviewer claim. Counts slots, not grouped queue cases.`}
                  icon={Clock}
                  statusType="queue"
                />
                <SignalCard
                  label="Waiting over 2 hours"
                  count={data.overdueReviews}
                  note="Pending upcoming meal slots created more than two hours ago."
                  icon={AlertTriangle}
                  statusType="zero-good"
                />
                <SignalCard
                  label="Pending today & next 48 hours"
                  count={data.pendingPlansStartingSoon}
                  note="Includes slots dated today, even when their saved date is midnight."
                  icon={CalendarClock}
                  statusType="neutral"
                />
                <SignalCard
                  label="Expired verified licenses"
                  count={data.expiredVerifiedNutritionists}
                  note="RND accounts with verified profiles and licenses that expired before today in Manila."
                  href="/admin/users?tab=nutritionists"
                  icon={AlertCircle}
                  statusType="zero-good"
                />
              </div>
            </Card>

            {/* Panel 2: Preparation & Worker Health */}
            <Card className="p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2 border-b border-brand-border/50 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                    <Cpu className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="font-display text-sm font-bold text-brand-text">Preparation &amp; AI workers</h3>
                    <p className="text-xs text-brand-muted">Generation job health, worker timeouts, and adaptations</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <SignalCard
                  label="Failed preparation jobs • 24h"
                  count={data.failedGenerationJobs24h}
                  note="Jobs currently failed and updated in the last 24 hours; not a history of all failure attempts."
                  icon={RotateCcw}
                  statusType="zero-good"
                />
                <SignalCard
                  label="Jobs without an update >20 min"
                  count={data.stuckGenerationJobs}
                  note="Generating or processing AI. Jobs waiting for AI capacity are excluded."
                  icon={Activity}
                  statusType="zero-good"
                />
                <SignalCard
                  label="Check-ins recommending review • 30d"
                  count={data.adaptationReviews30d}
                  note="Saved check-in records, rather than a count of unique members."
                  icon={Sparkles}
                  statusType="neutral"
                />
                <SignalCard
                  label="Available source recipes"
                  count={data.rawRecipeCandidates}
                  note="Available raw candidates. Availability alone does not mean reviewed or safe for planning."
                  icon={BookOpen}
                  statusType="neutral"
                />
              </div>
            </Card>
          </div>
        </section>

        {/* 3. Recorded Library Evidence */}
        <section aria-labelledby="library-evidence" className="space-y-4">
          <div>
            <h2 id="library-evidence" className="portal-section-label">
              Recorded library evidence
            </h2>
            <p className="text-xs text-brand-muted">
              Distribution of complete, incomplete, and stale evidence for saved meals.
            </p>
          </div>

          <Card className="p-5 sm:p-6 space-y-5">
            {/* Distribution Progress Bar */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-brand-text">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-brand-green" />
                  <span>Evidence completeness distribution</span>
                </span>
                <span className="font-mono text-brand-muted">{completePercent}% Complete</span>
              </div>
              <div className="mt-2.5 flex h-2.5 w-full overflow-hidden rounded-full bg-brand-bgAlt/60">
                <div
                  style={{ width: `${completePercent}%` }}
                  className="bg-emerald-500 transition-all duration-300"
                  title={`Complete: ${completePercent}%`}
                />
                <div
                  style={{ width: `${incompletePercent}%` }}
                  className="bg-amber-400 transition-all duration-300"
                  title={`Incomplete: ${incompletePercent}%`}
                />
                <div
                  style={{ width: `${stalePercent}%` }}
                  className="bg-blue-400 transition-all duration-300"
                  title={`Stale: ${stalePercent}%`}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-brand-muted">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Complete ({completePercent}%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-400" /> Incomplete ({incompletePercent}%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-400" /> Stale ({stalePercent}%)
                </span>
              </div>
            </div>

            {/* 4 Stat Blocks */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 pt-2">
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20 p-4">
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Complete evidence records</p>
                <p className="mt-1 font-display text-2xl font-black text-brand-text">
                  {format(data.completeLibraryEvidence)}
                </p>
                <p className="mt-1 text-xs text-brand-muted leading-relaxed">
                  Recorded complete status across all library servings.
                </p>
              </div>

              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/20 p-4">
                <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Incomplete evidence records</p>
                <p className="mt-1 font-display text-2xl font-black text-brand-text">
                  {format(data.incompleteLibraryEvidence)}
                </p>
                <p className="mt-1 text-xs text-brand-muted leading-relaxed">
                  Recorded incomplete status across all library servings.
                </p>
              </div>

              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/20 p-4 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold text-blue-800 dark:text-blue-300">Stale evidence records</p>
                  <p className="mt-1 font-display text-2xl font-black text-brand-text">
                    {format(data.staleLibraryEvidence)}
                  </p>
                  <p className="mt-1 text-xs text-brand-muted leading-relaxed">
                    Recorded stale status across all library servings.
                  </p>
                </div>
                <div className="mt-2 pt-2 border-t border-brand-border/40">
                  <Link
                    href="/admin/meals?tab=library"
                    className="inline-flex min-h-11 items-center text-xs font-bold text-brand-green hover:underline"
                  >
                    View records →
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl border border-brand-border/60 bg-brand-bgAlt/30 p-4">
                <p className="text-xs font-bold text-brand-text">Active, unexpired clearances</p>
                <p className="mt-1 font-display text-2xl font-black text-brand-text">
                  {format(data.activeConditionClearances)}
                </p>
                <p className="mt-1 text-xs text-brand-muted leading-relaxed">
                  Clearances marked active with no expiry or a future expiry.
                </p>
              </div>
            </div>

            <p className="text-xs text-brand-muted">
              These are saved evidence states. Meal approval, reviewer eligibility, policy versions, and member
              restrictions are checked separately before a meal can be used.
            </p>

            {data.activeClearancesByCondition.length > 0 && (
              <div className="border-t border-brand-border/50 pt-4">
                <h3 className="mb-3 text-sm font-bold text-brand-text">Clearance coverage</h3>
                <ul className="grid gap-2 sm:grid-cols-2 text-xs">
                  {data.activeClearancesByCondition.map((row) => (
                    <li
                      key={`${row.condition}:${row.assuranceTier}:${row.provenance}`}
                      className="flex items-center justify-between rounded-xl border border-brand-border/50 bg-brand-bgAlt/40 px-3.5 py-2.5"
                    >
                      <span className="font-medium text-brand-text">
                        {humanize(row.condition)} ·{' '}
                        <span className="text-brand-muted">{humanize(row.assuranceTier)}</span> ·{' '}
                        <span className="text-brand-muted">{humanize(row.provenance)}</span>
                      </span>
                      <strong className="font-mono text-sm font-extrabold text-brand-text">{format(row.count)}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </section>
      </div>
    </>
  );
}

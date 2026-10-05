'use client';
import { useState, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Users,
  Stethoscope,
  CalendarDays,
  CheckCircle2,
  UtensilsCrossed,
  ClipboardList,
  BookOpen,
  FileText,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CalendarClock,
  Cpu,
  RotateCcw,
  Sparkles,
  Database,
  ArrowRight,
  Activity,
  AlertCircle,
  RefreshCw,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import WorkspaceTabs from '@/components/ui/WorkspaceTabs';
import { cn } from '@/lib/utils';
import { useAdminAnalytics } from './useAdminAnalytics';

export type AnalyticsTab = 'totals' | 'review-signals' | 'ai-activity';

const humanize = (value: string) => value.toLowerCase().replaceAll('_', ' ');
const format = (value: number) => value.toLocaleString();

function HeroMetricCard({
  label,
  count,
  note,
  href,
  icon: Icon,
  seed,
  badgeTone = 'emerald',
}: {
  label: string;
  count: number;
  note: string;
  href?: string;
  icon: LucideIcon;
  seed: string;
  badgeTone?: 'emerald' | 'teal' | 'amber' | 'blue';
}) {
  const badgeClasses = {
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  }[badgeTone];

  return (
    <Card
      variant="metric"
      decoration="varied"
      decorationSeed={seed}
      className="flex flex-col justify-between p-5 sm:p-6"
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className={cn('flex h-10 w-10 items-center justify-center rounded-2xl', badgeClasses)}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-wider text-brand-muted">{label}</p>
        <p className="mt-1 font-display text-3xl sm:text-4xl font-black tracking-tight text-brand-text">
          {format(count)}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-brand-muted">{note}</p>
      </div>
      {href && (
        <div className="mt-4 border-t border-brand-border/40 pt-3">
          <Link
            href={href}
            className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-brand-green hover:underline"
          >
            <span>View records</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      )}
    </Card>
  );
}

function SignalCard({
  label,
  count,
  note,
  href,
  icon: Icon,
  statusType = 'neutral',
}: {
  label: string;
  count: number;
  note: string;
  href?: string;
  icon: LucideIcon;
  statusType?: 'zero-good' | 'queue' | 'neutral';
}) {
  const isAlert = statusType === 'zero-good' && count > 0;
  const isHealthy = statusType === 'zero-good' && count === 0;

  return (
    <div
      className={cn(
        'flex flex-col justify-between rounded-2xl border p-4 transition-all',
        isAlert
          ? 'border-red-500/30 bg-red-500/5 dark:bg-red-950/20'
          : 'border-brand-border/60 bg-brand-bgAlt/30 hover:border-brand-border'
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-xl text-xs',
              isAlert
                ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                : 'bg-brand-surface text-brand-muted shadow-xs'
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          {isHealthy && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> All clear
            </span>
          )}
          {isAlert && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
              <AlertTriangle className="h-3 w-3" /> Attention
            </span>
          )}
          {statusType === 'queue' && count > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
              Active
            </span>
          )}
        </div>
        <p className="mt-3 text-xs font-bold text-brand-muted">{label}</p>
        <p className="mt-1 font-display text-2xl font-black text-brand-text">{format(count)}</p>
        <p className="mt-1.5 text-xs text-brand-muted leading-relaxed">{note}</p>
      </div>
      {href && (
        <div className="mt-3 border-t border-brand-border/40 pt-2">
          <Link
            href={href}
            className="inline-flex min-h-11 items-center text-xs font-bold text-brand-green hover:underline"
          >
            View records →
          </Link>
        </div>
      )}
    </div>
  );
}

export default function AdminStatistics({
  active = true,
  defaultTab = 'totals',
  tab,
  onTabChange,
}: {
  active?: boolean;
  defaultTab?: AnalyticsTab;
  tab?: AnalyticsTab;
  onTabChange?: (tab: AnalyticsTab) => void;
}) {
  const [internalTab, setInternalTab] = useState<AnalyticsTab>(defaultTab);
  const activeTab = tab ?? internalTab;
  const handleTabChange = onTabChange ?? setInternalTab;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (hash === '#review-signals' || hash === '#library-evidence') {
      handleTabChange('review-signals');
    } else if (hash === '#ai-history' || hash === '#ai-activity') {
      handleTabChange('ai-activity');
    }
  }, [handleTabChange]);

  const { data, error, isLoading, refetch } = useAdminAnalytics(active);
  if (!data)
    return (
      <Card className="space-y-3 p-6">
        <p role={error ? 'alert' : 'status'}>
          {error ?? (isLoading ? 'Loading platform statistics…' : 'Statistics are unavailable.')}
        </p>
        {error && (
          <Button variant="secondary" onClick={() => void refetch()}>
            Retry
          </Button>
        )}
      </Card>
    );

  const savedCandidates = data.planSelectionsByProvenance30d.reduce((sum, row) => sum + row.count, 0);
  const totalEvidence =
    data.completeLibraryEvidence + data.incompleteLibraryEvidence + data.staleLibraryEvidence;
  const completePercent =
    totalEvidence > 0 ? Math.round((data.completeLibraryEvidence / totalEvidence) * 100) : 0;
  const incompletePercent =
    totalEvidence > 0 ? Math.round((data.incompleteLibraryEvidence / totalEvidence) * 100) : 0;
  const stalePercent =
    totalEvidence > 0 ? Math.max(0, 100 - completePercent - incompletePercent) : 0;

  const total24hAi = data.aiSuccess24h + data.aiFailures24h;
  const aiSuccessRate =
    total24hAi > 0 ? ((data.aiSuccess24h / total24hAi) * 100).toFixed(1) : '100.0';

  return (
    <div className="space-y-8">
      {/* Top Snapshot Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-border/60 bg-brand-surface/60 px-4 py-3 backdrop-blur-xs">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <p className="text-xs font-medium text-brand-muted">
            Snapshot: {new Date(data.generatedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} (Manila)
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void refetch()} className="gap-1.5 text-xs">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh statistics
        </Button>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-status-warning-text/30 p-3 text-sm text-status-warning-text"
        >
          {error} Showing the last successful snapshot above.
        </p>
      )}

      {/* Analytics View Section Tabs */}
      <WorkspaceTabs
        value={activeTab}
        onChange={handleTabChange}
        label="Analytics view sections"
        items={[
          {
            value: 'totals',
            label: 'Platform Totals',
            icon: <BarChart3 className="h-4 w-4 shrink-0" aria-hidden="true" />,
          },
          {
            value: 'review-signals',
            label: 'Review & preparation signals',
            icon: <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />,
          },
          {
            value: 'ai-activity',
            label: 'Recorded AI activity',
            icon: <Cpu className="h-4 w-4 shrink-0" aria-hidden="true" />,
          },
        ]}
      />

      {/* 1. Platform Totals Tab */}
      <div
        id="analytics-tab-totals"
        role="tabpanel"
        aria-labelledby="analytics-tab-totals-btn"
        hidden={activeTab !== 'totals'}
        className={cn('space-y-6', activeTab !== 'totals' && 'hidden')}
      >
        <section aria-labelledby="platform-totals" className="space-y-4">
        <div>
          <h2 id="platform-totals" className="portal-section-label">
            Platform totals
          </h2>
          <p className="text-xs text-brand-muted">Core population scale, clinical capacity, and food database records.</p>
        </div>

        {/* Tier A: Primary Pillars */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <HeroMetricCard
            label="Member accounts"
            count={data.totalUsers}
            note="Accounts with the member role, including suspended accounts."
            href="/admin/users"
            icon={Users}
            seed="members"
            badgeTone="emerald"
          />
          <HeroMetricCard
            label="Eligible nutritionists"
            count={data.verifiedNutritionists}
            note={`Of ${format(data.totalNutritionists)} nutritionist accounts with profiles. Verified, unsuspended, with a current PRC license.`}
            href="/admin/users?tab=nutritionists"
            icon={Stethoscope}
            seed="nutritionists"
            badgeTone="teal"
          />
          <HeroMetricCard
            label="Current plan cycles"
            count={data.activeMealPlans}
            note="Latest current cycle per active member, based on the Manila date."
            icon={CalendarDays}
            seed="plans"
            badgeTone="amber"
          />
          <HeroMetricCard
            label="Approved upcoming slots"
            count={data.approvedUpcomingMealSlots}
            note="Recorded approved slots from today onward; excludes superseded plans and safety holds."
            icon={CheckCircle2}
            seed="slots"
            badgeTone="emerald"
          />
        </div>

        {/* Tier B: Food Data & Knowledge Estate */}
        <Card className="p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-brand-border/50 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green">
                <Database className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-display text-sm font-extrabold text-brand-text">Food catalogue &amp; serving records</h3>
                <p className="text-xs text-brand-muted">Government datasets, alias mappings, and approved serving variations</p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 pt-4">
            <div className="flex flex-col justify-between rounded-2xl border border-brand-border/60 bg-brand-bgAlt/30 p-4 transition-colors hover:border-brand-border">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-surface text-brand-muted shadow-xs">
                    <UtensilsCrossed className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-3 text-xs font-bold text-brand-muted">Library servings</p>
                <p className="mt-1 font-display text-2xl sm:text-3xl font-black text-brand-text">{format(data.libraryCount)}</p>
                <p className="mt-1.5 text-xs text-brand-muted leading-relaxed">Saved serving records, including variants and archived records.</p>
              </div>
              <div className="mt-3 border-t border-brand-border/40 pt-2">
                <Link
                  href="/admin/meals?tab=library"
                  className="inline-flex min-h-11 items-center text-xs font-bold text-brand-green hover:underline"
                >
                  View records →
                </Link>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-brand-border/60 bg-brand-bgAlt/30 p-4 transition-colors hover:border-brand-border">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-surface text-brand-muted shadow-xs">
                    <ClipboardList className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-3 text-xs font-bold text-brand-muted">Food logs recorded</p>
                <p className="mt-1 font-display text-2xl sm:text-3xl font-black text-brand-text">{format(data.totalMealLogs)}</p>
                <p className="mt-1.5 text-xs text-brand-muted leading-relaxed">Logs marked done. Skipped, pending, and voided logs are excluded.</p>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-brand-border/60 bg-brand-bgAlt/30 p-4 transition-colors hover:border-brand-border">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-surface text-brand-muted shadow-xs">
                    <BookOpen className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-3 text-xs font-bold text-brand-muted">FNRI food records</p>
                <p className="mt-1 font-display text-2xl sm:text-3xl font-black text-brand-text">{format(data.totalFoodItems)}</p>
                <p className="mt-1.5 text-xs text-brand-muted leading-relaxed">Food composition records sourced from FNRI.</p>
              </div>
              <div className="mt-3 border-t border-brand-border/40 pt-2">
                <Link
                  href="/admin/data"
                  className="inline-flex min-h-11 items-center text-xs font-bold text-brand-green hover:underline"
                >
                  View records →
                </Link>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-brand-border/60 bg-brand-bgAlt/30 p-4 transition-colors hover:border-brand-border">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-surface text-brand-muted shadow-xs">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-3 text-xs font-bold text-brand-muted">USDA food records</p>
                <p className="mt-1 font-display text-2xl sm:text-3xl font-black text-brand-text">{format(data.usdaFoodItems)}</p>
                <p className="mt-1.5 text-xs text-brand-muted leading-relaxed">{format(data.totalAliases)} food aliases across the catalogue.</p>
              </div>
              <div className="mt-3 border-t border-brand-border/40 pt-2">
                <Link
                  href="/admin/data"
                  className="inline-flex min-h-11 items-center text-xs font-bold text-brand-green hover:underline"
                >
                  View records →
                </Link>
              </div>
            </div>
          </div>
        </Card>
      </section>
      </div>

      {/* 2. Review & Preparation Signals + Recorded Library Evidence Tab */}
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
          <p className="text-xs text-brand-muted">Operational health indicators for clinical review queues and preparation workers.</p>
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
                note="Nutritionist accounts with verified profiles and licenses that expired before today in Manila."
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
          <p className="text-xs text-brand-muted">Distribution of complete, incomplete, and stale evidence for saved meals.</p>
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
              <p className="mt-1 font-display text-2xl font-black text-brand-text">{format(data.completeLibraryEvidence)}</p>
              <p className="mt-1 text-xs text-brand-muted leading-relaxed">Recorded complete status across all library servings.</p>
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/20 p-4">
              <p className="text-xs font-bold text-amber-800 dark:text-amber-300">Incomplete evidence records</p>
              <p className="mt-1 font-display text-2xl font-black text-brand-text">{format(data.incompleteLibraryEvidence)}</p>
              <p className="mt-1 text-xs text-brand-muted leading-relaxed">Recorded incomplete status across all library servings.</p>
            </div>

            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/20 p-4 flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold text-blue-800 dark:text-blue-300">Stale evidence records</p>
                <p className="mt-1 font-display text-2xl font-black text-brand-text">{format(data.staleLibraryEvidence)}</p>
                <p className="mt-1 text-xs text-brand-muted leading-relaxed">Recorded stale status across all library servings.</p>
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
              <p className="mt-1 font-display text-2xl font-black text-brand-text">{format(data.activeConditionClearances)}</p>
              <p className="mt-1 text-xs text-brand-muted leading-relaxed">Clearances marked active with no expiry or a future expiry.</p>
            </div>
          </div>

          <p className="text-xs text-brand-muted">
            These are saved evidence states. Meal approval, reviewer eligibility, policy versions, and member restrictions
            are checked separately before a meal can be used.
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
                      {humanize(row.condition)} · <span className="text-brand-muted">{humanize(row.assuranceTier)}</span> ·{' '}
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

      {/* 3. Recorded AI Activity Tab */}
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
          <p className="text-xs text-brand-muted">Model operations, planning volume, and candidate selection history.</p>
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
            <p className="mt-1 font-display text-3xl font-black text-brand-text">{format(data.planningAiOperations30d)}</p>
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
            <p className="mt-1.5 text-xs text-brand-muted">Saved rows created in the last 30 days, including replaced or cancelled candidates.</p>
          </Card>
        </div>

        <p className="text-xs text-brand-muted">
          An operation can try several models. These totals count recorded operations, not individual provider requests
          or retries. Missing telemetry is not included.
        </p>

        {/* 2 Detail Cards */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-2 border-b border-brand-border/50 pb-3 mb-4">
              <Activity className="h-4 w-4 text-brand-green" />
              <h3 className="font-bold text-sm text-brand-text">Operations • last 30 days</h3>
            </div>
            {data.aiUsageByOperation30d.length ? (
              <ul className="space-y-2.5 text-xs">
                {data.aiUsageByOperation30d.map((row) => (
                  <li
                    key={`${row.operation}:${row.purpose}:${row.status}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-brand-border/40 bg-brand-bgAlt/30 p-2.5"
                  >
                    <span className="break-words font-medium text-brand-text">
                      {humanize(row.operation)} · <span className="text-brand-muted">{humanize(row.purpose)}</span> ·{' '}
                      <span className="rounded-md bg-brand-surface px-1.5 py-0.5 text-[10px] font-bold text-brand-muted">
                        {humanize(row.status)}
                      </span>
                    </span>
                    <strong className="font-mono text-sm font-extrabold text-brand-text">{format(row.count)}</strong>
                  </li>
                ))}
              </ul>
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
              <ul className="space-y-2.5 text-xs">
                {data.planSelectionsByProvenance30d.map((row) => (
                  <li
                    key={row.provenance}
                    className="flex items-center justify-between gap-3 rounded-xl border border-brand-border/40 bg-brand-bgAlt/30 p-2.5"
                  >
                    <span className="font-medium text-brand-text">{humanize(row.provenance)}</span>
                    <strong className="font-mono text-sm font-extrabold text-brand-text">{format(row.count)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-brand-muted">No saved candidates in this period.</p>
            )}
            <p className="mt-4 text-xs text-brand-muted">
              Sources reflect the current saved candidate records, not an immutable history of original planner choices.
            </p>
          </Card>
        </div>
      </section>
      </div>
    </div>
  );
}

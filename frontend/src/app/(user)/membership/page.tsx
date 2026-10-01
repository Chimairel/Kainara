'use client';

import Link from 'next/link';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import Button from '@/components/ui/Button';
import { useMembership } from '@/features/membership/MembershipProvider';
import {
  RefreshCw,
  AlertTriangle,
  Clock,
  ArrowRight,
  CheckCircle2,
  Check,
  UtensilsCrossed,
  Sparkles,
  RefreshCw as ReplanIcon,
  Stethoscope,
  ClipboardCheck,
} from 'lucide-react';

const date = (value: string) =>
  new Date(value).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export default function MembershipPage() {
  const { data, isLoading, error, refresh } = useMembership();

  if (isLoading && !data)
    return (
      <div className="portal-page max-w-5xl mx-auto py-16 text-center" role="status">
        <div className="inline-flex flex-col items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-brand-green/10 text-brand-green flex items-center justify-center animate-spin">
            <RefreshCw className="h-4 w-4" />
          </div>
          <span className="text-xs text-brand-muted">Loading membership…</span>
        </div>
      </div>
    );

  if (error && !data)
    return (
      <div className="portal-page max-w-5xl mx-auto py-8">
        <div className="rounded-2xl border border-status-error-text/30 bg-status-error-bg/20 p-5 text-status-error-text shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <h3 className="font-display text-sm font-bold">Could not load membership</h3>
          </div>
          <p role="alert" className="mt-1 text-xs text-status-error-text/90">
            {error}
          </p>
          <Button onClick={refresh} variant="secondary" className="mt-3 text-xs font-semibold px-3 py-1.5">
            Retry
          </Button>
        </div>
      </div>
    );

  const fallbackLimits = {
    freeSwaps: 3,
    freeEstimates: 2,
    memberSwaps: 6,
    memberEstimates: 10,
    memberReplans: 2,
    memberPlanReviews: 1,
    memberOutsideReviews: 1,
  };

  const limits = data?.enabled && data.limits ? data.limits : fallbackLimits;
  const currentLevel = data?.enabled ? data.level : null;
  const isEnhanced = Boolean(data?.enabled && data.enhanced);

  const labels = {
    FREE: 'Free account',
    TRIAL_PENDING: 'Trial waiting for your first usable plan',
    TRIAL: '14-day membership trial',
    MEMBER: 'Active membership',
  };

  return (
    <div className="portal-page mx-auto max-w-5xl space-y-6 pb-28">
      {/* 1. KAINARA HEADER */}
      <PortalPageHeader
        title="KAINARA membership"
        description="Keep your weekly meals practical. Membership adds adaptation, progress insights and professional review when required."
      />

      {/* 2. ROLLOUT NOTICE (if membership is disabled) */}
      {!data?.enabled && (
        <section className="rounded-2xl border border-brand-border bg-brand-surface p-5 sm:p-6 shadow-xs space-y-2">
          <h2 className="font-display text-base font-bold text-brand-text">
            Membership is being prepared. Your current access has not changed.
          </h2>
          <p className="text-xs leading-relaxed text-brand-muted max-w-2xl">
            All platform features, meal generation, and clinical safety gates remain open for your account while
            membership tiers and payment workflows are finalized.
          </p>
        </section>
      )}

      {/* 3. CURRENT ACCOUNT STATUS & REMAINING ALLOWANCES (with progress bars) */}
      {data?.enabled && (
        <section className="rounded-2xl border border-brand-border bg-brand-surface p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-border/60 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold text-brand-text">{labels[data.level]}</h2>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    data.level === 'FREE'
                      ? 'bg-brand-bgAlt border border-brand-border text-brand-muted'
                      : data.level === 'TRIAL_PENDING'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        : 'bg-brand-green/10 text-brand-green border border-brand-green/20'
                  }`}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  <span>
                    {data.level === 'FREE'
                      ? 'Free tier'
                      : data.level === 'TRIAL_PENDING'
                        ? 'Pending kickoff'
                        : data.level === 'TRIAL'
                          ? 'Trial active'
                          : 'Active subscriber'}
                  </span>
                </span>
              </div>

              <p className="mt-1 text-xs text-brand-muted">
                {data.level === 'TRIAL_PENDING'
                  ? 'Your trial starts when your first cleared current plan is available. A starter plan counts; waiting for review does not.'
                  : data.level === 'MEMBER' && data.paidUntil
                    ? `Membership available until ${date(data.paidUntil)}. No automatic renewal.`
                    : data.trialEndsAt
                      ? `Trial ${data.level === 'FREE' ? 'ended' : 'ends'} ${date(data.trialEndsAt)}. Moving to a full weekly plan does not restart it.`
                      : ''}
              </p>

              {data.requiresCaseReview && data.level === 'FREE' && (
                <p className="mt-2 text-xs font-medium text-status-pending-text">
                  New plans with case review require membership. Existing eligible active meals and previously submitted
                  review follow-up remain available.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-bgAlt border border-brand-border/70 px-3 py-1 font-mono text-[11px] text-brand-muted">
                <Clock className="h-3 w-3 text-brand-green" />
                <span>Next Manila reset: {date(data.resetsAt)}</span>
              </span>
              <button
                onClick={refresh}
                aria-label="Refresh membership status"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-brand-border/70 bg-brand-bgAlt text-brand-muted hover:text-brand-text transition-colors"
                title="Refresh allowances"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* ALLOWANCES TELEMETRY WITH PROGRESS BARS */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-muted">Your remaining allowances</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
              {/* 1. Meal Swaps (2 cols) */}
              <div className="lg:col-span-2 rounded-xl border border-brand-border/70 bg-brand-bgAlt/40 p-4 space-y-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <UtensilsCrossed className="h-3.5 w-3.5 text-brand-green" />
                      <span className="text-xs font-semibold text-brand-text">Meal swaps</span>
                    </div>
                    <span className="rounded bg-brand-surface border border-brand-border/60 px-1.5 py-0.5 text-[9px] font-mono font-medium text-brand-muted">
                      Cycle
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="font-display text-2xl font-bold text-brand-text">{data.swaps.remaining}</span>
                    <span className="text-xs text-brand-muted font-medium">/ {data.swaps.cap} remaining</span>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] text-brand-muted">
                    Meal swaps:{' '}
                    <strong className="font-semibold text-brand-text">
                      {data.swaps.remaining} of {data.swaps.cap}
                    </strong>{' '}
                    for your current cycle
                  </p>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-brand-border/50 overflow-hidden">
                    <div
                      className="h-full bg-brand-green rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(0, (data.swaps.remaining / data.swaps.cap) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 2. AI Estimate Requests (2 cols) */}
              <div className="lg:col-span-2 rounded-xl border border-brand-border/70 bg-brand-bgAlt/40 p-4 space-y-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-brand-accent" />
                      <span className="text-xs font-semibold text-brand-text">AI estimate requests</span>
                    </div>
                    <span className="rounded bg-brand-surface border border-brand-border/60 px-1.5 py-0.5 text-[9px] font-mono font-medium text-brand-muted">
                      Weekly
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="font-display text-2xl font-bold text-brand-text">
                      {data.usage.AI_ESTIMATE.remaining}
                    </span>
                    <span className="text-xs text-brand-muted font-medium">
                      / {data.usage.AI_ESTIMATE.cap} remaining
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] text-brand-muted">
                    AI estimate requests:{' '}
                    <strong className="font-semibold text-brand-text">
                      {data.usage.AI_ESTIMATE.remaining} of {data.usage.AI_ESTIMATE.cap}
                    </strong>
                  </p>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-brand-border/50 overflow-hidden">
                    <div
                      className="h-full bg-brand-accent rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(0, (data.usage.AI_ESTIMATE.remaining / data.usage.AI_ESTIMATE.cap) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 3. Optional Replans (2 cols) */}
              <div className="lg:col-span-2 rounded-xl border border-brand-border/70 bg-brand-bgAlt/40 p-4 space-y-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <ReplanIcon className="h-3.5 w-3.5 text-brand-green" />
                      <span className="text-xs font-semibold text-brand-text">Optional replans</span>
                    </div>
                    <span className="rounded bg-brand-surface border border-brand-border/60 px-1.5 py-0.5 text-[9px] font-mono font-medium text-brand-muted">
                      Weekly
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="font-display text-2xl font-bold text-brand-text">
                      {data.usage.REPLAN.remaining}
                    </span>
                    <span className="text-xs text-brand-muted font-medium">/ {data.usage.REPLAN.cap} remaining</span>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] text-brand-muted">
                    Optional replans:{' '}
                    <strong className="font-semibold text-brand-text">
                      {data.usage.REPLAN.remaining} of {data.usage.REPLAN.cap}
                    </strong>
                  </p>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-brand-border/50 overflow-hidden">
                    <div
                      className="h-full bg-brand-green rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(0, (data.usage.REPLAN.remaining / data.usage.REPLAN.cap) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 4. Plan-Review Episodes (3 cols) */}
              <div className="lg:col-span-3 rounded-xl border border-brand-border/70 bg-brand-bgAlt/40 p-4 space-y-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Stethoscope className="h-3.5 w-3.5 text-brand-green" />
                      <span className="text-xs font-semibold text-brand-text">Plan-review episodes</span>
                    </div>
                    <span className="rounded bg-brand-surface border border-brand-border/60 px-1.5 py-0.5 text-[9px] font-mono font-medium text-brand-muted">
                      Target week
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="font-display text-2xl font-bold text-brand-text">
                      {data.usage.PLAN_REVIEW.remaining}
                    </span>
                    <span className="text-xs text-brand-muted font-medium">
                      / {data.usage.PLAN_REVIEW.cap} remaining
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] text-brand-muted">
                    Plan-review episodes:{' '}
                    <strong className="font-semibold text-brand-text">
                      {data.usage.PLAN_REVIEW.remaining} of {data.usage.PLAN_REVIEW.cap}
                    </strong>
                  </p>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-brand-border/50 overflow-hidden">
                    <div
                      className="h-full bg-brand-green rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(0, (data.usage.PLAN_REVIEW.remaining / data.usage.PLAN_REVIEW.cap) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 5. Outside-Meal Reviews (3 cols) */}
              <div className="lg:col-span-3 rounded-xl border border-brand-border/70 bg-brand-bgAlt/40 p-4 space-y-2.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <ClipboardCheck className="h-3.5 w-3.5 text-brand-green" />
                      <span className="text-xs font-semibold text-brand-text">Outside-meal reviews</span>
                    </div>
                    <span className="rounded bg-brand-surface border border-brand-border/60 px-1.5 py-0.5 text-[9px] font-mono font-medium text-brand-muted">
                      Weekly
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="font-display text-2xl font-bold text-brand-text">
                      {data.usage.OUTSIDE_REVIEW.remaining}
                    </span>
                    <span className="text-xs text-brand-muted font-medium">
                      / {data.usage.OUTSIDE_REVIEW.cap} remaining
                    </span>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] text-brand-muted">
                    Outside-meal reviews:{' '}
                    <strong className="font-semibold text-brand-text">
                      {data.usage.OUTSIDE_REVIEW.remaining} of {data.usage.OUTSIDE_REVIEW.cap}
                    </strong>
                  </p>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-brand-border/50 overflow-hidden">
                    <div
                      className="h-full bg-brand-green rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(0, (data.usage.OUTSIDE_REVIEW.remaining / data.usage.OUTSIDE_REVIEW.cap) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-brand-muted pt-1">
              Estimate, replan and outside-review allowances reset Monday in Manila: {date(data.resetsAt)}. Swaps follow
              each plan cycle; plan review follows its target week. An optional replan that needs new case review also
              uses a plan-review allowance.
            </p>
          </div>
        </section>
      )}

      {/* 4. TWO SIDE-BY-SIDE TIER COMPARISON CARDS (BASIC VS MEMBERSHIP) */}
      <section className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-bold text-brand-text">Compare Plan Tiers</h2>
          <p className="text-xs text-brand-muted">
            Transparent allowances across all accounts. No hidden credit tiers, and basic health updates are never locked.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 items-stretch">
          {/* CARD 1: BASIC PLAN */}
          <div className="flex flex-col justify-between rounded-2xl border border-brand-border bg-brand-surface p-6 sm:p-7 shadow-xs">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="rounded-full bg-brand-bgAlt border border-brand-border px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-brand-muted">
                  Baseline Access
                </span>
                {currentLevel === 'FREE' && (
                  <span className="rounded-full bg-brand-bgAlt border border-brand-border px-2 py-0.5 text-[10px] font-bold text-brand-text">
                    Current Plan
                  </span>
                )}
              </div>

              <h3 className="font-display text-xl font-bold text-brand-text">Basic Plan</h3>
              <p className="mt-1 text-xs text-brand-muted leading-relaxed">
                General meal planning based on your starting intake, grocery checklists, and essential tracking.
              </p>

              <div className="mt-5 space-y-3 border-t border-brand-border/60 pt-5">
                {[
                  'General weekly plans (no declared conditions or allergies)',
                  '3 meal swaps per plan cycle',
                  '2 AI outside-meal estimate requests / week',
                  'Interactive grocery checklists & manual food logging',
                  'Saved records & historical data export',
                  'Always free health corrections & allergy declarations',
                  'Follow-up and completion of admitted reviews',
                ].map((feat) => (
                  <div key={feat} className="flex items-start gap-2.5 text-xs text-brand-text">
                    <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-bgAlt border border-brand-border/70 text-brand-muted mt-0.5">
                      <Check className="h-2.5 w-2.5" />
                    </div>
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-7 pt-4 border-t border-brand-border/50">
              <div className="w-full py-2.5 rounded-xl bg-brand-bgAlt border border-brand-border/60 text-center text-xs font-semibold text-brand-muted">
                {currentLevel === 'FREE' ? 'Current Active Tier' : 'Included Baseline'}
              </div>
            </div>
          </div>

          {/* CARD 2: KAINARA MEMBERSHIP */}
          <div className="flex flex-col justify-between rounded-2xl border-2 border-brand-green/70 dark:border-brand-green/80 bg-brand-surface p-6 sm:p-7 shadow-xs relative">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="rounded-full bg-brand-green/10 text-brand-green border border-brand-green/20 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider">
                  Full Clinical & AI Suite
                </span>
                {isEnhanced && (
                  <span className="rounded-full bg-brand-green text-white px-2 py-0.5 text-[10px] font-bold">
                    {currentLevel === 'MEMBER' ? 'Active Member' : 'Trial Active'}
                  </span>
                )}
              </div>

              <h3 className="font-display text-xl font-bold text-brand-text flex items-center gap-1.5">
                <span>KAINARA Membership</span>
                <Sparkles className="h-4 w-4 text-brand-accent" />
              </h3>
              <p className="mt-1 text-xs text-brand-muted leading-relaxed">
                Adaptive weekly replanning, clinical case review, weight trajectory insights, and expanded allowances.
              </p>

              <div className="mt-5 space-y-3 border-t border-brand-border/60 pt-5">
                {[
                  'Everything in Basic, plus:',
                  `6 meal swaps per cycle (${limits.memberSwaps / limits.freeSwaps}x basic allowance)`,
                  `${limits.memberEstimates} AI estimate requests / week (${limits.memberEstimates / limits.freeEstimates}x allowance)`,
                  `${limits.memberReplans} optional AI replans per Manila week`,
                  `${limits.memberPlanReviews} case plan-review episode per target week`,
                  `${limits.memberOutsideReviews} requested outside-meal review episode / week`,
                  'Progress trajectory, weight analytics & adaptive check-ins',
                  'Discretionary goal, preference and shopping updates',
                ].map((feat, idx) => (
                  <div key={feat} className="flex items-start gap-2.5 text-xs text-brand-text">
                    <div
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full mt-0.5 ${
                        idx === 0
                          ? 'bg-transparent text-brand-muted'
                          : 'bg-brand-green/15 text-brand-green'
                      }`}
                    >
                      <Check className="h-2.5 w-2.5 stroke-[2.5]" />
                    </div>
                    <span className={idx === 0 ? 'font-bold text-brand-muted' : 'font-medium'}>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-7 pt-4 border-t border-brand-border/50">
              <Button disabled className="w-full py-2.5 text-xs font-semibold rounded-xl">
                Purchases opening soon
              </Button>
              <p className="mt-2 text-center text-[10px] text-brand-muted leading-relaxed">
                Pricing and payment setup are being finalized. No payment details are collected and no automatic charges occur.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. CLINICAL SAFETY REASSURANCE & HEALTH UPDATE LINK */}
      <section className="rounded-2xl border border-brand-border bg-brand-surface p-5 sm:p-6 shadow-xs space-y-3">
        <h3 className="font-display text-sm font-bold text-brand-text">
          Health Corrections & Clinical Safety Are Always Free
        </h3>
        <p className="text-xs leading-relaxed text-brand-muted max-w-3xl">
          Health corrections, safety checks, manual meal logging, groceries and access to existing records remain
          available. Review can approve, request changes or decline; membership does not guarantee verification or
          continuous monitoring. Corrections needed to finish an existing review do not spend another allowance.
          Saved estimates remain estimates unless reviewed.
        </p>
        <div>
          <Link
            href="/profile/health"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-green hover:underline"
          >
            <span>Update health information</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    </div>
  );
}

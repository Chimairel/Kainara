'use client';

import Link from 'next/link';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import Button from '@/components/ui/Button';
import { useMembership } from '@/features/membership/MembershipProvider';
import { RefreshCw, AlertTriangle, Clock, ArrowRight, CheckCircle2 } from 'lucide-react';

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
      <div className="portal-page max-w-4xl mx-auto py-16 text-center" role="status">
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
      <div className="portal-page max-w-4xl mx-auto py-8">
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

  const labels = {
    FREE: 'Free account',
    TRIAL_PENDING: 'Trial waiting for your first usable plan',
    TRIAL: '14-day membership trial',
    MEMBER: 'Active membership',
  };

  const comparisonRows = [
    ['Weekly general meal plans (no declared conditions or allergies)', 'Based on your starting profile', 'Included'],
    ['Optional goal, food preference and shopping updates', '—', 'Included'],
    ['Meal swaps per plan week', String(limits.freeSwaps), String(limits.memberSwaps)],
    ['AI outside-meal estimate requests per week', String(limits.freeEstimates), String(limits.memberEstimates)],
    ['Optional replans per week', '—', String(limits.memberReplans)],
    ['Progress insights', '—', 'Included'],
    ['Plan-review episodes per target plan week', 'Follow-up only', String(limits.memberPlanReviews)],
    ['Requested outside-meal review episodes per week', 'Follow-up only', String(limits.memberOutsideReviews)],
  ];

  return (
    <div className="portal-page mx-auto max-w-4xl space-y-6 pb-28">
      {/* 1. HEADER */}
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

      {/* 3. CURRENT ACCOUNT COCKPIT & ALLOWANCES (if membership is enabled) */}
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

          {/* ALLOWANCES TELEMETRY */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-brand-muted">Your remaining allowances</h3>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {/* Meal Swaps */}
              <div className="rounded-xl border border-brand-border/70 bg-brand-bgAlt/40 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-brand-text">Meal swaps</span>
                  <span className="rounded bg-brand-surface border border-brand-border/60 px-1.5 py-0.5 text-[9px] font-mono font-medium text-brand-muted">
                    Cycle
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-2xl font-bold text-brand-text">{data.swaps.remaining}</span>
                  <span className="text-xs text-brand-muted font-medium">/ {data.swaps.cap} remaining</span>
                </div>
                <p className="text-[11px] text-brand-muted">
                  Meal swaps:{' '}
                  <strong className="font-semibold text-brand-text">
                    {data.swaps.remaining} of {data.swaps.cap}
                  </strong>{' '}
                  for your current cycle
                </p>
              </div>

              {/* AI Estimate Requests */}
              <div className="rounded-xl border border-brand-border/70 bg-brand-bgAlt/40 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-brand-text">AI estimate requests</span>
                  <span className="rounded bg-brand-surface border border-brand-border/60 px-1.5 py-0.5 text-[9px] font-mono font-medium text-brand-muted">
                    Weekly
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-2xl font-bold text-brand-text">
                    {data.usage.AI_ESTIMATE.remaining}
                  </span>
                  <span className="text-xs text-brand-muted font-medium">
                    / {data.usage.AI_ESTIMATE.cap} remaining
                  </span>
                </div>
                <p className="text-[11px] text-brand-muted">
                  AI estimate requests:{' '}
                  <strong className="font-semibold text-brand-text">
                    {data.usage.AI_ESTIMATE.remaining} of {data.usage.AI_ESTIMATE.cap}
                  </strong>
                </p>
              </div>

              {/* Optional Replans */}
              <div className="rounded-xl border border-brand-border/70 bg-brand-bgAlt/40 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-brand-text">Optional replans</span>
                  <span className="rounded bg-brand-surface border border-brand-border/60 px-1.5 py-0.5 text-[9px] font-mono font-medium text-brand-muted">
                    Weekly
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-2xl font-bold text-brand-text">
                    {data.usage.REPLAN.remaining}
                  </span>
                  <span className="text-xs text-brand-muted font-medium">/ {data.usage.REPLAN.cap} remaining</span>
                </div>
                <p className="text-[11px] text-brand-muted">
                  Optional replans:{' '}
                  <strong className="font-semibold text-brand-text">
                    {data.usage.REPLAN.remaining} of {data.usage.REPLAN.cap}
                  </strong>
                </p>
              </div>

              {/* Plan-Review Episodes */}
              <div className="rounded-xl border border-brand-border/70 bg-brand-bgAlt/40 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-brand-text">Plan-review episodes</span>
                  <span className="rounded bg-brand-surface border border-brand-border/60 px-1.5 py-0.5 text-[9px] font-mono font-medium text-brand-muted">
                    Target week
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-2xl font-bold text-brand-text">
                    {data.usage.PLAN_REVIEW.remaining}
                  </span>
                  <span className="text-xs text-brand-muted font-medium">
                    / {data.usage.PLAN_REVIEW.cap} remaining
                  </span>
                </div>
                <p className="text-[11px] text-brand-muted">
                  Plan-review episodes:{' '}
                  <strong className="font-semibold text-brand-text">
                    {data.usage.PLAN_REVIEW.remaining} of {data.usage.PLAN_REVIEW.cap}
                  </strong>
                </p>
              </div>

              {/* Outside-Meal Reviews */}
              <div className="rounded-xl border border-brand-border/70 bg-brand-bgAlt/40 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-brand-text">Outside-meal reviews</span>
                  <span className="rounded bg-brand-surface border border-brand-border/60 px-1.5 py-0.5 text-[9px] font-mono font-medium text-brand-muted">
                    Weekly
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-2xl font-bold text-brand-text">
                    {data.usage.OUTSIDE_REVIEW.remaining}
                  </span>
                  <span className="text-xs text-brand-muted font-medium">
                    / {data.usage.OUTSIDE_REVIEW.cap} remaining
                  </span>
                </div>
                <p className="text-[11px] text-brand-muted">
                  Outside-meal reviews:{' '}
                  <strong className="font-semibold text-brand-text">
                    {data.usage.OUTSIDE_REVIEW.remaining} of {data.usage.OUTSIDE_REVIEW.cap}
                  </strong>
                </p>
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

      {/* 4. BENEFIT COMPARISON TABLE */}
      <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-xs">
        <div className="border-b border-brand-border/60 p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-brand-text">
            One membership, the same allowances for every subscriber
          </h2>
          <p className="mt-0.5 text-xs text-brand-muted">
            Transparent allowances across all accounts. No hidden credit tiers, and basic health updates are never
            locked.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-brand-border/60 bg-brand-bgAlt/50 text-[11px] font-semibold uppercase tracking-wider text-brand-muted">
                <th className="p-4 pl-5 sm:pl-6">Benefit</th>
                <th className="p-4">Free</th>
                <th className="p-4 pr-5 sm:pr-6">Membership / trial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/50">
              {comparisonRows.map(([feature, free, member]) => (
                <tr key={feature} className="transition-colors hover:bg-brand-bgAlt/30">
                  <th className="p-4 pl-5 sm:pl-6 font-medium text-brand-text">{feature}</th>
                  <td className="p-4 text-brand-muted">{free}</td>
                  <td className="p-4 pr-5 sm:pr-6 font-semibold text-brand-green dark:text-brand-accent">{member}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. PURCHASES STATUS & CLINICAL SAFETY CALLOUT */}
      <section className="rounded-2xl border border-brand-border bg-brand-surface p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-display text-lg font-bold text-brand-text">
              Membership purchases are not available yet
            </h2>
            <p className="text-xs text-brand-muted max-w-xl leading-relaxed">
              Pricing and payment setup are being finalized. No payment details are collected and no automatic charges
              occur.
            </p>
          </div>
          <Button disabled className="shrink-0 text-xs font-semibold px-5 py-2.5">
            Purchases opening soon
          </Button>
        </div>

        <div className="border-t border-brand-border/60 pt-4 space-y-2">
          <p className="text-xs leading-relaxed text-brand-muted">
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
        </div>
      </section>
    </div>
  );
}

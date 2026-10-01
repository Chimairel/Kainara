'use client';

import { useState, useEffect } from 'react';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import Button from '@/components/ui/Button';
import { useMembership } from '@/features/membership/MembershipProvider';
import Pricing from '@/components/ui/pricing-01';
import {
  RefreshCw,
  AlertTriangle,
  Clock,
  ArrowRight,
  CheckCircle2,
  UtensilsCrossed,
  Sparkles,
  RefreshCw as ReplanIcon,
  Stethoscope,
  ClipboardCheck,
  BarChart3,
  Layers,
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
  const [activeTab, setActiveTab] = useState<'allowances' | 'plans'>('allowances');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'plans' || tabParam === 'allowances') {
      setActiveTab(tabParam);
    }
  }, []);

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
    TRIAL_PENDING: 'Pro waiting for your first usable plan',
    TRIAL: 'Pro Subscription',
    MEMBER: 'Active membership',
  };

  return (
    <div className="portal-page mx-auto max-w-5xl space-y-6 pb-28">
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

      {/* 3. TABS SWITCHER */}
      <nav
        aria-label="Membership sections"
        className="grid grid-cols-2 gap-1.5 rounded-2xl border border-brand-border/80 bg-brand-surface p-1.5 shadow-xs"
      >
        <button
          type="button"
          role="tab"
          id="tab-allowances"
          aria-selected={activeTab === 'allowances'}
          aria-controls="tabpanel-allowances"
          onClick={() => setActiveTab('allowances')}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold transition-all ${
            activeTab === 'allowances'
              ? 'bg-brand-green text-white shadow-xs'
              : 'text-brand-muted hover:bg-brand-bgAlt hover:text-brand-text'
          }`}
        >
          <BarChart3 className="h-4 w-4 shrink-0" />
          <span>Allowances & Usage</span>
        </button>

        <button
          type="button"
          role="tab"
          id="tab-plans"
          aria-selected={activeTab === 'plans'}
          aria-controls="tabpanel-plans"
          onClick={() => setActiveTab('plans')}
          className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-xs font-bold transition-all ${
            activeTab === 'plans'
              ? 'bg-brand-green text-white shadow-xs'
              : 'text-brand-muted hover:bg-brand-bgAlt hover:text-brand-text'
          }`}
        >
          <Layers className="h-4 w-4 shrink-0" />
          <span>Membership Plans</span>
        </button>
      </nav>

      {/* TAB 1: ALLOWANCES & USAGE */}
      <div
        role="tabpanel"
        id="tabpanel-allowances"
        aria-labelledby="tab-allowances"
        className={activeTab === 'allowances' ? 'space-y-6' : 'hidden'}
      >
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
                            ? 'Pro active'
                            : 'Active subscriber'}
                    </span>
                  </span>
                </div>

                <p className="mt-1 text-xs text-brand-muted">
                  {data.level === 'TRIAL_PENDING'
                    ? 'Your Pro access starts when your first cleared current plan is available. A starter plan counts; waiting for review does not.'
                    : data.level === 'MEMBER' && data.paidUntil
                      ? `Membership available until ${date(data.paidUntil)}. No automatic renewal.`
                      : data.trialEndsAt
                        ? `Pro access ${data.level === 'FREE' ? 'ended' : 'ends'} ${date(data.trialEndsAt)}. Moving to a full weekly plan does not restart it.`
                        : ''}
                </p>

                {data.requiresCaseReview && data.level === 'FREE' && (
                  <p className="mt-2 text-xs font-medium text-status-pending-text">
                    New plans with case review require membership. Existing eligible active meals and previously
                    submitted review follow-up remain available.
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
                      <span className="text-xs text-brand-muted font-medium">
                        / {data.usage.REPLAN.cap} remaining
                      </span>
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

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs text-brand-muted">
                <p className="leading-relaxed">
                  Estimate, replan and outside-review allowances reset Monday in Manila: {date(data.resetsAt)}. Swaps
                  follow each plan cycle; plan review follows its target week.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('plans')}
                  className="inline-flex items-center gap-1 font-bold text-brand-green hover:underline shrink-0"
                >
                  <span>Compare plan tiers</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* TAB 2: MEMBERSHIP PLANS */}
      <div
        role="tabpanel"
        id="tabpanel-plans"
        aria-labelledby="tab-plans"
        className={activeTab === 'plans' ? 'space-y-6' : 'hidden'}
      >
        <Pricing currentLevel={currentLevel} isEnhanced={isEnhanced} limits={limits} />
      </div>
    </div>
  );
}

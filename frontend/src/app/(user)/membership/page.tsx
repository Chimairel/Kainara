'use client';

import { useState } from 'react';
import Link from 'next/link';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import Button from '@/components/ui/Button';
import { useMembership } from '@/features/membership/MembershipProvider';
import {
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Clock,
  AlertTriangle,
  ChevronDown,
  Info,
  ArrowRight,
  Heart,
  UtensilsCrossed,
  Stethoscope,
  ClipboardCheck,
  Check,
  Calendar,
  Activity,
} from 'lucide-react';

const date = (value: string) =>
  new Date(value).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

interface FAQItemProps {
  question: string;
  answer: string;
}

function FAQItem({ question, answer }: FAQItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-brand-border/60 bg-brand-surface/70 transition-all hover:border-brand-border duration-150 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-4 p-4 sm:p-5 text-left font-display text-sm font-bold text-brand-text transition hover:text-brand-green"
        aria-expanded={isOpen}
      >
        <span className="leading-snug">{question}</span>
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-brand-bgAlt transition-transform duration-200 ${
            isOpen ? 'rotate-180 bg-brand-green/10 text-brand-green' : 'text-brand-muted'
          }`}
        >
          <ChevronDown className="h-4 w-4" />
        </div>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 text-xs leading-relaxed text-brand-muted border-t border-brand-border/40 animate-in fade-in duration-150">
          <p className="mt-3">{answer}</p>
        </div>
      )}
    </div>
  );
}

export default function MembershipPage() {
  const { data, isLoading, error, refresh } = useMembership();

  if (isLoading && !data)
    return (
      <div className="portal-page max-w-5xl mx-auto py-16 text-center" role="status">
        <div className="inline-flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-brand-green/10 text-brand-green flex items-center justify-center animate-spin">
            <RefreshCw className="h-5 w-5" />
          </div>
          <span className="text-xs font-bold text-brand-muted">Loading membership & allowances…</span>
        </div>
      </div>
    );

  if (error && !data)
    return (
      <div className="portal-page max-w-5xl mx-auto space-y-4 py-8">
        <div className="rounded-3xl border border-status-error-text/30 bg-status-error-bg/20 p-6 text-status-error-text shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <h3 className="font-display text-base font-bold">Could not load membership</h3>
          </div>
          <p role="alert" className="mt-2 text-xs leading-relaxed text-status-error-text/90">
            {error}
          </p>
          <Button onClick={refresh} variant="secondary" className="mt-4 text-xs font-bold px-4 py-2">
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

  const labels = {
    FREE: 'Free account',
    TRIAL_PENDING: 'Trial waiting for your first usable plan',
    TRIAL: '14-day membership trial',
    MEMBER: 'Active membership',
  };

  return (
    <div className="portal-page mx-auto max-w-5xl space-y-8 pb-28">
      {/* 1. TOP HEADER WITH MODERN GLOW */}
      <div className="relative">
        <div className="pointer-events-none absolute -top-12 left-1/4 h-56 w-96 rounded-full bg-brand-green/10 dark:bg-brand-accent/5 blur-[90px]" />
        <PortalPageHeader
          icon={Sparkles}
          eyebrow="Account & Access"
          title="KAINARA membership"
          description="Keep your weekly meals practical. Membership adds adaptation, progress insights and professional review when required."
        />
      </div>

      {/* 2. ROLLOUT NOTICE BANNER (if enabled === false) */}
      {!data?.enabled && (
        <section className="relative overflow-hidden rounded-3xl border border-brand-green/30 bg-gradient-to-br from-brand-surface via-brand-surface to-brand-green/[0.04] p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-green/15 text-brand-green">
              <Info className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-brand-text">
                Membership is being prepared. Your current access has not changed.
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-brand-muted">
                All platform features, meal generation, and clinical safety gates remain open for your account while
                membership tiers and payment workflows are finalized. Discover the full capabilities and allowances
                below.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 3. ACCOUNT STATUS HERO CARD (if enabled === true) */}
      {data?.enabled && (
        <section className="relative overflow-hidden rounded-3xl border border-brand-border/80 bg-gradient-to-br from-brand-surface via-brand-surface to-brand-green/[0.04] p-6 sm:p-7 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-green/10 dark:bg-brand-accent/15 px-3 py-1 text-xs font-black uppercase tracking-wider text-brand-green dark:text-brand-accent">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {data.level === 'MEMBER'
                    ? 'Member'
                    : data.level === 'TRIAL'
                      ? 'Trial Active'
                      : data.level === 'TRIAL_PENDING'
                        ? 'Trial Pending'
                        : 'Free Tier'}
                </span>
                {data.enhanced && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-brand-border/60 bg-brand-bgAlt px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-muted">
                    Enhanced Access
                  </span>
                )}
              </div>

              <h2 className="mt-3 font-display text-2xl sm:text-3xl font-extrabold text-brand-text tracking-tight">
                {labels[data.level]}
              </h2>

              <p className="mt-1.5 text-xs text-brand-muted max-w-2xl leading-relaxed">
                {data.level === 'TRIAL_PENDING'
                  ? 'Your trial starts when your first cleared current plan is available. A starter plan counts; waiting for review does not.'
                  : data.level === 'MEMBER' && data.paidUntil
                    ? `Membership available until ${date(data.paidUntil)}. No automatic renewal.`
                    : data.trialEndsAt
                      ? `Trial ${data.level === 'FREE' ? 'ended' : 'ends'} ${date(data.trialEndsAt)}. Moving to a full weekly plan does not restart it.`
                      : 'Standard free access. General weekly plans, saved records, and safety updates continue.'}
              </p>
            </div>

            <div className="flex flex-col sm:items-end gap-1.5 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-brand-border/60">
              <span className="text-[10px] uppercase font-bold tracking-wider text-brand-muted flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Next Manila Reset
              </span>
              <div className="flex items-center gap-2 rounded-2xl bg-brand-bgAlt/70 border border-brand-border/70 px-3.5 py-2">
                <Clock className="h-4 w-4 text-brand-green shrink-0" />
                <span className="font-mono text-xs font-extrabold text-brand-text">{date(data.resetsAt)}</span>
              </div>
            </div>
          </div>

          {data.requiresCaseReview && data.level === 'FREE' && (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-status-pending-text/30 bg-status-pending-bg/15 p-4 text-xs text-status-pending-text">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">New plans with case review require membership.</strong>
                Existing eligible active meals and previously submitted review follow-up remain available.
              </div>
            </div>
          )}
        </section>
      )}

      {/* 4. MODERN SIDE-BY-SIDE TIER CARDS */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-bold text-brand-text">Membership Tiers</h2>
          <p className="text-xs text-brand-muted mt-0.5">
            Transparent access designed for cultural Filipino meals, clinical precision, and everyday sustainability.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
          {/* FREE PLAN CARD */}
          <div className="flex flex-col justify-between rounded-3xl border border-brand-border/80 bg-brand-surface p-6 sm:p-7 shadow-xs relative">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="rounded-full bg-brand-bgAlt border border-brand-border/70 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-brand-muted">
                  Baseline Access
                </span>
                {currentLevel === 'FREE' && (
                  <span className="rounded-full bg-brand-border/60 px-2.5 py-0.5 text-[10px] font-bold text-brand-text">
                    Current Plan
                  </span>
                )}
              </div>

              <h3 className="font-display text-xl font-bold text-brand-text">Free Plan</h3>
              <p className="mt-1 text-xs text-brand-muted leading-relaxed">
                General meal planning based on your starting intake, grocery checklists, and essential tracking.
              </p>

              <div className="mt-6 space-y-3 border-t border-brand-border/60 pt-5">
                {[
                  'General weekly plans (no declared conditions)',
                  '3 meal swaps per plan cycle',
                  '2 AI outside-meal estimate requests / week',
                  'Interactive grocery checklists & manual food logging',
                  'Saved records & historical data export',
                  'Always free health corrections & allergy declarations',
                ].map((feat) => (
                  <div key={feat} className="flex items-start gap-2.5 text-xs text-brand-text">
                    <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-bgAlt border border-brand-border text-brand-muted mt-0.5">
                      <Check className="h-2.5 w-2.5" />
                    </div>
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-brand-border/50">
              <div className="w-full py-2.5 rounded-2xl bg-brand-bgAlt text-center text-xs font-bold text-brand-muted">
                {currentLevel === 'FREE' ? 'Current Active Tier' : 'Included Baseline'}
              </div>
            </div>
          </div>

          {/* KAINARA MEMBER CARD (HIGHLIGHTED) */}
          <div className="flex flex-col justify-between rounded-3xl border-2 border-brand-green/60 dark:border-brand-accent/70 bg-gradient-to-b from-brand-surface via-brand-surface to-brand-green/[0.04] p-6 sm:p-7 shadow-lg shadow-brand-green/5 dark:shadow-brand-accent/5 relative overflow-hidden">
            <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-brand-green/15 dark:bg-brand-accent/15 blur-2xl" />

            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="rounded-full bg-brand-green/15 dark:bg-brand-accent/20 px-3 py-1 font-mono text-[10px] font-black uppercase tracking-wider text-brand-green dark:text-brand-accent">
                  Full Clinical & AI Suite
                </span>
                {isEnhanced && (
                  <span className="rounded-full bg-brand-green text-white dark:bg-brand-accent dark:text-[#07100d] px-2.5 py-0.5 text-[10px] font-extrabold">
                    {currentLevel === 'MEMBER' ? 'Active Member' : 'Trial Active'}
                  </span>
                )}
              </div>

              <h3 className="font-display text-xl font-bold text-brand-text flex items-center gap-1.5">
                <span>KAINARA Member</span>
                <Sparkles className="h-4 w-4 text-brand-green dark:text-brand-accent" />
              </h3>
              <p className="mt-1 text-xs text-brand-muted leading-relaxed">
                Adaptive weekly replanning, clinical case review, weight trajectory insights, and generous allowances.
              </p>

              <div className="mt-6 space-y-3 border-t border-brand-border/60 pt-5">
                {[
                  'Everything in Free, plus:',
                  '6 meal swaps per cycle (2x free allowance)',
                  '10 AI estimate requests per week (5x allowance)',
                  '2 optional AI replans per Manila week',
                  '1 case plan-review episode per target week',
                  '1 requested outside-meal review episode / week',
                  'Progress trajectory, weight analytics & adaptive check-ins',
                  'Discretionary goal, preference and shopping updates',
                ].map((feat, idx) => (
                  <div key={feat} className="flex items-start gap-2.5 text-xs text-brand-text">
                    <div
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full mt-0.5 ${
                        idx === 0
                          ? 'bg-transparent text-brand-muted'
                          : 'bg-brand-green/20 text-brand-green dark:bg-brand-accent/25 dark:text-brand-accent'
                      }`}
                    >
                      {idx === 0 ? <Activity className="h-3 w-3" /> : <Check className="h-2.5 w-2.5 stroke-[3px]" />}
                    </div>
                    <span className={idx === 0 ? 'font-bold text-brand-muted' : 'font-medium'}>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-brand-border/50">
              <Button disabled className="w-full py-3 text-xs font-black uppercase tracking-wider rounded-2xl shadow-neon">
                Purchases opening soon
              </Button>
              <p className="mt-2 text-center text-[10px] text-brand-muted">
                Pricing and payment setup are being finalized. No charges occur.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. TACTILE ALLOWANCES DASHBOARD (if enabled === true) */}
      {data?.enabled && (
        <section className="rounded-3xl border border-brand-border/80 bg-brand-surface p-6 sm:p-7 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-brand-text">Your remaining allowances</h2>
              <p className="text-xs text-brand-muted mt-0.5">
                Real-time usage tracked on the server. Weekly quotas reset every Monday at 00:00 (Asia/Manila).
              </p>
            </div>
            <button
              onClick={refresh}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-green hover:underline self-start sm:self-auto"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Refresh allowances</span>
            </button>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {/* Meal Swaps */}
            <div className="rounded-2xl border border-brand-border/70 bg-brand-bgAlt/40 p-4 transition hover:border-brand-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <UtensilsCrossed className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold text-brand-text">Meal swaps</span>
                </div>
                <span className="rounded-md bg-brand-surface border border-brand-border/60 px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase text-brand-muted">
                  Cycle
                </span>
              </div>

              <div className="my-2">
                <span className="font-display text-2xl font-black text-brand-text">{data.swaps.remaining}</span>
                <span className="text-xs text-brand-muted font-bold"> / {data.swaps.cap} remaining</span>
              </div>

              <p className="text-xs text-brand-muted">
                Meal swaps:{' '}
                <strong className="font-extrabold text-brand-text">
                  {data.swaps.remaining} of {data.swaps.cap}
                </strong>{' '}
                for your current cycle
              </p>

              <div className="mt-2.5 h-2 w-full rounded-full bg-brand-border/40 overflow-hidden">
                <div
                  className="h-full bg-brand-green rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, (data.swaps.remaining / data.swaps.cap) * 100))}%` }}
                />
              </div>
              <span className="mt-2 block text-[10px] text-brand-muted">
                Follows active plan cycle; revisions do not reset.
              </span>
            </div>

            {/* AI Outside-Meal Estimates */}
            <div className="rounded-2xl border border-brand-border/70 bg-brand-bgAlt/40 p-4 transition hover:border-brand-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold text-brand-text">AI estimate requests</span>
                </div>
                <span className="rounded-md bg-brand-surface border border-brand-border/60 px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase text-brand-muted">
                  Weekly
                </span>
              </div>

              <div className="my-2">
                <span className="font-display text-2xl font-black text-brand-text">
                  {data.usage.AI_ESTIMATE.remaining}
                </span>
                <span className="text-xs text-brand-muted font-bold">
                  {' '}
                  / {data.usage.AI_ESTIMATE.cap} remaining
                </span>
              </div>

              <p className="text-xs text-brand-muted">
                AI estimate requests:{' '}
                <strong className="font-extrabold text-brand-text">
                  {data.usage.AI_ESTIMATE.remaining} of {data.usage.AI_ESTIMATE.cap}
                </strong>
              </p>

              <div className="mt-2.5 h-2 w-full rounded-full bg-brand-border/40 overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.max(0, (data.usage.AI_ESTIMATE.remaining / data.usage.AI_ESTIMATE.cap) * 100))}%`,
                  }}
                />
              </div>
              <span className="mt-2 block text-[10px] text-brand-muted">
                Manual outside-meal logging remains unlimited.
              </span>
            </div>

            {/* Optional Replans */}
            <div className="rounded-2xl border border-brand-border/70 bg-brand-bgAlt/40 p-4 transition hover:border-brand-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                    <RefreshCw className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold text-brand-text">Optional replans</span>
                </div>
                <span className="rounded-md bg-brand-surface border border-brand-border/60 px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase text-brand-muted">
                  Weekly
                </span>
              </div>

              <div className="my-2">
                <span className="font-display text-2xl font-black text-brand-text">{data.usage.REPLAN.remaining}</span>
                <span className="text-xs text-brand-muted font-bold"> / {data.usage.REPLAN.cap} remaining</span>
              </div>

              <p className="text-xs text-brand-muted">
                Optional replans:{' '}
                <strong className="font-extrabold text-brand-text">
                  {data.usage.REPLAN.remaining} of {data.usage.REPLAN.cap}
                </strong>
              </p>

              <div className="mt-2.5 h-2 w-full rounded-full bg-brand-border/40 overflow-hidden">
                <div
                  className="h-full bg-sky-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.max(0, (data.usage.REPLAN.remaining / data.usage.REPLAN.cap) * 100))}%`,
                  }}
                />
              </div>
              <span className="mt-2 block text-[10px] text-brand-muted">
                Safety repairs do not consume a replan credit.
              </span>
            </div>

            {/* Plan-Review Episodes */}
            <div className="rounded-2xl border border-brand-border/70 bg-brand-bgAlt/40 p-4 transition hover:border-brand-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <Stethoscope className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold text-brand-text">Plan-review episodes</span>
                </div>
                <span className="rounded-md bg-brand-surface border border-brand-border/60 px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase text-brand-muted">
                  Target Week
                </span>
              </div>

              <div className="my-2">
                <span className="font-display text-2xl font-black text-brand-text">
                  {data.usage.PLAN_REVIEW.remaining}
                </span>
                <span className="text-xs text-brand-muted font-bold"> / {data.usage.PLAN_REVIEW.cap} remaining</span>
              </div>

              <p className="text-xs text-brand-muted">
                Plan-review episodes:{' '}
                <strong className="font-extrabold text-brand-text">
                  {data.usage.PLAN_REVIEW.remaining} of {data.usage.PLAN_REVIEW.cap}
                </strong>
              </p>

              <div className="mt-2.5 h-2 w-full rounded-full bg-brand-border/40 overflow-hidden">
                <div
                  className="h-full bg-rose-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.max(0, (data.usage.PLAN_REVIEW.remaining / data.usage.PLAN_REVIEW.cap) * 100))}%`,
                  }}
                />
              </div>
              <span className="mt-2 block text-[10px] text-brand-muted">
                Follows target plan week; case replans require a credit.
              </span>
            </div>

            {/* Outside-Meal Review Episodes */}
            <div className="rounded-2xl border border-brand-border/70 bg-brand-bgAlt/40 p-4 transition hover:border-brand-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                    <ClipboardCheck className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-bold text-brand-text">Outside-meal reviews</span>
                </div>
                <span className="rounded-md bg-brand-surface border border-brand-border/60 px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase text-brand-muted">
                  Weekly
                </span>
              </div>

              <div className="my-2">
                <span className="font-display text-2xl font-black text-brand-text">
                  {data.usage.OUTSIDE_REVIEW.remaining}
                </span>
                <span className="text-xs text-brand-muted font-bold">
                  {' '}
                  / {data.usage.OUTSIDE_REVIEW.cap} remaining
                </span>
              </div>

              <p className="text-xs text-brand-muted">
                Outside-meal review episodes:{' '}
                <strong className="font-extrabold text-brand-text">
                  {data.usage.OUTSIDE_REVIEW.remaining} of {data.usage.OUTSIDE_REVIEW.cap}
                </strong>
              </p>

              <div className="mt-2.5 h-2 w-full rounded-full bg-brand-border/40 overflow-hidden">
                <div
                  className="h-full bg-teal-500 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.max(0, (data.usage.OUTSIDE_REVIEW.remaining / data.usage.OUTSIDE_REVIEW.cap) * 100))}%`,
                  }}
                />
              </div>
              <span className="mt-2 block text-[10px] text-brand-muted">
                Follow-up on submitted reviews does not use a credit.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 rounded-2xl bg-brand-bgAlt/60 border border-brand-border/60 p-3.5 text-xs text-brand-muted">
            <Info className="h-4 w-4 text-brand-green shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Estimate, replan and outside-review allowances reset Monday in Manila: {date(data.resetsAt)}. Swaps follow
              each plan cycle; plan review follows its target week. An optional replan that needs new case review also
              uses a plan-review allowance.
            </p>
          </div>
        </section>
      )}

      {/* 6. TRANSPARENT BENEFIT COMPARISON TABLE */}
      <section className="overflow-hidden rounded-3xl border border-brand-border/80 bg-brand-surface shadow-sm">
        <div className="p-6 sm:p-7 pb-4">
          <h2 className="font-display text-xl font-bold text-brand-text">
            One membership, the same allowances for every subscriber
          </h2>
          <p className="text-xs text-brand-muted mt-1">
            Equal allowances for all members. No algorithmic favor, hidden credit tiers, or locked basic health access.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-y border-brand-border/80 bg-brand-bgAlt/60 text-[11px] uppercase tracking-wider font-extrabold text-brand-muted">
                <th className="p-4 pl-6 sm:pl-7">Benefit</th>
                <th className="p-4">Free</th>
                <th className="p-4 pr-6 sm:pr-7">Membership / trial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/60">
              {comparisonRows.map(([feature, free, member]) => (
                <tr key={feature} className="transition-colors hover:bg-brand-bgAlt/30">
                  <th className="p-4 pl-6 sm:pl-7 font-semibold text-brand-text">{feature}</th>
                  <td className="p-4 text-brand-muted">{free}</td>
                  <td className="p-4 pr-6 sm:pr-7 font-bold text-brand-green dark:text-brand-accent">{member}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 7. CLINICAL SAFETY & HEALTH CORRECTIONS CALLOUT */}
      <section className="rounded-3xl border border-brand-border/70 bg-gradient-to-br from-brand-surface to-rose-500/[0.03] p-6 sm:p-7 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-rose-500/15 text-rose-500">
            <Heart className="h-4 w-4" />
          </div>
          <h3 className="font-display text-sm font-bold text-brand-text">
            Health Corrections & Clinical Safety Are Always Free
          </h3>
        </div>
        <p className="text-xs leading-relaxed text-brand-muted max-w-3xl">
          Health corrections, safety checks, manual meal logging, groceries and access to existing records remain
          available. Review can approve, request changes or decline; membership does not guarantee verification or
          continuous monitoring. Corrections needed to finish an existing review do not spend another allowance. Saved
          estimates remain estimates unless reviewed.
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

      {/* 8. FREQUENTLY ASKED QUESTIONS */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-bold text-brand-text">Frequently Asked Questions</h2>
          <p className="text-xs text-brand-muted mt-0.5">
            Key details regarding trial rules, Manila reset timings, health safety updates, and clinical scope.
          </p>
        </div>

        <div className="space-y-2.5">
          <FAQItem
            question="How does the 14-day trial work?"
            answer="Every account receives one durable 14-day trial. The trial countdown begins once your first cleared, current usable meal plan becomes available (starter kickoff plans count toward the trial). Waiting for clinical review or future scheduled cycles does not consume trial days. Moving from a starter plan to a weekly cycle does not restart the trial."
          />
          <FAQItem
            question="When do weekly allowances reset?"
            answer="AI outside-meal estimates, optional replans, and requested outside-meal review episodes reset every Monday at 00:00 Philippine Time (Asia/Manila). Meal swaps follow each plan cycle rather than the calendar week, and revisions to an active cycle do not reset the swap allowance."
          />
          <FAQItem
            question="Can I still update my health information if my trial ends?"
            answer="Yes, absolutely. Correcting body measurements (such as age, height, and current weight), declaring new allergies or conditions, and completing required safety revalidations are always free and never locked. Only discretionary preference changes (such as goal, activity level, or shopping days) require membership after your trial."
          />
          <FAQItem
            question="What happens if I have health conditions or allergies?"
            answer="Users with declared conditions, allergies, or custom safety restrictions require clinical case review for new weekly plans. After trial expiry, existing eligible active meals and follow-up on submitted reviews remain accessible, while generating new weekly case plans requires membership."
          />
          <FAQItem
            question="Does membership mean unlimited usage?"
            answer="No. Membership provides generous, bounded weekly allowances to guarantee clinical review quality and server reliability. All subscribers share the same published allowances."
          />
        </div>
      </section>
    </div>
  );
}

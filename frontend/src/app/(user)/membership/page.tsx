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
    <div className="border-b border-brand-border/60 last:border-b-0 py-3.5">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-3 text-left font-display text-sm font-bold text-brand-text transition hover:text-brand-green"
        aria-expanded={isOpen}
      >
        <span>{question}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-brand-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <p className="mt-2.5 text-xs leading-relaxed text-brand-muted animate-in fade-in duration-150">
          {answer}
        </p>
      )}
    </div>
  );
}

export default function MembershipPage() {
  const { data, isLoading, error, refresh } = useMembership();

  if (isLoading && !data)
    return (
      <div className="portal-page max-w-5xl mx-auto py-12 text-center" role="status">
        <div className="inline-flex items-center gap-2 text-sm text-brand-muted">
          <RefreshCw className="h-4 w-4 animate-spin text-brand-green" />
          <span>Loading membership…</span>
        </div>
      </div>
    );

  if (error && !data)
    return (
      <div className="portal-page max-w-5xl mx-auto space-y-4 py-8">
        <div className="rounded-2xl border border-status-error-text/30 bg-status-error-bg/20 p-5 text-status-error-text">
          <p role="alert" className="text-sm font-semibold">{error}</p>
          <Button onClick={refresh} variant="secondary" className="mt-4 text-xs">
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

  const limits = data?.enabled ? data.limits : fallbackLimits;

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
    <div className="portal-page mx-auto max-w-5xl space-y-6 pb-28">
      {/* HEADER */}
      <PortalPageHeader
        icon={Sparkles}
        eyebrow="Account & Access"
        title="KAINARA membership"
        description="Keep your weekly meals practical. Membership adds adaptation, progress insights and professional review when required."
      />

      {/* ROLLOUT BANNER (if enabled === false) */}
      {!data?.enabled && (
        <section className="rounded-2xl border border-brand-green/30 bg-brand-green/[0.05] p-5 shadow-xs">
          <div className="flex items-start gap-3.5">
            <Info className="h-5 w-5 text-brand-green shrink-0 mt-0.5" />
            <div>
              <h2 className="font-display text-base font-bold text-brand-text">
                Membership is being prepared. Your current access has not changed.
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-brand-muted">
                All platform features, meal generation, and safety checks remain active for your account while
                membership tiers and payment systems are readied for launch. Explore the allowances and features below.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ACCOUNT STATUS HERO CARD (if enabled === true) */}
      {data?.enabled && (
        <section className="rounded-3xl border border-brand-border/80 bg-brand-surface p-6 shadow-sm relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
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
              </div>
              <h2 className="mt-2 font-display text-xl sm:text-2xl font-bold text-brand-text">
                {labels[data.level]}
              </h2>
              <p className="mt-1 text-xs text-brand-muted max-w-2xl leading-relaxed">
                {data.level === 'TRIAL_PENDING'
                  ? 'Your trial starts when your first cleared current plan is available. A starter plan counts; waiting for review does not.'
                  : data.level === 'MEMBER' && data.paidUntil
                    ? `Membership available until ${date(data.paidUntil)}. No automatic renewal.`
                    : data.trialEndsAt
                      ? `Trial ${data.level === 'FREE' ? 'ended' : 'ends'} ${date(data.trialEndsAt)}. Moving to a full weekly plan does not restart it.`
                      : 'Standard free access. General weekly plans, saved records, and safety updates continue.'}
              </p>
            </div>

            <div className="flex flex-col sm:items-end gap-1 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-brand-border/60">
              <span className="text-[10px] uppercase font-bold tracking-wider text-brand-muted">
                Weekly Manila Reset
              </span>
              <span className="text-xs font-extrabold text-brand-text flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-brand-green" />
                {date(data.resetsAt)}
              </span>
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

      {/* REMAINING ALLOWANCES SECTION (if enabled === true) */}
      {data?.enabled && (
        <section className="rounded-3xl border border-brand-border/80 bg-brand-surface p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="font-display text-lg font-bold text-brand-text">Your remaining allowances</h2>
              <p className="text-xs text-brand-muted">
                Server-tracked allowances for your current cycle and weekly Manila reset window.
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

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Meal Swaps Card */}
            <div className="rounded-2xl border border-brand-border/70 bg-brand-bgAlt/40 p-4 transition-all hover:border-brand-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-brand-text">Meal swaps</span>
                <span className="rounded-md bg-brand-surface border border-brand-border/60 px-2 py-0.5 font-mono text-[10px] font-bold text-brand-muted">
                  Cycle
                </span>
              </div>
              <p className="text-xs text-brand-muted">
                Meal swaps:{' '}
                <strong className="font-extrabold text-brand-text">
                  {data.swaps.remaining} of {data.swaps.cap}
                </strong>{' '}
                for your current cycle
              </p>
              <div className="mt-2.5 h-1.5 w-full rounded-full bg-brand-border/40 overflow-hidden">
                <div
                  className="h-full bg-brand-green rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, (data.swaps.remaining / data.swaps.cap) * 100))}%` }}
                />
              </div>
              <span className="mt-2 block text-[10px] text-brand-muted">
                Follows active plan cycle; revisions do not reset.
              </span>
            </div>

            {/* AI Outside-Meal Estimates Card */}
            <div className="rounded-2xl border border-brand-border/70 bg-brand-bgAlt/40 p-4 transition-all hover:border-brand-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-brand-text">AI estimate requests</span>
                <span className="rounded-md bg-brand-surface border border-brand-border/60 px-2 py-0.5 font-mono text-[10px] font-bold text-brand-muted">
                  Weekly
                </span>
              </div>
              <p className="text-xs text-brand-muted">
                AI estimate requests:{' '}
                <strong className="font-extrabold text-brand-text">
                  {data.usage.AI_ESTIMATE.remaining} of {data.usage.AI_ESTIMATE.cap}
                </strong>
              </p>
              <div className="mt-2.5 h-1.5 w-full rounded-full bg-brand-border/40 overflow-hidden">
                <div
                  className="h-full bg-brand-green rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.max(0, (data.usage.AI_ESTIMATE.remaining / data.usage.AI_ESTIMATE.cap) * 100))}%`,
                  }}
                />
              </div>
              <span className="mt-2 block text-[10px] text-brand-muted">
                Manual outside-meal logging remains unlimited.
              </span>
            </div>

            {/* Optional Replans Card */}
            <div className="rounded-2xl border border-brand-border/70 bg-brand-bgAlt/40 p-4 transition-all hover:border-brand-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-brand-text">Optional replans</span>
                <span className="rounded-md bg-brand-surface border border-brand-border/60 px-2 py-0.5 font-mono text-[10px] font-bold text-brand-muted">
                  Weekly
                </span>
              </div>
              <p className="text-xs text-brand-muted">
                Optional replans:{' '}
                <strong className="font-extrabold text-brand-text">
                  {data.usage.REPLAN.remaining} of {data.usage.REPLAN.cap}
                </strong>
              </p>
              <div className="mt-2.5 h-1.5 w-full rounded-full bg-brand-border/40 overflow-hidden">
                <div
                  className="h-full bg-brand-green rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.max(0, (data.usage.REPLAN.remaining / data.usage.REPLAN.cap) * 100))}%`,
                  }}
                />
              </div>
              <span className="mt-2 block text-[10px] text-brand-muted">
                Safety repairs do not consume a replan credit.
              </span>
            </div>

            {/* Plan-Review Episodes Card */}
            <div className="rounded-2xl border border-brand-border/70 bg-brand-bgAlt/40 p-4 transition-all hover:border-brand-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-brand-text">Plan-review episodes</span>
                <span className="rounded-md bg-brand-surface border border-brand-border/60 px-2 py-0.5 font-mono text-[10px] font-bold text-brand-muted">
                  Per Target Week
                </span>
              </div>
              <p className="text-xs text-brand-muted">
                Plan-review episodes:{' '}
                <strong className="font-extrabold text-brand-text">
                  {data.usage.PLAN_REVIEW.remaining} of {data.usage.PLAN_REVIEW.cap}
                </strong>
              </p>
              <div className="mt-2.5 h-1.5 w-full rounded-full bg-brand-border/40 overflow-hidden">
                <div
                  className="h-full bg-brand-green rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.max(0, (data.usage.PLAN_REVIEW.remaining / data.usage.PLAN_REVIEW.cap) * 100))}%`,
                  }}
                />
              </div>
              <span className="mt-2 block text-[10px] text-brand-muted">
                Follows target plan week; case replans require a credit.
              </span>
            </div>

            {/* Outside-Meal Review Episodes Card */}
            <div className="rounded-2xl border border-brand-border/70 bg-brand-bgAlt/40 p-4 transition-all hover:border-brand-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-brand-text">Outside-meal review episodes</span>
                <span className="rounded-md bg-brand-surface border border-brand-border/60 px-2 py-0.5 font-mono text-[10px] font-bold text-brand-muted">
                  Weekly
                </span>
              </div>
              <p className="text-xs text-brand-muted">
                Outside-meal review episodes:{' '}
                <strong className="font-extrabold text-brand-text">
                  {data.usage.OUTSIDE_REVIEW.remaining} of {data.usage.OUTSIDE_REVIEW.cap}
                </strong>
              </p>
              <div className="mt-2.5 h-1.5 w-full rounded-full bg-brand-border/40 overflow-hidden">
                <div
                  className="h-full bg-brand-green rounded-full transition-all duration-300"
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

          <p className="mt-4 text-xs leading-relaxed text-brand-muted border-t border-brand-border/60 pt-3">
            Estimate, replan and outside-review allowances reset Monday in Manila: {date(data.resetsAt)}. Swaps follow
            each plan cycle; plan review follows its target week. An optional replan that needs new case review also uses
            a plan-review allowance.
          </p>
        </section>
      )}

      {/* BENEFIT COMPARISON TABLE */}
      <section className="overflow-hidden rounded-3xl border border-brand-border/80 bg-brand-surface shadow-sm">
        <div className="p-6 pb-4">
          <h2 className="font-display text-lg font-bold text-brand-text">
            One membership, the same allowances for every subscriber
          </h2>
          <p className="text-xs text-brand-muted mt-0.5">
            Transparent, published allowances across all tiers. No hidden charges or automatic renewals.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-y border-brand-border/80 bg-brand-bgAlt/50 text-[11px] uppercase tracking-wider font-extrabold text-brand-muted">
                <th className="p-4 pl-6">Benefit</th>
                <th className="p-4">Free</th>
                <th className="p-4 pr-6">Membership / trial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/60">
              {comparisonRows.map(([feature, free, member]) => (
                <tr key={feature} className="transition-colors hover:bg-brand-bgAlt/30">
                  <th className="p-4 pl-6 font-semibold text-brand-text">{feature}</th>
                  <td className="p-4 text-brand-muted">{free}</td>
                  <td className="p-4 pr-6 font-bold text-brand-green dark:text-brand-accent">{member}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* PURCHASES UNAVAILABLE CARD */}
      <section className="rounded-3xl border border-brand-border/80 bg-brand-surface p-6 shadow-sm">
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
          <Button disabled className="shrink-0 text-xs font-bold px-6 py-2.5">
            Purchases opening soon
          </Button>
        </div>
      </section>

      {/* HEALTH CORRECTIONS & CLINICAL SAFETY CALLOUT */}
      <section className="rounded-3xl border border-brand-border/70 bg-brand-surface/60 p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-rose-500" />
          <h3 className="font-display text-sm font-bold text-brand-text">
            Health Corrections & Clinical Safety Are Always Free
          </h3>
        </div>
        <p className="text-xs leading-relaxed text-brand-muted">
          Health corrections, safety checks, manual meal logging, groceries and access to existing records remain
          available. Review can approve, request changes or decline; membership does not guarantee verification or
          continuous monitoring. Corrections needed to finish an existing review do not spend another allowance. Saved
          estimates remain estimates unless reviewed.
        </p>
        <div>
          <Link
            href="/profile/health"
            className="inline-flex items-center gap-1 text-xs font-bold text-brand-green hover:underline"
          >
            <span>Update health information</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {/* FREQUENTLY ASKED QUESTIONS */}
      <section className="rounded-3xl border border-brand-border/80 bg-brand-surface p-6 shadow-sm">
        <h2 className="font-display text-lg font-bold text-brand-text mb-2">Frequently Asked Questions</h2>
        <p className="text-xs text-brand-muted mb-4">
          Key details regarding trial activation, Manila resets, and clinical case review rules.
        </p>

        <div className="divide-y divide-brand-border/60">
          <FAQItem
            question="How does the 14-day trial work?"
            answer="Every account receives one 14-day trial. The trial countdown starts once your first cleared, current usable meal plan becomes available (starter kickoff plans count toward the trial). Waiting for clinical review or future scheduled cycles does not consume trial days. Moving from a starter plan to a weekly cycle does not restart the trial."
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

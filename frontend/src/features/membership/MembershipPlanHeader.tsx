'use client';

import { CheckCircle2, Clock, Layers, RefreshCw, Sparkles } from 'lucide-react';
import Button from '@/components/ui/Button';
import type { MembershipView } from './MembershipProvider';

interface MembershipPlanHeaderProps {
  data: Extract<MembershipView, { enabled: true }>;
  onOpenPlans: () => void;
  onRefresh: () => void;
}

export const formatMembershipDate = (value: string) =>
  new Date(value).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export const formatMembershipDateTime = (value: string) =>
  new Date(value).toLocaleString('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

export default function MembershipPlanHeader({
  data,
  onOpenPlans,
  onRefresh,
}: MembershipPlanHeaderProps) {
  const planTitles = {
    FREE: 'Free Plan',
    TRIAL_PENDING: 'Health Trial (Pending Kickoff)',
    TRIAL: 'Health Trial',
    MEMBER: data.tier === 'LIFESTYLE' ? 'Lifestyle Plan' : 'Health Plan',
  };

  const badgeLabels = {
    FREE: 'Free tier',
    TRIAL_PENDING: 'Pending kickoff',
    TRIAL: 'Health trial active',
    MEMBER: 'Active subscriber',
  };

  const currentTitle = planTitles[data.level];
  const badgeLabel = badgeLabels[data.level];

  // Scheduled / next plan info
  const scheduledPlan = data.transitions?.scheduled?.[0] ?? data.scheduledMemberships?.[0];

  return (
    <section
      aria-label="Current membership overview"
      className="rounded-2xl border border-brand-border bg-brand-surface p-5 sm:p-6 shadow-xs relative overflow-hidden"
    >
      {/* Background ambient accent */}
      <div className="absolute top-0 right-0 -mt-10 -mr-10 h-44 w-44 rounded-full bg-brand-green/5 blur-2xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        {/* Left side: Current plan identity and details */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-brand-text">
              {currentTitle}
            </h1>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                data.level === 'FREE'
                  ? 'bg-brand-bgAlt border border-brand-border text-brand-muted'
                  : data.level === 'TRIAL_PENDING'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                    : 'bg-brand-green/10 text-brand-green border border-brand-green/20'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{badgeLabel}</span>
            </span>
          </div>

          {/* Plan validity description */}
          <p className="text-xs sm:text-sm text-brand-muted max-w-2xl leading-relaxed">
            {data.level === 'TRIAL_PENDING'
              ? 'Your Health trial starts when your first cleared current plan is available. A starter plan counts; waiting for review does not.'
              : data.level === 'MEMBER' && data.paidUntil
                ? `Membership active until ${formatMembershipDateTime(data.paidUntil)}.${
                    data.tier === 'HEALTH' && data.healthUntil
                      ? ` Health benefits valid until ${formatMembershipDateTime(data.healthUntil)}.`
                      : ''
                  } No automatic renewal.`
                : data.trialEndsAt
                  ? `Health trial ${data.level === 'FREE' ? 'ended' : 'ends'} ${formatMembershipDateTime(
                      data.trialEndsAt
                    )}. Moving to a full weekly plan does not restart it.`
                  : 'Get more weekly flexibility and consultation access by upgrading your plan.'}
          </p>

          {/* Next scheduled plan notification (if any) */}
          {scheduledPlan && (
            <div className="inline-flex items-center gap-2 rounded-xl bg-brand-bgAlt/70 border border-brand-border/80 px-3 py-1.5 text-xs font-medium text-brand-text">
              <Sparkles className="h-3.5 w-3.5 text-brand-accent shrink-0" />
              <span>
                <strong>Next: </strong>
                {scheduledPlan.tier === 'HEALTH' ? 'Health' : 'Lifestyle'}{' '}
                {'period' in scheduledPlan && typeof (scheduledPlan as { period?: string }).period === 'string'
                  ? (scheduledPlan as { period: string }).period.toLowerCase()
                  : 'monthly'}{' '}
                — starts {formatMembershipDate(scheduledPlan.effectiveFrom)} (Already paid).
              </span>
            </div>
          )}
        </div>

        {/* Right side: Manila Reset pill + View plans CTA */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 self-start md:self-center shrink-0">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-bgAlt border border-brand-border/70 px-3 py-1 font-mono text-[11px] text-brand-muted">
            <Clock className="h-3.5 w-3.5 text-brand-green" />
            <span>Next Manila reset: {formatMembershipDate(data.resetsAt)}</span>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            aria-label="Refresh membership status"
            title="Refresh membership status"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-brand-border bg-brand-bgAlt text-brand-muted hover:text-brand-text hover:bg-brand-surface transition-colors shadow-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          <Button
            onClick={onOpenPlans}
            variant="primary"
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 shadow-xs"
          >
            <Layers className="h-4 w-4" />
            <span>View plans</span>
          </Button>
        </div>
      </div>
    </section>
  );
}

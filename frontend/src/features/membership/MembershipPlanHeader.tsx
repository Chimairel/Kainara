'use client';

import { CheckCircle2, Clock, Layers, RefreshCw, Sparkles } from 'lucide-react';
import Button from '@/components/ui/Button';
import { KainaraLogo } from '@/components/shared/KainaraLogo';
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

export default function MembershipPlanHeader({ data, onOpenPlans, onRefresh }: MembershipPlanHeaderProps) {
  const planTitles = {
    FREE: 'Free Plan',
    TRIAL_PENDING: 'Health',
    TRIAL: 'Health',
    MEMBER: data.tier === 'LIFESTYLE' ? 'Lifestyle Plan' : 'Health Plan',
  };

  const badgeLabels = {
    FREE: 'Free tier',
    TRIAL_PENDING: 'Pending kickoff',
    TRIAL: 'Health active',
    MEMBER: 'Active subscriber',
  };

  const currentTitle = planTitles[data.level];
  const badgeLabel = badgeLabels[data.level];

  // Scheduled / next plan info
  const scheduledPlan = data.transitions?.scheduled?.[0] ?? data.scheduledMemberships?.[0];

  return (
    <section
      aria-label="Current membership overview"
      className="relative overflow-hidden rounded-[28px] sm:rounded-[36px] border border-[#dce4e0] dark:border-[#173e33] bg-[#faf8f5] dark:bg-[#071914] text-[#0d2820] dark:text-white shadow-xl p-6 sm:p-9"
    >
      {/* 1. Retro Wave Organic Corner Accent (3-Tone Signature Curved Stripes from Landing Page) */}
      <div className="pointer-events-none absolute -top-0.5 -right-0.5 h-36 w-36 sm:h-48 sm:w-48 overflow-hidden rounded-tr-[28px] sm:rounded-tr-[36px] z-0 opacity-85">
        <svg viewBox="0 0 160 160" className="h-full w-full" fill="none">
          <path d="M160,0 L0,0 C20,40 55,95 120,135 C140,147 160,155 160,155 Z" fill="#eb6a38" />
          <path d="M160,0 L40,0 C55,30 80,72 130,105 C145,115 160,120 160,120 Z" fill="#f09e6c" />
          <path
            d="M160,0 L82,0 C92,20 110,48 142,70 C152,76 160,80 160,80 Z"
            className="fill-[#1b4e41] dark:fill-[#164639]"
          />
        </svg>
      </div>

      {/* 2. Soft Ambient Radial Glow (from Landing Page) */}
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-72 w-72 rounded-full bg-brand-green/10 blur-[100px] z-0" />

      {/* 3. Subtle Watermarked Kainara Logo Seal (from Landing Page) */}
      <div className="pointer-events-none absolute -bottom-6 -right-6 hidden sm:flex items-center justify-center opacity-10 dark:opacity-15 z-0">
        <KainaraLogo size={130} variant="multicolor" />
      </div>

      {/* Main Content inside Card */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
        {/* Left side: Current plan identity and details */}
        <div className="space-y-2.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-2xl sm:text-3xl font-black tracking-[-0.03em] text-[#0d2820] dark:text-white">
              {currentTitle}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                data.level === 'FREE'
                  ? 'bg-neutral-200/70 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                  : data.level === 'TRIAL_PENDING'
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                    : 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-brand-green" />
              <span>{badgeLabel}</span>
            </span>
          </div>

          {/* Plan validity description */}
          <p className="text-xs sm:text-sm leading-relaxed text-[#5a746a] dark:text-white/70">
            {data.level === 'TRIAL_PENDING'
              ? 'Your 14-day Health plan starts when your first cleared current plan is available. A starter plan counts; waiting for review does not.'
              : data.level === 'MEMBER' && data.paidUntil
                ? `Membership active until ${formatMembershipDateTime(data.paidUntil)}.${
                    data.tier === 'HEALTH' && data.healthUntil
                      ? ` Health benefits valid until ${formatMembershipDateTime(data.healthUntil)}.`
                      : ''
                  } No automatic renewal.`
                : data.trialEndsAt
                  ? `Health plan ${data.level === 'FREE' ? 'ended' : 'ends'} ${formatMembershipDateTime(
                      data.trialEndsAt
                    )}. Moving to a full weekly plan does not restart this period.`
                  : 'Get more weekly flexibility and consultation access by upgrading your plan.'}
          </p>

          {/* Next scheduled plan notification (if any) */}
          {scheduledPlan && (
            <div className="inline-flex items-center gap-2 rounded-2xl bg-white/80 dark:bg-[#0c241d]/80 border border-[#dce4e0] dark:border-[#173e33] px-3.5 py-2 text-xs font-medium text-[#0d2820] dark:text-emerald-100 shadow-xs backdrop-blur-sm">
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
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 self-start md:self-center shrink-0">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/80 dark:bg-[#0a201a] border border-[#dce4e0] dark:border-[#173e33] px-3.5 py-1.5 font-mono text-[11px] text-[#5a746a] dark:text-emerald-200/80 shadow-xs">
            <Clock className="h-3.5 w-3.5 text-brand-green" />
            <span>Next Manila reset: {formatMembershipDate(data.resetsAt)}</span>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            aria-label="Refresh membership status"
            title="Refresh membership status"
            className="flex h-9 w-9 items-center justify-center rounded-2xl border border-[#dce4e0] dark:border-[#173e33] bg-white/80 dark:bg-[#0a201a] text-[#5a746a] dark:text-white/80 hover:text-brand-text hover:bg-white dark:hover:bg-[#0e271f] transition-all shadow-xs"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          <Button
            onClick={onOpenPlans}
            variant="primary"
            className="inline-flex items-center gap-2 rounded-2xl bg-brand-accent hover:brightness-110 text-white text-xs font-extrabold px-5 py-2.5 shadow-lg active:scale-[0.98] transition-all"
          >
            <Layers className="h-4 w-4" />
            <span>View plans</span>
          </Button>
        </div>
      </div>
    </section>
  );
}

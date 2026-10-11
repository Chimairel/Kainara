'use client';

import CardDecoration from '@/components/ui/CardDecoration';
import HeaderRefreshAction from '@/components/shared/HeaderRefreshAction';
import Button from '@/components/ui/Button';
import type { MembershipView } from './MembershipProvider';

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
}: {
  data: Extract<MembershipView, { enabled: true }>;
  onOpenPlans: () => void;
  onRefresh: () => void;
}) {
  const title = data.level === 'FREE' ? 'Free' : data.tier === 'LIFESTYLE' ? 'Lifestyle' : 'Health';
  const pending = data.level === 'TRIAL_PENDING';
  const until =
    data.level === 'MEMBER'
      ? (data.transitions?.current?.effectiveUntil ?? (title === 'Health' ? data.healthUntil : null) ?? data.paidUntil)
      : data.level === 'TRIAL'
        ? data.trialEndsAt
        : null;
  const scheduled = data.transitions?.scheduled?.[0] ?? data.scheduledMemberships?.[0];

  return (
    <section
      aria-label="Current membership overview"
      className="relative overflow-hidden rounded-3xl border border-brand-border bg-brand-surface p-6 sm:p-8"
    >
      <CardDecoration variant="membership" />
      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-display text-3xl font-bold text-brand-text">{title}</h2>
            <HeaderRefreshAction label="Refresh membership status" onRefresh={onRefresh} />
            {pending && <span className="text-sm font-medium text-brand-muted">Not started</span>}
          </div>
          <p className="mt-2 text-sm text-brand-muted">
            {pending
              ? 'Your 30 days start when your meals are ready.'
              : until
                ? `Ends ${formatMembershipDateTime(until)}`
                : 'No expiry'}
          </p>
          {scheduled && (
            <p className="mt-2 text-sm text-brand-muted">
              Next: {scheduled.tier === 'HEALTH' ? 'Health' : 'Lifestyle'} ·{' '}
              {formatMembershipDate(scheduled.effectiveFrom)} · Paid
            </p>
          )}
        </div>
        <Button onClick={onOpenPlans} size="sm">
          View plans
        </Button>
      </div>
    </section>
  );
}

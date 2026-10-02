'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/axios';
import { isCheckoutUrl } from './checkout';
import { useMembership } from './MembershipProvider';
import Button from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';

export const membershipDate = (value: string) =>
  new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' });
export const membershipMoney = (centavos: number) =>
  (centavos / 100).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' });

export default function MembershipTimeline() {
  const { data, refresh } = useMembership();
  const { user } = useAuth();
  const active = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setBusy(false);
    setError(null);
    return () => active.current?.abort();
  }, [user?.userId]);
  if (!data?.enabled) return null;
  const timeline = data.transitions;
  const open = timeline?.openCheckout;
  const quoteExpired = Boolean(open?.quoteExpiresAt && new Date(open.quoteExpiresAt) <= new Date());
  const close = async () => {
    if (!open || busy) return;
    setBusy(true);
    setError(null);
    const controller = new AbortController();
    active.current = controller;
    try {
      await api.post(
        `/user/membership/checkout/${encodeURIComponent(open.id)}/close`,
        {},
        { signal: controller.signal }
      );
      if (!controller.signal.aborted) refresh();
    } catch (err) {
      if (!controller.signal.aborted)
        setError(
          (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
            'Checkout could not be closed. Try again.'
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  return (
    <section
      aria-label="Current and next membership"
      className="mb-4 space-y-3 rounded-2xl border border-brand-border bg-brand-surface p-4 text-sm"
    >
      <p>
        <strong>Current: </strong>
        {data.level === 'TRIAL'
          ? `Health — ends ${membershipDate(data.trialEndsAt!)}`
          : data.level === 'TRIAL_PENDING'
            ? 'Health waiting for your first usable plan'
            : timeline?.current
              ? `${timeline.current.tier === 'HEALTH' ? 'Health' : 'Lifestyle'} ${timeline.current.period.toLowerCase()} — ends ${membershipDate(timeline.current.effectiveUntil)}`
              : data.tier === 'FREE'
                ? 'Free'
                : `${data.tier === 'HEALTH' ? 'Health' : 'Lifestyle'} membership`}
      </p>
      {timeline?.scheduled.map((plan) => (
        <p key={plan.id}>
          <strong>Next: </strong>
          {plan.tier === 'HEALTH' ? 'Health' : 'Lifestyle'} {plan.period.toLowerCase()} —{' '}
          {membershipDate(plan.effectiveFrom)} to {membershipDate(plan.effectiveUntil)} Philippine time. Already paid.
        </p>
      ))}
      {timeline?.scheduled.length ? (
        <p className="text-xs text-brand-muted">
          Your current benefits remain available until the next plan starts. Another overlapping purchase is
          unavailable.
        </p>
      ) : null}
      {timeline && timeline.creditBalanceCentavos > 0 && (
        <p>
          Available membership credit: <strong>{membershipMoney(timeline.creditBalanceCentavos)}</strong>. Credit
          applies to a later purchase and is not a cash refund.
        </p>
      )}
      {timeline?.blockedReason && (
        <p role="status" className="text-xs text-status-pending-text">
          {timeline.blockedReason}{' '}
          {timeline.blockedReason.includes('reconciliation') && (
            <a className="underline" href="mailto:chimairelp@gmail.com">
              Contact support
            </a>
          )}
        </p>
      )}
      {open && (
        <div className="space-y-2">
          {quoteExpired && (
            <p className="text-status-pending-text">
              The payment summary expired. Close the unpaid checkout and review a fresh summary before paying.
            </p>
          )}
          <p>
            A {open.tier === 'HEALTH' ? 'Health' : 'Lifestyle'} checkout is still open. Finish or close it before
            another purchase.
          </p>
          <div className="flex flex-wrap gap-3">
            {!quoteExpired && open.checkoutUrl && isCheckoutUrl(open.checkoutUrl) && (
              <a href={open.checkoutUrl} className="font-bold text-brand-green underline">
                Resume checkout
              </a>
            )}
            <Button variant="secondary" onClick={close} isLoading={busy}>
              Close unpaid checkout
            </Button>
            <Link href={`/membership/checkout?purchase=${encodeURIComponent(open.id)}`} className="underline">
              Check payment status
            </Link>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-status-error-text">
          {error}
        </p>
      )}
      <p className="text-xs text-brand-muted">
        Dates use Philippine time. No automatic renewal. Changing plans does not reset weekly allowances.
      </p>
    </section>
  );
}

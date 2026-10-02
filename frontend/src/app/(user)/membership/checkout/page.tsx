'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/axios';
import { useAuth } from '@/hooks/useAuth';
import { useMembership } from '@/features/membership/MembershipProvider';
import { isCheckoutUrl, type MembershipCheckout } from '@/features/membership/checkout';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { getApiErrorMessage } from '@/lib/api-error';

function CheckoutResult() {
  const params = useSearchParams();
  const id = params.get('purchase');
  const cancelled = params.get('cancelled') === '1';
  const { user } = useAuth();
  const { refresh } = useMembership();
  const [receipt, setReceipt] = useState<{ ownerId: string; purchaseId: string; data: MembershipCheckout } | null>(
    null
  );
  const data = receipt?.ownerId === user?.userId && receipt?.purchaseId === id ? receipt.data : null;
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!user || !id) return;
    setError(null);
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout>;
    let tries = 0;
    let notified = false;
    const check = async () => {
      try {
        const response = await api.get<{ data: MembershipCheckout }>(
          `/user/membership/checkout/${encodeURIComponent(id)}`,
          { signal: controller.signal }
        );
        if (controller.signal.aborted) return;
        const result = response.data.data;
        setReceipt({ ownerId: user.userId, purchaseId: id, data: result });
        setError(null);
        if (result.status === 'PAID' && !notified) {
          notified = true;
          refresh();
          window.dispatchEvent(new Event('kainara:membership-updated'));
        } else if (!cancelled && (result.status === 'CREATING' || result.status === 'OPEN') && ++tries < 12) {
          timeout = setTimeout(() => {
            void check();
          }, 5000);
        }
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(getApiErrorMessage(failure, 'Payment status could not be checked. Please retry.'));
      }
    };
    void check();
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
    // refresh is supplied as an inline callback; user identity and purchase identify this bounded poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId, id, cancelled, attempt]);
  const date = (value: string) => new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila' });
  return (
    <div className="portal-page mx-auto max-w-2xl py-8">
      <Card>
        <p className="mb-2 text-xs font-bold text-brand-green">Kainara membership</p>
        <h1 className="font-display text-2xl font-bold">
          {data?.status === 'PAID' ? 'Payment successful' : cancelled ? 'Checkout closed' : 'Checking your payment'}
        </h1>
        <p className="mt-3 text-sm text-brand-muted">
          Test mode · No real money was charged. This purchase does not renew automatically.
        </p>
        {!id && (
          <p role="alert" className="mt-3">
            No checkout reference was supplied.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-status-error-text">
            {error}
          </p>
        )}
        {data?.status === 'PAID' ? (
          <div className="mt-4 space-y-2 text-sm">
            <p>
              {data.tier === 'HEALTH' ? 'Health' : 'Lifestyle'}: ₱{(data.amountCentavos / 100).toLocaleString('en-PH')}{' '}
              paid in test mode.
            </p>
            {data.effectiveFrom && data.effectiveUntil && (
              <p>
                Membership period: {date(data.effectiveFrom)} – {date(data.effectiveUntil)} Philippine time. Any
                remaining trial and existing applicable paid period are preserved.
              </p>
            )}
          </div>
        ) : (
          data && (
            <p className="mt-4 text-sm">
              {data.status === 'FAILED'
                ? 'This checkout could not be created. Choose your plan again to retry.'
                : 'Payment has not been verified yet. Closing checkout does not confirm a payment or change your membership.'}
            </p>
          )
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          {id && data?.status !== 'PAID' && (
            <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
              Check again
            </Button>
          )}
          {data?.status === 'OPEN' && data.checkoutUrl && isCheckoutUrl(data.checkoutUrl) && (
            <a
              className="inline-flex items-center rounded-xl bg-brand-accent px-4 py-2 text-sm font-bold text-white"
              href={data.checkoutUrl}
            >
              Return to checkout
            </a>
          )}
          <Link className="inline-flex items-center text-sm font-bold text-brand-green" href="/membership">
            Continue to membership
          </Link>
        </div>
      </Card>
    </div>
  );
}
export default function MembershipCheckoutPage() {
  return (
    <Suspense fallback={<p role="status">Checking payment…</p>}>
      <CheckoutResult />
    </Suspense>
  );
}

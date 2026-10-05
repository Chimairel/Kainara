'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import { getPostAuthDestination } from '@/lib/post-auth-destination';
import { useMembership } from './MembershipProvider';
import {
  checkoutSelectionKey,
  isCheckoutUrl,
  type MembershipCheckout,
  type MembershipPeriod,
  type PaidMembershipTier,
  type CheckoutQuote,
} from './checkout';

export function useMembershipCheckout() {
  const { user } = useAuth();
  const router = useRouter();
  const membership = useMembership();
  const [quote, setQuote] = useState<CheckoutQuote | null>(null);
  const busy = useRef(false);
  const keys = useRef(new Map<string, string>());
  const activeRequest = useRef<AbortController | null>(null);
  const [pendingTier, setPendingTier] = useState<PaidMembershipTier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const professional = Boolean(user && user.role !== 'USER');
  useEffect(() => {
    keys.current.clear();
    setError(null);
    setQuote(null);
    return () => activeRequest.current?.abort();
  }, [user?.userId]);

  const start = async (tier: PaidMembershipTier, period: MembershipPeriod) => {
    if (busy.current) return;
    setError(null);
    if (professional) {
      setError('Membership plans are for personal accounts.');
      return;
    }
    if (!user || !user.emailVerified || !user.onboardingDone || !user.tosAccepted || !user.reportAcknowledged) {
      try {
        sessionStorage.setItem(checkoutSelectionKey, JSON.stringify({ tier, period, savedAt: Date.now() }));
      } catch {
        /* Login can continue without browser storage. */
      }
      router.push(user ? getPostAuthDestination(user) : '/login');
      return;
    }
    if (tier === 'LIFESTYLE' && membership.data?.enabled && membership.data.requiresCaseReview) {
      setError(
        'Your health details require nutritionist review. Choose Health to continue personalized meal planning.'
      );
      return;
    }
    busy.current = true;
    setPendingTier(tier);
    const selection = `${tier}:${period}`;
    keys.current.set(selection, crypto.randomUUID());
    const controller = new AbortController();
    activeRequest.current = controller;
    try {
      const response = await api.post<{ data: CheckoutQuote }>(
        '/user/membership/checkout/quote',
        { tier, period },
        { signal: controller.signal }
      );
      if (controller.signal.aborted) return;
      const summary = response.data.data;
      if (
        summary.mode !== 'TEST' ||
        summary.status !== 'QUOTED' ||
        !summary.id ||
        !Number.isSafeInteger(summary.amountCentavos) ||
        !summary.expiresAt
      )
        throw new Error('Invalid checkout');
      setQuote(summary);
    } catch (failure) {
      if (controller.signal.aborted) return;
      // Refresh the timeline so an existing or expired checkout can be handled explicitly.
      keys.current.delete(selection);
      membership.refresh();
      const response = (failure as { response?: { data?: { error?: string; errorCode?: string } } }).response?.data;
      setError(
        response?.errorCode === 'MEMBERSHIP_PURCHASES_UNAVAILABLE'
          ? 'Demo checkout is not configured for this environment. Please try again later.'
          : response?.errorCode === 'PAYMONGO_UNAVAILABLE'
            ? 'PayMongo is temporarily unavailable. Please try again.'
            : (response?.error ?? 'Demo checkout could not be opened. Please try again.')
      );
    } finally {
      busy.current = false;
      setPendingTier(null);
    }
  };
  const confirm = async () => {
    if (!quote || busy.current) return;
    busy.current = true;
    setPendingTier(quote.tier);
    setError(null);
    const controller = new AbortController();
    activeRequest.current = controller;
    try {
      const selection = `${quote.tier}:${quote.period}`;
      const response = await api.post<{ data: MembershipCheckout }>(
        '/user/membership/checkout',
        {
          tier: quote.tier,
          period: quote.period,
          quoteId: quote.id,
          requestKey: keys.current.get(selection) ?? crypto.randomUUID(),
        },
        { signal: controller.signal }
      );
      if (controller.signal.aborted) return;
      const checkout = response.data.data;
      if (checkout.mode !== 'TEST') throw new Error('Invalid checkout');
      try {
        sessionStorage.removeItem(checkoutSelectionKey);
      } catch {
        /* Storage is optional. */
      }
      if (checkout.status === 'PAID') {
        membership.refresh();
        router.push(`/membership/checkout?purchase=${encodeURIComponent(checkout.id)}`);
      } else if (checkout.checkoutUrl && isCheckoutUrl(checkout.checkoutUrl)) {
        window.location.assign(checkout.checkoutUrl);
      } else throw new Error('Invalid checkout');
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(
          (failure as { response?: { data?: { error?: string } } }).response?.data?.error ??
            'Checkout could not be opened. Review a new payment summary.'
        );
        setQuote(null);
        membership.refresh();
      }
    } finally {
      busy.current = false;
      setPendingTier(null);
    }
  };
  return {
    start,
    confirm,
    quote,
    dismissQuote: () => {
      if (!busy.current) setQuote(null);
    },
    membership: membership.data,
    membershipLoading: membership.isLoading,
    pendingTier,
    error,
    professional,
    user,
    router,
  };
}

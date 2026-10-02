'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import { getPostAuthDestination } from '@/lib/post-auth-destination';
import {
  checkoutSelectionKey,
  isCheckoutUrl,
  type MembershipCheckout,
  type MembershipPeriod,
  type PaidMembershipTier,
} from './checkout';

export function useMembershipCheckout() {
  const { user } = useAuth();
  const router = useRouter();
  const busy = useRef(false);
  const keys = useRef(new Map<string, string>());
  const activeRequest = useRef<AbortController | null>(null);
  const [pendingTier, setPendingTier] = useState<PaidMembershipTier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const professional = Boolean(user && user.role !== 'USER');
  useEffect(() => {
    keys.current.clear();
    setError(null);
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
    busy.current = true;
    setPendingTier(tier);
    const selection = `${tier}:${period}`;
    const requestKey = keys.current.get(selection) ?? crypto.randomUUID();
    keys.current.set(selection, requestKey);
    const controller = new AbortController();
    activeRequest.current = controller;
    try {
      const response = await api.post<{ data: MembershipCheckout }>(
        '/user/membership/checkout',
        {
          tier,
          period,
          requestKey,
        },
        { signal: controller.signal }
      );
      if (controller.signal.aborted) return;
      const checkout = response.data.data;
      if (checkout.mode !== 'TEST' || !checkout.checkoutUrl || !isCheckoutUrl(checkout.checkoutUrl))
        throw new Error('Invalid checkout');
      try {
        sessionStorage.removeItem(checkoutSelectionKey);
      } catch {
        /* Storage is optional. */
      }
      window.location.assign(checkout.checkoutUrl);
    } catch (failure) {
      if (controller.signal.aborted) return;
      // A failed creation needs a new attempt; the server still reuses any recent open session.
      keys.current.delete(selection);
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
  return { start, pendingTier, error, professional, user, router };
}

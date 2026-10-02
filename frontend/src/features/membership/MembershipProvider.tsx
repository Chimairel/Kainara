'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import api from '@/lib/axios';

type Allowance = { used: number; cap: number; remaining: number };
export type MembershipView =
  | { enabled: false }
  | {
      enabled: true;
      level: 'FREE' | 'TRIAL_PENDING' | 'TRIAL' | 'MEMBER';
      enhanced: boolean;
      tier?: 'FREE' | 'LIFESTYLE' | 'HEALTH';
      healthAccess?: boolean;
      healthUntil?: string | null;
      requiresCaseReview: boolean;
      serverTime: string;
      trialStartedAt: string | null;
      trialEndsAt: string | null;
      paidUntil: string | null;
      resetsAt: string;
      purchasesAvailable: boolean;
      checkoutMode?: 'TEST';
      transitions?: {
        current: {
          id: string;
          tier: 'LIFESTYLE' | 'HEALTH';
          period: 'MONTHLY' | 'YEARLY';
          effectiveFrom: string;
          effectiveUntil: string;
        } | null;
        scheduled: Array<{
          id: string;
          tier: 'LIFESTYLE' | 'HEALTH';
          period: 'MONTHLY' | 'YEARLY';
          effectiveFrom: string;
          effectiveUntil: string;
        }>;
        creditBalanceCentavos: number;
        blockedReason: string | null;
        openCheckout: {
          id: string;
          tier: 'LIFESTYLE' | 'HEALTH';
          period: 'MONTHLY' | 'YEARLY';
          status: string;
          checkoutUrl: string | null;
          quoteExpiresAt?: string | null;
        } | null;
      } | null;
      scheduledMemberships?: Array<{
        id: string;
        tier: 'LIFESTYLE' | 'HEALTH';
        effectiveFrom: string;
        effectiveUntil: string;
      }>;
      price: null;
      autoRenews: false;
      limits: {
        freeSwaps: number;
        freeEstimates: number;
        memberSwaps: number;
        memberEstimates: number;
        memberReplans: number;
        memberPlanReviews: number;
        memberOutsideReviews: number;
      };
      usage: Record<'AI_ESTIMATE' | 'REPLAN' | 'PLAN_REVIEW' | 'OUTSIDE_REVIEW', Allowance>;
      swaps: Allowance;
    };
type Context = { data: MembershipView | null; isLoading: boolean; error: string | null; refresh: () => void };
const MembershipContext = createContext<Context>({ data: null, isLoading: false, error: null, refresh: () => {} });
export const useMembership = () => useContext(MembershipContext);

export function MembershipProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const query = useSessionQuery<MembershipView>({
    ownerId: user?.userId,
    resource: 'user-membership-v1',
    enabled: user?.role === 'USER',
    fetcher: async () => (await api.get('/user/membership')).data.data,
    errorMessage: 'Membership status could not be checked. Please retry.',
  });
  const { refetch } = query;
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') void refetch();
    };
    const interval = window.setInterval(refresh, 60_000);
    window.addEventListener('kainara:membership-updated', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('kainara:membership-updated', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [refetch]);
  return (
    <MembershipContext.Provider
      value={{
        data: query.data,
        isLoading: query.isLoading,
        error: query.error,
        refresh: () => {
          void refetch();
        },
      }}
    >
      {children}
    </MembershipContext.Provider>
  );
}

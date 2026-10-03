'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useMembership } from '@/features/membership/MembershipProvider';
import { preloadBackgroundResources } from './background-resources';

const routes = ['/meals', '/grocery', '/membership', '/progress', '/profile'];

export function useDashboardPreload(ownerId: string | undefined, eligible: boolean, ready: boolean) {
  const router = useRouter();
  const membership = useMembership();
  const attemptedOwner = useRef<string | null>(null);
  useEffect(() => {
    if (!ownerId || !eligible) return;
    const timer = window.setTimeout(() => {
      if (document.visibilityState !== 'visible') return;
      routes.forEach((route) => router.prefetch(route));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [ownerId, eligible, router]);

  useEffect(() => {
    if (
      !ownerId ||
      !eligible ||
      !ready ||
      membership.isLoading ||
      membership.error ||
      attemptedOwner.current === ownerId
    )
      return;
    let active = true;
    let started = false;
    const start = () => {
      if (!active || started || document.visibilityState !== 'visible') return;
      started = true;
      attemptedOwner.current = ownerId;
      void preloadBackgroundResources(ownerId, () => active && document.visibilityState === 'visible');
    };
    const timer = window.setTimeout(start, 1_000);
    document.addEventListener('visibilitychange', start);
    return () => {
      active = false;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', start);
      // Leave an active read available to the destination page. Account teardown cancels it.
    };
  }, [ownerId, eligible, ready, membership.isLoading, membership.error]);
}

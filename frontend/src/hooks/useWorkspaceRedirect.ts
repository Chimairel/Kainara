'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { finishWorkspaceNavigation, recoverWorkspaceNavigation } from '@/lib/workspace-navigation-recovery';

/** Recover a stalled client transition without retrying mutations or trusting token claims. */
export function useWorkspaceRedirect(
  destination: string | null,
  ownerId?: string,
  recoveryDelayMs = 30_000,
  documentRetryDelayMs = 15_000
) {
  const { replace } = useRouter();
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    setStalled(false);
    if (!destination) return;
    const source = window.location.pathname + window.location.search;
    replace(destination);
    const retry = setTimeout(() => {
      if (window.location.pathname + window.location.search === source) {
        recoverWorkspaceNavigation(destination, ownerId);
      }
    }, documentRetryDelayMs);
    const warning = setTimeout(() => {
      if (window.location.pathname + window.location.search === source) setStalled(true);
    }, recoveryDelayMs);
    return () => {
      clearTimeout(retry);
      clearTimeout(warning);
    };
  }, [destination, ownerId, recoveryDelayMs, documentRetryDelayMs, replace]);

  // Protected layouts mount this hook's caller after navigation succeeds. Do not
  // erase the retry marker while the origin entry page is still pending.
  useEffect(() => {
    finishWorkspaceNavigation(ownerId);
  }, [ownerId, destination]);
  return stalled;
}

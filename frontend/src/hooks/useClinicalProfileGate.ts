import { useCallback, useEffect, useRef, useState } from 'react';
import { cachedClinicalProfileStatus, refreshClinicalProfileStatus } from '@/lib/clinical-profile-status';
import { cachedUserProfile } from '@/lib/user-profile-resource';
import { useVisiblePolling } from './useVisiblePolling';

type ReviewStatus = 'checking' | 'ready' | 'pending' | 'error';

/** Revalidate a pending review cheaply, then reload the plan on confirmation. */
export function useClinicalProfileGate(
  ownerId: string | undefined,
  safetyRevision: number | undefined,
  onConfirmed: () => Promise<unknown>
) {
  const scope = `${ownerId ?? 'anonymous'}:${safetyRevision ?? 'unknown'}`;
  const cached = cachedClinicalProfileStatus(ownerId, cachedUserProfile(ownerId));
  const initial: ReviewStatus = cached ? (cached.required && !cached.approved ? 'pending' : 'ready') : 'checking';
  const [state, setState] = useState<{ scope: string; status: ReviewStatus }>({ scope, status: initial });
  const status = state.scope === scope ? state.status : initial;
  const previous = useRef<{ scope: string; status: ReviewStatus }>({ scope, status });
  const confirmed = useRef(onConfirmed);
  confirmed.current = onConfirmed;
  if (previous.current.scope !== scope) previous.current = { scope, status };

  const check = useCallback(
    async (signal: AbortSignal) => {
      let result;
      try {
        result = await refreshClinicalProfileStatus(ownerId, cachedUserProfile(ownerId));
      } catch {
        if (signal.aborted) return;
        previous.current = { scope, status: 'error' };
        setState({ scope, status: 'error' });
        return;
      }
      if (signal.aborted) return;
      const next: ReviewStatus = result.required && !result.approved ? 'pending' : 'ready';
      const wasWaiting = previous.current.status === 'pending' || previous.current.status === 'error';
      previous.current = { scope, status: next };
      setState({ scope, status: next });
      if (wasWaiting && next === 'ready') await confirmed.current();
    },
    [ownerId, scope]
  );
  useEffect(() => {
    if (!ownerId) return;
    const controller = new AbortController();
    void check(controller.signal).catch(() => undefined);
    return () => controller.abort();
  }, [ownerId, check]);
  useVisiblePolling(check, {
    enabled: Boolean(ownerId),
    scopeKey: scope,
    intervalMs: status === 'pending' || status === 'error' ? 15_000 : 60_000,
    immediate: false,
  });

  const requireReview = useCallback(() => {
    previous.current = { scope, status: 'pending' };
    setState({ scope, status: 'pending' });
  }, [scope]);
  return { status, requireReview };
}

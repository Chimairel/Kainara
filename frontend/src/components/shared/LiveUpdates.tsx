'use client';
import { useEffect, useRef } from 'react';
import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import { cookieHelper } from '@/lib/auth';
import { createLiveEventParser, LIVE_UPDATE_EVENT } from '@/lib/live-events';
import { liveRetryDelay } from '@/lib/live-retry';

/** One authenticated stream per visible app; ordinary polling covers proxy/job gaps. */
export default function LiveUpdates() {
  const { user, isLoading, profileLoadError, refreshSession } = useAuth();
  const accountId = user?.userId;
  const latestRefresh = useRef(refreshSession);
  latestRefresh.current = refreshSession;
  const streamEnabled = Boolean(accountId) && !isLoading && !profileLoadError;
  useVisiblePolling(
    async () => {
      await refreshSession({ showLoader: false });
    },
    { enabled: Boolean(accountId) && !isLoading, immediate: false, intervalMs: 60000, scopeKey: accountId }
  );
  useEffect(() => {
    if (!streamEnabled) return;
    let disposed = false;
    let controller: AbortController | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let retryAt = 0;
    let failures = 0;
    const isVisible = () => document.visibilityState === 'visible';
    const connect = async () => {
      if (disposed || !isVisible() || controller) return;
      if (Date.now() < retryAt) {
        clearTimeout(retry);
        retry = setTimeout(() => void connect(), retryAt - Date.now());
        return;
      }
      const token = cookieHelper.get('nutrimind_session');
      if (!token) return;
      const active = new AbortController();
      controller = active;
      clearTimeout(retry);
      let retryAfter: string | null = null;
      let openedAt: number | undefined;
      const handshake = setTimeout(() => active.abort(), 15000);
      try {
        const response = await fetch(`${api.defaults.baseURL || '/api'}/live/events`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
          cache: 'no-store',
          signal: active.signal,
        });
        clearTimeout(handshake);
        retryAfter = response.headers?.get('Retry-After') ?? null;
        // Use the shared session refresh/interceptor, not an independent refresh-token request.
        if (response.status === 401) {
          await latestRefresh.current({ showLoader: false });
          return;
        }
        if (!response.ok || !response.body) return;
        openedAt = Date.now();
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const parse = createLiveEventParser(() => {
          if (!disposed && !active.signal.aborted) window.dispatchEvent(new Event(LIVE_UPDATE_EVENT));
        });
        try {
          while (!active.signal.aborted) {
            const { value, done } = await reader.read();
            if (done) break;
            parse(decoder.decode(value, { stream: true }));
          }
        } finally {
          reader.releaseLock();
        }
      } catch {
        /* Existing API/session polling handles outages and token refresh. */
      } finally {
        clearTimeout(handshake);
        if (controller === active) controller = undefined;
        if (!disposed && isVisible()) {
          failures = openedAt !== undefined && Date.now() - openedAt >= 5000 ? 0 : failures + 1;
          const delay = liveRetryDelay(failures, retryAfter);
          retryAt = Date.now() + delay;
          retry = setTimeout(() => void connect(), delay);
        }
      }
    };
    const visibility = () => {
      if (document.visibilityState === 'hidden') {
        clearTimeout(retry);
        controller?.abort();
      } else void connect();
    };
    void connect();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('focus', visibility);
    return () => {
      disposed = true;
      controller?.abort();
      clearTimeout(retry);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('focus', visibility);
    };
  }, [accountId, streamEnabled]);
  return null;
}

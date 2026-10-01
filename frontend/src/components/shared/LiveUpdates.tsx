'use client';
import { useEffect } from 'react';
import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import { cookieHelper } from '@/lib/auth';
import { createLiveEventParser, LIVE_UPDATE_EVENT } from '@/lib/live-events';

/** One authenticated stream per visible app; ordinary polling covers proxy/job gaps. */
export default function LiveUpdates() {
  const { user, refreshSession } = useAuth();
  const accountId = user?.userId;
  useVisiblePolling(
    async () => {
      await refreshSession({ showLoader: false });
    },
    { enabled: Boolean(accountId), immediate: false, intervalMs: 60000, scopeKey: accountId }
  );
  useEffect(() => {
    if (!accountId) return;
    let disposed = false;
    let controller: AbortController | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const isVisible = () => document.visibilityState === 'visible';
    const connect = async () => {
      if (disposed || !isVisible() || controller) return;
      const token = cookieHelper.get('nutrimind_session');
      if (!token) return;
      const active = new AbortController();
      controller = active;
      try {
        const response = await fetch(`${api.defaults.baseURL || '/api'}/live/events`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
          cache: 'no-store',
          signal: active.signal,
        });
        if (!response.ok || !response.body) return;
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
        if (controller === active) controller = undefined;
        if (!disposed && isVisible()) retry = setTimeout(() => void connect(), 3000);
      }
    };
    const visibility = () => {
      clearTimeout(retry);
      if (document.visibilityState === 'hidden') controller?.abort();
      else void connect();
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
  }, [accountId]);
  return null;
}

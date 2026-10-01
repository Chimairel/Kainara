import { LIVE_UPDATE_EVENT } from '@/lib/live-events';
import { useEffect, useRef } from 'react';

/** Poll active pages without overlapping requests; cancel the previous scope on cleanup. */
export function useVisiblePolling(
  refresh: (signal: AbortSignal) => Promise<void>,
  { enabled = true, intervalMs = 15000, immediate = true, scopeKey = '' } = {}
) {
  const latest = useRef(refresh);
  latest.current = refresh;
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let pending = false;
    let queued = false;
    const tick = async (queueIfPending = false) => {
      if (controller.signal.aborted || document.visibilityState === 'hidden') return;
      if (pending) {
        if (queueIfPending) queued = true;
        return;
      }
      pending = true;
      try {
        await latest.current(controller.signal);
      } catch {
        /* Callers display their own retry state; keep the refresh loop alive. */
      } finally {
        pending = false;
        if (queued) {
          queued = false;
          void tick();
        }
      }
    };
    if (immediate) void tick();
    const interval = window.setInterval(() => void tick(), intervalMs);
    const resume = () => void tick(true);
    window.addEventListener('focus', resume);
    window.addEventListener(LIVE_UPDATE_EVENT, resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener('focus', resume);
      window.removeEventListener(LIVE_UPDATE_EVENT, resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [enabled, intervalMs, immediate, scopeKey]);
}

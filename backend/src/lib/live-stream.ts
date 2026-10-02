import type { Response } from 'express';
import type { AuthenticatedRequest } from '@/types';
import { subscribeLiveUpdates } from './live-updates';

/** Each handler owns its connection budget; closed responses never occupy a slot. */
export function createLiveStreamHandler({ limit = 5, lifetimeMs = 25000, heartbeatMs = 10000, debounceMs = 250 } = {}) {
  const connections = new Map<string, number>();
  return (req: AuthenticatedRequest, res: Response) => {
    // Authentication may have awaited the database after the browser disconnected.
    if (req.aborted || res.destroyed || res.writableEnded) return;
    const user = req.user!;
    const count = connections.get(user.userId) ?? 0;
    if (count >= limit) {
      res.set('Retry-After', '30').status(429).json({
        success: false,
        error: 'Too many live connections. Automatic refresh remains available.',
      });
      return;
    }
    connections.set(user.userId, count + 1);
    let closed = false;
    let pending: ReturnType<typeof setTimeout> | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let lifetime: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe = () => {};
    const release = () => {
      if (closed) return;
      closed = true;
      const remaining = (connections.get(user.userId) ?? 1) - 1;
      if (remaining > 0) connections.set(user.userId, remaining);
      else connections.delete(user.userId);
      unsubscribe();
      clearInterval(heartbeat);
      clearTimeout(lifetime);
      clearTimeout(pending);
    };
    // Register before flushing headers, and release on normal completion as well as abort.
    res.once('close', release);
    res.once('finish', release);
    res.once('error', release);
    req.once('aborted', release);
    try {
      res.status(200).set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'private, no-store, no-transform',
        'X-Accel-Buffering': 'no',
      });
      res.flushHeaders();
      res.write('event: connected\ndata: {}\n\n');
      unsubscribe = subscribeLiveUpdates(user.userId, user.role, () => {
        if (closed || pending) return;
        pending = setTimeout(() => {
          pending = undefined;
          if (!closed && !res.writableEnded) res.write('event: refresh\ndata: {}\n\n');
        }, debounceMs);
      });
      heartbeat = setInterval(() => {
        if (!closed && !res.writableEnded) res.write(': keep-alive\n\n');
      }, heartbeatMs);
      lifetime = setTimeout(() => {
        release();
        res.end();
      }, lifetimeMs);
    } catch (error) {
      release();
      throw error;
    }
  };
}

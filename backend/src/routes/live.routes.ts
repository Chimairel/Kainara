import { Router, type Response } from 'express';
import authenticate from '@/middleware/auth';
import type { AuthenticatedRequest } from '@/types';
import { subscribeLiveUpdates } from '@/lib/live-updates';
const router = Router();
const connections = new Map<string, number>();
router.get('/events', authenticate, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const count = connections.get(user.userId) ?? 0;
  if (count >= 5)
    return res
      .status(429)
      .json({ success: false, error: 'Too many live connections. Automatic refresh remains available.' });
  connections.set(user.userId, count + 1);
  res.status(200).set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'private, no-store, no-transform',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('event: connected\ndata: {}\n\n');
  let closed = false;
  let pending: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = subscribeLiveUpdates(user.userId, user.role, () => {
    if (closed || pending) return;
    pending = setTimeout(() => {
      pending = undefined;
      if (!closed && !res.writableEnded) res.write('event: refresh\ndata: {}\n\n');
    }, 250);
  });
  const heartbeat = setInterval(() => {
    if (!closed && !res.writableEnded) res.write(': keep-alive\n\n');
  }, 10000);
  // Short streams work through hosting proxies and reauthorize each connection.
  const lifetime = setTimeout(() => res.end(), 25000);
  res.on('close', () => {
    const remaining = (connections.get(user.userId) ?? 1) - 1;
    if (remaining > 0) connections.set(user.userId, remaining);
    else connections.delete(user.userId);
    closed = true;
    unsubscribe();
    clearInterval(heartbeat);
    clearTimeout(lifetime);
    clearTimeout(pending);
  });
});
export default router;

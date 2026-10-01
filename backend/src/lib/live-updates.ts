import { EventEmitter } from 'node:events';
import type { Role } from '@prisma/client';
const events = new EventEmitter();
events.setMaxListeners(0);
export type LiveAudience = { userId?: string; roles?: Role[] };
/** Signals contain no record IDs or private data; recipients re-read authorized APIs. */
export function publishLiveUpdate(audience: LiveAudience) {
  events.emit('refresh', audience);
}
export function subscribeLiveUpdates(userId: string, role: Role, refresh: () => void) {
  const listener = (audience: LiveAudience) => {
    if (audience.userId === userId || audience.roles?.includes(role)) refresh();
  };
  events.on('refresh', listener);
  return () => {
    events.off('refresh', listener);
  };
}

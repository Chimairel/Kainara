import { cookieHelper, decodeToken } from './auth';

const KEY = 'kainara-workspace-navigation-recovery';
const RETRY_WINDOW_MS = 120_000;
type Recovery = { ownerId: string | null; destination: string; attemptedAt: number };

/** One document retry per account/destination, including across document reloads. */
export function recoverWorkspaceNavigation(
  destination: string,
  ownerId?: string,
  navigate = (target: string) => window.location.replace(target)
): boolean {
  if (ownerId && decodeToken(cookieHelper.get('nutrimind_session') || '')?.userId !== ownerId) return false;
  try {
    const previous = JSON.parse(sessionStorage.getItem(KEY) || 'null') as Recovery | null;
    if (
      previous?.ownerId === (ownerId ?? null) &&
      previous.destination === destination &&
      Date.now() - previous.attemptedAt < RETRY_WINDOW_MS
    )
      return false;
    sessionStorage.setItem(KEY, JSON.stringify({ ownerId: ownerId ?? null, destination, attemptedAt: Date.now() }));
  } catch {
    // Without a durable retry marker, retain manual recovery instead of risking a reload loop.
    return false;
  }
  navigate(destination);
  return true;
}

export function finishWorkspaceNavigation(ownerId?: string) {
  try {
    const previous = JSON.parse(sessionStorage.getItem(KEY) || 'null') as Recovery | null;
    if (
      previous?.ownerId === (ownerId ?? null) &&
      previous.destination === window.location.pathname + window.location.search
    )
      sessionStorage.removeItem(KEY);
  } catch {
    /* Storage is optional; authorization never depends on it. */
  }
}

import { jwtDecode } from 'jwt-decode';
import { cookieHelper } from './auth';

function tokenIdentity(token: string | null): { userId: string; exp: number } | null {
  if (!token) return null;
  try {
    const claims = jwtDecode<{ userId?: unknown; exp?: unknown }>(token);
    return typeof claims.userId === 'string' && typeof claims.exp === 'number'
      ? { userId: claims.userId, exp: claims.exp }
      : null;
  } catch {
    return null;
  }
}

/** Serialize rotation across same-origin tabs; never relax server replay checks. */
export async function coordinatedRefresh(
  failedToken: string | null,
  signal: AbortSignal,
  refresh: () => Promise<string>,
  assertCurrent: () => void
): Promise<string> {
  const run = async () => {
    signal.throwIfAborted();
    assertCurrent();
    const current = cookieHelper.get('nutrimind_session');
    if (failedToken && !current) throw new Error('The session was ended in another tab.');
    if (current && current !== failedToken) {
      const identity = tokenIdentity(current);
      const previous = tokenIdentity(failedToken);
      if (previous && identity?.userId !== previous.userId)
        throw new Error('The signed-in account changed in another tab.');
      if (identity && identity.exp > Date.now() / 1000) return current;
    }
    const token = await refresh();
    signal.throwIfAborted();
    assertCurrent();
    const after = cookieHelper.get('nutrimind_session');
    if (after !== current && tokenIdentity(after)?.userId !== tokenIdentity(current)?.userId)
      throw new Error('The signed-in account changed in another tab.');
    // Publish before releasing the lock, so the next tab never rotates the old cookie.
    cookieHelper.set('nutrimind_session', token, 7);
    return token;
  };
  if (typeof navigator === 'undefined' || !navigator.locks) return run();
  const deadline = new AbortController();
  const abort = () => deadline.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  const timer = setTimeout(abort, 60_000);
  try {
    return await navigator.locks.request('kainara-session-refresh', { signal: deadline.signal }, run);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}

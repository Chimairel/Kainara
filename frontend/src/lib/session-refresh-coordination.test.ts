import { afterEach, describe, expect, it, vi } from 'vitest';
import { coordinatedRefresh } from './session-refresh-coordination';
import { cookieHelper } from './auth';

const token = (userId: string, version: string, expired = false) =>
  btoa('{}') +
  '.' +
  btoa(JSON.stringify({ userId, version, exp: Date.now() / 1000 + (expired ? -60 : 3600) })) +
  '.signature';

function installLock() {
  let tail: Promise<unknown> = Promise.resolve();
  const request = vi.fn((_name: string, _options: unknown, run: () => Promise<string>) => {
    const current = tail.then(run);
    tail = current.catch(() => undefined);
    return current;
  });
  vi.stubGlobal('navigator', { locks: { request } });
  return request;
}

describe('refresh coordination across browser tabs', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    cookieHelper.clear('nutrimind_session');
  });
  it('two clients rotate once and both reuse the new token published inside the lock', async () => {
    installLock();
    const old = token('member', 'old', true),
      renewed = token('member', 'new');
    cookieHelper.set('nutrimind_session', old);
    const refresh = vi.fn(async () => renewed);
    const controller = new AbortController();
    expect(
      await Promise.all([
        coordinatedRefresh(old, controller.signal, refresh, () => {}),
        coordinatedRefresh(old, controller.signal, refresh, () => {}),
      ])
    ).toEqual([renewed, renewed]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it('rejects account switches and cross-tab logout without rotating or overwriting the session', async () => {
    installLock();
    const old = token('member', 'old', true),
      other = token('rnd', 'new');
    cookieHelper.set('nutrimind_session', other);
    const refresh = vi.fn(async () => old);
    await expect(coordinatedRefresh(old, new AbortController().signal, refresh, () => {})).rejects.toThrow(
      'account changed'
    );
    expect(cookieHelper.get('nutrimind_session')).toBe(other);
    cookieHelper.clear('nutrimind_session');
    await expect(coordinatedRefresh(old, new AbortController().signal, refresh, () => {})).rejects.toThrow(
      'session was ended'
    );
    expect(refresh).not.toHaveBeenCalled();
  });
  it('does not publish an in-flight refresh after the account changes elsewhere', async () => {
    installLock();
    const old = token('member', 'old', true),
      other = token('rnd', 'new');
    cookieHelper.set('nutrimind_session', old);
    await expect(
      coordinatedRefresh(
        old,
        new AbortController().signal,
        async () => {
          cookieHelper.set('nutrimind_session', other);
          return token('member', 'refreshed');
        },
        () => {}
      )
    ).rejects.toThrow('account changed');
    expect(cookieHelper.get('nutrimind_session')).toBe(other);
  });
  it('keeps fallback browsers functional and cancelled waiters do not issue requests', async () => {
    vi.stubGlobal('navigator', {});
    const old = token('member', 'old', true),
      renewed = token('member', 'new');
    cookieHelper.set('nutrimind_session', old);
    const refresh = vi.fn(async () => renewed);
    expect(await coordinatedRefresh(old, new AbortController().signal, refresh, () => {})).toBe(renewed);
    const controller = new AbortController();
    controller.abort();
    await expect(coordinatedRefresh(renewed, controller.signal, refresh, () => {})).rejects.toBeDefined();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

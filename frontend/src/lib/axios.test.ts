import axios, { type AxiosAdapter } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import api, { setSessionRefreshSuppressed } from './axios';
import { cookieHelper } from './auth';

describe('session recovery during background requests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setSessionRefreshSuppressed(false);
    cookieHelper.clear('nutrimind_session');
  });

  it.each([503, 429, undefined])('preserves the session when refresh fails with %s', async (status) => {
    cookieHelper.set('nutrimind_session', 'existing-session');
    const clear = vi.spyOn(cookieHelper, 'clear');
    const refresh = vi.spyOn(axios, 'post').mockRejectedValue({ response: status ? { status } : undefined });
    const adapter = vi.fn<AxiosAdapter>(async (config) => Promise.reject({ config, response: { status: 401 } }));

    await expect(api.get('/user/meals/generation-status', { adapter })).rejects.toBeDefined();
    expect(clear).not.toHaveBeenCalled();
    expect(cookieHelper.get('nutrimind_session')).toBe('existing-session');

    refresh.mockResolvedValue({ data: { success: true, data: { accessToken: 'renewed-session' } } });
    adapter.mockImplementationOnce(async (config) => Promise.reject({ config, response: { status: 401 } }));
    adapter.mockImplementationOnce(async (config) => ({
      data: { success: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }));
    await expect(api.get('/user/meals/generation-status', { adapter })).resolves.toMatchObject({ status: 200 });
    expect(cookieHelper.get('nutrimind_session')).toBe('renewed-session');
  });

  it('extends plan and case-detail reads while preserving ordinary, provider and explicit request budgets', async () => {
    const timeouts: number[] = [];
    const adapter: AxiosAdapter = async (config) => {
      timeouts.push(config.timeout ?? 0);
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config };
    };
    await api.get('/user/meals/current', { adapter });
    await api.get('/user/meals/workspace', { adapter });
    await api.get('/user/meals/generation-status', { adapter });
    await api.get('/user/grocery/workspace', { adapter });
    await api.get('/user/meals/current', { adapter, timeout: 15_000 });
    await api.post('/user/meals/current', {}, { adapter });
    await api.post('/user/meals/log-outside', {}, { adapter });
    await api.get('/user/profile', { adapter, timeout: 15_000 });
    await api.get('/nutritionist/queue/meal-1', { adapter });
    await api.get('/nutritionist/queue', { adapter });
    await api.get('/nutritionist/queue/meal-1', { adapter, timeout: 15_000 });
    await api.post('/nutritionist/queue/meal-1/claim', {}, { adapter });
    expect(timeouts).toEqual([
      90_000, 90_000, 30_000, 30_000, 15_000, 30_000, 120_000, 15_000, 90_000, 30_000, 15_000, 30_000,
    ]);
  });

  it('shares one bounded refresh and settles all queued requests after a timeout', async () => {
    let rejectRefresh!: (error: unknown) => void;
    const refresh = vi.spyOn(axios, 'post').mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectRefresh = reject;
        })
    );
    const adapter: AxiosAdapter = async (config) => Promise.reject({ config, response: { status: 401 } });
    const requests = Promise.allSettled([
      api.get('/user/meals/current', { adapter }),
      api.get('/user/grocery/workspace', { adapter }),
    ]);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(refresh).toHaveBeenCalledWith(
      expect.stringContaining('/auth/refresh'),
      {},
      expect.objectContaining({ timeout: 15_000, signal: expect.any(AbortSignal) })
    );
    rejectRefresh(new Error('Request timed out'));
    expect((await requests).every((result) => result.status === 'rejected')).toBe(true);
  });

  it('aborts an old refresh on logout and prevents it overwriting a newly signed-in account', async () => {
    let resolveRefresh!: (value: unknown) => void;
    const refresh = vi.spyOn(axios, 'post').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        })
    );
    const adapter: AxiosAdapter = async (config) => Promise.reject({ config, response: { status: 401 } });
    const requests = Promise.allSettled([
      api.get('/user/meals/current', { adapter }),
      api.get('/user/grocery/workspace', { adapter }),
    ]);
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    const signal = refresh.mock.calls[0][2]?.signal;
    setSessionRefreshSuppressed(true);
    expect(signal?.aborted).toBe(true);
    cookieHelper.set('nutrimind_session', 'new-account-session');
    setSessionRefreshSuppressed(false);
    resolveRefresh({ data: { success: true, data: { accessToken: 'old-account-session' } } });
    expect((await requests).every((result) => result.status === 'rejected')).toBe(true);
    expect(cookieHelper.get('nutrimind_session')).toBe('new-account-session');
  });

  it('does not start a refresh race while a session is being deliberately terminated', async () => {
    cookieHelper.set('nutrimind_session', 'ending-session');
    setSessionRefreshSuppressed(true);
    const refresh = vi.spyOn(axios, 'post');
    const adapter = vi.fn<AxiosAdapter>(async (config) => Promise.reject({ config, response: { status: 401 } }));

    await expect(api.get('/user/notifications', { adapter })).rejects.toBeDefined();
    expect(refresh).not.toHaveBeenCalled();
    expect(cookieHelper.get('nutrimind_session')).toBe('ending-session');
  });
});

import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LiveUpdates from './LiveUpdates';
import { LIVE_UPDATE_EVENT } from '@/lib/live-events';

const session = vi.hoisted(() => ({
  user: { userId: 'fixture-user' } as { userId: string } | null,
  refreshSession: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => session }));
vi.mock('@/lib/axios', () => ({ default: { defaults: { baseURL: '/api' } } }));
vi.mock('@/lib/auth', () => ({ cookieHelper: { get: () => 'fixture-bearer' } }));

describe('authenticated global live connection', () => {
  beforeEach(() => {
    session.user = { userId: 'fixture-user' };
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('uses a private bearer header, dispatches updates and aborts on logout/unmount', async () => {
    let finish!: (value: { done: boolean; value?: Uint8Array }) => void;
    const read = vi
      .fn()
      .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('event: refresh\ndata: {}\n\n') })
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          })
      );
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, body: { getReader: () => ({ read, releaseLock: vi.fn() }) } });
    vi.stubGlobal('fetch', fetcher);
    const updated = vi.fn();
    window.addEventListener(LIVE_UPDATE_EVENT, updated);
    const { rerender, unmount } = render(<LiveUpdates />);
    await waitFor(() => expect(updated).toHaveBeenCalledTimes(1));
    expect(fetcher).toHaveBeenCalledWith(
      '/api/live/events',
      expect.objectContaining({
        headers: { Authorization: 'Bearer fixture-bearer' },
        credentials: 'include',
        cache: 'no-store',
      })
    );
    const signal = fetcher.mock.calls[0][1].signal as AbortSignal;
    session.user = null;
    rerender(<LiveUpdates />);
    expect(signal.aborted).toBe(true);
    await act(async () => {
      finish({ done: true });
    });
    unmount();
    window.removeEventListener(LIVE_UPDATE_EVENT, updated);
  });

  it('reconnects after an outage and does not open streams for hidden pages', async () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, 'visibilityState', 'get');
    visibility.mockReturnValue('hidden');
    const fetcher = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', fetcher);
    const { unmount } = render(<LiveUpdates />);
    expect(fetcher).not.toHaveBeenCalled();
    visibility.mockReturnValue('visible');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    unmount();
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIVE_UPDATE_EVENT } from '@/lib/live-events';
import { useVisiblePolling } from './useVisiblePolling';

describe('visible refresh scheduling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  it('refreshes automatically, pauses hidden pages, resumes on focus and stops on unmount', async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const { unmount } = renderHook(() => useVisiblePolling(refresh));
    await act(async () => {});
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(refresh).toHaveBeenCalledTimes(3);
    const signal = refresh.mock.calls[2][0];
    unmount();
    expect(signal.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(30000);
    expect(refresh).toHaveBeenCalledTimes(3);
  });
  it('does not overlap slow requests; disabling aborts the current scope', async () => {
    const refresh = vi.fn().mockReturnValue(new Promise(() => {}));
    const { rerender } = renderHook(({ enabled }) => useVisiblePolling(refresh, { enabled }), {
      initialProps: { enabled: true },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
      window.dispatchEvent(new Event('focus'));
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    rerender({ enabled: false });
    expect(refresh.mock.calls[0][0].aborted).toBe(true);
  });
  it('rechecks after a live event arrives during a pending read without overlapping it', async () => {
    let finish!: () => void;
    const refresh = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          })
      )
      .mockResolvedValue(undefined);
    const { unmount } = renderHook(() => useVisiblePolling(refresh));
    await act(async () => {
      window.dispatchEvent(new Event(LIVE_UPDATE_EVENT));
      window.dispatchEvent(new Event(LIVE_UPDATE_EVENT));
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish();
    });
    expect(refresh).toHaveBeenCalledTimes(2);
    unmount();
  });
});

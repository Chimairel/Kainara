import { act, renderHook, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDashboardPreload } from './useDashboardPreload';

const mocks = vi.hoisted(() => ({
  prefetch: vi.fn(),
  preload: vi.fn(),
  membership: { isLoading: false, error: null as string | null },
}));
const router = { prefetch: mocks.prefetch };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/features/membership/MembershipProvider', () => ({ useMembership: () => mocks.membership }));
vi.mock('./background-resources', () => ({ preloadBackgroundResources: mocks.preload }));
beforeEach(() => {
  vi.useFakeTimers();
  mocks.prefetch.mockReset();
  mocks.preload.mockReset().mockResolvedValue(undefined);
  mocks.membership.isLoading = false;
  mocks.membership.error = null;
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('dashboard preloading priority', () => {
  it('prefetches page code first but waits for dashboard and membership reads before data', async () => {
    const hook = renderHook(({ ready }) => useDashboardPreload('user', true, ready), {
      initialProps: { ready: false },
    });
    await act(async () => {
      vi.advanceTimersByTime(2_000);
    });
    expect(mocks.prefetch.mock.calls.map(([route]) => route)).toEqual([
      '/meals',
      '/grocery',
      '/membership',
      '/progress',
      '/profile',
    ]);
    expect(mocks.preload).not.toHaveBeenCalled();
    mocks.membership.isLoading = true;
    hook.rerender({ ready: true });
    await act(async () => {
      vi.advanceTimersByTime(2_000);
    });
    expect(mocks.preload).not.toHaveBeenCalled();
    mocks.membership.isLoading = false;
    hook.rerender({ ready: true });
    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });
    expect(mocks.preload).toHaveBeenCalledOnce();
    hook.rerender({ ready: false });
    hook.rerender({ ready: true });
    await act(async () => {
      vi.advanceTimersByTime(2_000);
    });
    expect(mocks.preload).toHaveBeenCalledOnce();
  });

  it('does no work for an ineligible user and cancels queued work on navigation', async () => {
    const hook = renderHook(({ eligible }) => useDashboardPreload('user', eligible, true), {
      initialProps: { eligible: false },
    });
    await act(async () => {
      vi.advanceTimersByTime(2_000);
    });
    expect(mocks.prefetch).not.toHaveBeenCalled();
    expect(mocks.preload).not.toHaveBeenCalled();
    hook.rerender({ eligible: true });
    hook.unmount();
    await act(async () => {
      vi.advanceTimersByTime(2_000);
    });
    expect(mocks.preload).not.toHaveBeenCalled();
  });

  it('waits while hidden and stops the queue after unmount', async () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const hook = renderHook(() => useDashboardPreload('user', true, true));
    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });
    expect(mocks.preload).not.toHaveBeenCalled();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(mocks.preload).toHaveBeenCalledOnce();
    const mayContinue = mocks.preload.mock.calls[0][1];
    expect(mayContinue()).toBe(true);
    hook.unmount();
    expect(mayContinue()).toBe(false);
  });
});

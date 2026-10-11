import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIVE_UPDATE_EVENT } from '@/lib/live-events';
import { refreshClinicalProfileStatus } from '@/lib/clinical-profile-status';
import { useClinicalProfileGate } from './useClinicalProfileGate';

vi.mock('@/lib/clinical-profile-status', () => ({
  cachedClinicalProfileStatus: () => ({ required: true, approved: false }),
  refreshClinicalProfileStatus: vi.fn(),
}));
vi.mock('@/lib/user-profile-resource', () => ({ cachedUserProfile: () => null }));
const refresh = vi.mocked(refreshClinicalProfileStatus);

describe('member profile confirmation refresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    refresh.mockResolvedValue({ required: true, approved: false });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('detects confirmation without a live event within 15 seconds, refreshes once, then uses the slower cadence', async () => {
    const onConfirmed = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useClinicalProfileGate('member-a', 0, onConfirmed));
    await act(async () => {});
    expect(result.current.status).toBe('pending');
    refresh.mockResolvedValue({ required: true, approved: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(result.current.status).toBe('ready');
    expect(onConfirmed).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(refresh).toHaveBeenCalledTimes(2);
    await act(async () => {
      window.dispatchEvent(new Event(LIVE_UPDATE_EVENT));
    });
    expect(onConfirmed).toHaveBeenCalledTimes(1);
  });

  it('pauses fallback polling while hidden and detects confirmation on focus', async () => {
    const onConfirmed = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useClinicalProfileGate('member-a', 0, onConfirmed));
    await act(async () => {});
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    refresh.mockResolvedValue({ required: true, approved: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(result.current.status).toBe('pending');
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(result.current.status).toBe('ready');
    expect(onConfirmed).toHaveBeenCalledTimes(1);
  });

  it.each([
    { owner: 'member-b', revision: 0 },
    { owner: 'member-a', revision: 1 },
  ])('ignores late confirmation after switching scope to $owner/$revision', async (nextScope) => {
    let finish!: (value: { required: boolean; approved: boolean }) => void;
    refresh.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const onConfirmed = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ owner, revision }) => useClinicalProfileGate(owner, revision, onConfirmed),
      { initialProps: { owner: 'member-a', revision: 0 } }
    );
    await act(async () => {});
    rerender(nextScope);
    await act(async () => {});
    await act(async () => {
      finish({ required: true, approved: true });
    });
    expect(result.current.status).toBe('pending');
    expect(onConfirmed).not.toHaveBeenCalled();
  });
});

import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCallDue } from './useCallDue';

describe('scheduled call confirmation', () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  it('becomes available after the schedule without refresh, including the midnight boundary', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T15:53:00Z'));
    const { result } = renderHook(() => useCallDue('2026-10-01T15:54:00Z'));
    expect(result.current).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61000);
    });
    expect(result.current).toBe(true);
    vi.setSystemTime(new Date('2026-10-01T16:02:00Z'));
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(result.current).toBe(true);
  });
  it('never enables a missing or invalid schedule', () => {
    expect(renderHook(() => useCallDue()).result.current).toBe(false);
    expect(renderHook(() => useCallDue('invalid')).result.current).toBe(false);
  });
});

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLicenseAvailability } from './useLicenseAvailability';
const post = vi.hoisted(() => vi.fn());
vi.mock('@/lib/axios', () => ({ default: { post } }));
describe('early PRC duplicate check', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    post.mockReset();
  });
  afterEach(() => vi.useRealTimers());
  it('debounces typing and ignores a stale response for the previous number', async () => {
    let resolveOld!: (value: unknown) => void;
    post.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      })
    );
    const { result, rerender } = renderHook(({ license }) => useLicenseAvailability(license, true), {
      initialProps: { license: 'rnd-12345' },
    });
    expect(result.current).toBe('checking');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(499);
    });
    expect(post).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    post.mockResolvedValueOnce({ data: { data: { available: true } } });
    rerender({ license: 'RND-54321' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current).toBe('available');
    await act(async () => {
      resolveOld({ data: { data: { available: false } } });
    });
    expect(result.current).toBe('available');
    expect(post.mock.calls[0][1]).toEqual({ prcLicenseNumber: 'RND-12345' });
  });
  it('reports duplicates but never claims availability after a failed check', async () => {
    post.mockResolvedValueOnce({ data: { data: { available: false } } });
    const { result, rerender } = renderHook(({ license }) => useLicenseAvailability(license, true), {
      initialProps: { license: '12345' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current).toBe('taken');
    post.mockRejectedValueOnce(new Error('offline'));
    rerender({ license: '98765' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(result.current).toBe('unavailable');
    rerender({ license: '12' });
    expect(result.current).toBe(null);
  });
});

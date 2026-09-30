import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearSessionResourceCache,
  invalidateSessionResource,
  isSessionResourceRecent,
  readSessionResource,
  refreshSessionResource,
  writeSessionResource,
} from './session-resource-cache';

describe('session resource cache', () => {
  beforeEach(() => {
    clearSessionResourceCache();
    vi.useRealTimers();
  });

  it('returns cached data only to the owning account', () => {
    writeSessionResource('user-a', 'profile', { calories: 2100 });

    expect(readSessionResource('user-a', 'profile')).toEqual({ calories: 2100 });
    expect(readSessionResource('user-b', 'profile')).toBeNull();
  });

  it('expires old data and supports targeted invalidation', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-07T00:00:00Z'));
    writeSessionResource('user-a', 'meals', ['breakfast']);

    vi.advanceTimersByTime(1_001);
    expect(readSessionResource('user-a', 'meals', 1_000)).toBeNull();

    writeSessionResource('user-a', 'meals', ['lunch']);
    invalidateSessionResource('user-a', 'meals');
    expect(readSessionResource('user-a', 'meals')).toBeNull();
  });

  it('checks recent data without evicting an older snapshot', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-07T00:00:00Z'));
    writeSessionResource('user-a', 'groceries', { checked: 3 });
    expect(isSessionResourceRecent('user-a', 'groceries', 30_000)).toBe(true);
    vi.advanceTimersByTime(30_001);
    expect(isSessionResourceRecent('user-a', 'groceries', 30_000)).toBe(false);
    expect(readSessionResource('user-a', 'groceries')).toEqual({ checked: 3 });
    expect(isSessionResourceRecent('user-b', 'groceries', 30_000)).toBe(false);
  });

  it('shares an in-flight read and keeps a newer local change', async () => {
    let finish!: (value: string) => void;
    const fetcher = vi.fn(() => new Promise<string>((resolve) => { finish = resolve; }));
    const first = refreshSessionResource('user-a', 'profile', fetcher);
    const second = refreshSessionResource('user-a', 'profile', fetcher);
    expect(first).toBe(second);
    expect(fetcher).toHaveBeenCalledTimes(1);

    writeSessionResource('user-a', 'profile', 'newer edit');
    finish('old server read');
    await first;
    expect(readSessionResource('user-a', 'profile')).toBe('newer edit');
  });

  it('does not restore a private response after logout', async () => {
    let finish!: (value: string) => void;
    const request = refreshSessionResource('user-a', 'meals', () => new Promise<string>((resolve) => { finish = resolve; }));
    clearSessionResourceCache();
    finish('old account meals');
    await request;
    expect(readSessionResource('user-a', 'meals')).toBeNull();
  });
});

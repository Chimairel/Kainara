import { describe, expect, it } from 'vitest';
import { liveRetryDelay } from './live-retry';

describe('live stream retry cooldown', () => {
  it('backs off repeated failures without rapid zero-delay retries', () => {
    expect([1, 2, 3, 4, 5, 6, 20].map((count) => liveRetryDelay(count))).toEqual([
      3000, 6000, 12000, 24000, 48000, 60000, 60000,
    ]);
  });
  it('respects numeric/date Retry-After and handles malformed or unbounded values', () => {
    const now = Date.UTC(2026, 9, 2);
    expect(liveRetryDelay(1, '30', now)).toBe(30000);
    expect(liveRetryDelay(1, new Date(now + 45000).toUTCString(), now)).toBe(45000);
    expect(liveRetryDelay(2, 'invalid', now)).toBe(6000);
    expect(liveRetryDelay(1, '0', now)).toBe(3000);
    expect(liveRetryDelay(1, '999999', now)).toBe(300000);
  });
});

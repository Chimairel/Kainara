import { describe, expect, it } from 'vitest';
import { normalizeAdminAnalytics } from './useAdminAnalytics';
import { analyticsFixture } from './analytics-fixture';
describe('admin analytics response normalization', () => {
  it('normalizes legacy null purposes in a complete snapshot', () => {
    const result = normalizeAdminAnalytics({
      ...analyticsFixture,
      aiUsageByOperation30d: [{ operation: 'OTHER', purpose: null, status: 'SUCCESS', count: 3 }],
    });
    expect(result?.aiUsageByOperation30d).toEqual([
      { operation: 'OTHER', purpose: 'UNSPECIFIED', status: 'SUCCESS', count: 3 },
    ]);
  });
  it('rejects incomplete old caches instead of displaying fabricated zeros', () => {
    expect(normalizeAdminAnalytics({ totalUsers: 2 })).toBeNull();
    expect(normalizeAdminAnalytics({ ...analyticsFixture, totalFoodItems: undefined })).toBeNull();
  });
  it('rejects malformed counts, dates and grouped records', () => {
    for (const invalid of [
      null,
      [],
      { ...analyticsFixture, pendingReviews: -1 },
      { ...analyticsFixture, generatedAt: 'bad' },
      { ...analyticsFixture, activeClearancesByCondition: null },
      { ...analyticsFixture, aiUsageByOperation30d: [{ count: 2 }] },
    ]) {
      expect(normalizeAdminAnalytics(invalid)).toBeNull();
    }
  });
  it('accepts real zero counts and complete empty groups', () => {
    expect(normalizeAdminAnalytics({ ...analyticsFixture, totalUsers: 0 })?.totalUsers).toBe(0);
  });
});

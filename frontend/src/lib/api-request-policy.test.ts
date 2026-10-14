import { describe, expect, it } from 'vitest';
import { getApiRequestTimeout } from './api-request-policy';

describe('shared API request budgets', () => {
  it.each([
    '/nutritionist/library/meal/approvals/case/approval',
    '/nutritionist/audit-history?condition=heart',
    '/nutritionist/meal-verification/recipe/id',
    '/user/meals/compatible-library?search=lomi',
    '/user/meals/history', '/user/progress/history', '/user/account/export',
    '/api/user/meals/meal/swap-preview',
    'http://localhost:5000/api/admin/audit-history',
  ])('gives database work enough time for %s', (url) => {
    expect(getApiRequestTimeout('GET', url)).toBe(90_000);
  });
  it.each(['get', 'post', 'patch', 'delete'])('allows stale grocery rebuilds for %s', (method) => {
    expect(getApiRequestTimeout(method, '/user/grocery/current')).toBe(120_000);
  });
  it('keeps polling bounded and provider/import budgets separate', () => {
    expect(getApiRequestTimeout('get', '/user/meals/generation-status?cycle=1')).toBe(30_000);
    expect(getApiRequestTimeout('get', '/user/notifications')).toBe(30_000);
    expect(getApiRequestTimeout('post', '/user/meals/generate')).toBe(120_000);
    expect(getApiRequestTimeout('post', '/admin/meals/batch/import')).toBe(180_000);
    expect(getApiRequestTimeout('post', '/auth/login')).toBe(60_000);
    expect(getApiRequestTimeout('post', '/auth/verify-email')).toBe(90_000);
    expect(getApiRequestTimeout('post', '/support')).toBe(90_000);
    expect(getApiRequestTimeout('get', '/public/media')).toBe(30_000);
  });
});

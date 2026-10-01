import { describe, expect, it } from 'vitest';
import { getPageTitle } from './page-title';

describe('tab title wording', () => {
  it.each([
    ['/', 0, 'Kainara'],
    ['/login', 0, 'Account access'],
    ['/register', 2, '(2) Account access'],
    ['/profile/health', 125, '(125) Health & goals'],
    ['/grocery/', 1, '(1) Groceries'],
    ['/unknown', 0, 'Kainara'],
    ['/onboarding/stats', 0, 'Set up your profile'],
    ['/', -1, 'Kainara'],
    ['/', NaN, 'Kainara'],
  ])('formats %s with %s unread', (path, count, title) => {
    expect(getPageTitle(path, count)).toBe(title);
  });
});

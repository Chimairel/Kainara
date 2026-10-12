import { describe, expect, it } from 'vitest';
import { getPageTitle } from './page-title';
import { PUBLIC_SEARCH_PAGES } from './seo';

describe('tab title wording', () => {
  it.each([
    ['/', 0, PUBLIC_SEARCH_PAGES['/'].title],
    ['/login', 0, 'Account access'],
    ['/register', 2, '(2) Account access'],
    ['/profile/health', 125, '(125) Health & goals'],
    ['/grocery/', 1, '(1) Groceries'],
    ['/unknown', 0, 'Kainara'],
    ['/onboarding/stats', 0, 'Set up your profile'],
    ['/', -1, PUBLIC_SEARCH_PAGES['/'].title],
    ['/', NaN, PUBLIC_SEARCH_PAGES['/'].title],
    ['/docs', 3, PUBLIC_SEARCH_PAGES['/docs'].title],
    ['/pricing/', 2, PUBLIC_SEARCH_PAGES['/pricing'].title],
  ])('formats %s with %s unread', (path, count, title) => {
    expect(getPageTitle(path, count)).toBe(title);
  });
});

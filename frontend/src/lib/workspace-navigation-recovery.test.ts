import { beforeEach, describe, expect, it, vi } from 'vitest';
import { recoverWorkspaceNavigation, finishWorkspaceNavigation } from './workspace-navigation-recovery';
import { cookieHelper } from './auth';

const token = (owner: string) => `fixture.${btoa(JSON.stringify({ userId: owner }))}.fixture`;
beforeEach(() => {
  sessionStorage.clear();
  cookieHelper.clear('nutrimind_session');
  window.history.replaceState(null, '', '/login');
});

describe('bounded document navigation recovery', () => {
  it('retries once across remounts and permits recovery again after arrival', () => {
    cookieHelper.set('nutrimind_session', token('rnd'));
    const navigate = vi.fn();
    expect(recoverWorkspaceNavigation('/nutritionist/reviews', 'rnd', navigate)).toBe(true);
    expect(recoverWorkspaceNavigation('/nutritionist/reviews', 'rnd', navigate)).toBe(false);
    expect(navigate).toHaveBeenCalledExactlyOnceWith('/nutritionist/reviews');
    finishWorkspaceNavigation('rnd');
    expect(recoverWorkspaceNavigation('/nutritionist/reviews', 'rnd', navigate)).toBe(false);
    window.history.replaceState(null, '', '/nutritionist/reviews');
    finishWorkspaceNavigation('rnd');
    expect(recoverWorkspaceNavigation('/nutritionist/reviews', 'rnd', navigate)).toBe(true);
  });
  it('does not send another signed-in account into the previous account workspace', () => {
    cookieHelper.set('nutrimind_session', token('other'));
    const navigate = vi.fn();
    expect(recoverWorkspaceNavigation('/nutritionist/reviews', 'rnd', navigate)).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });
  it('retains manual recovery when the browser cannot persist the loop guard', () => {
    cookieHelper.set('nutrimind_session', token('rnd'));
    const persist = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage unavailable');
    });
    const navigate = vi.fn();
    try {
      expect(recoverWorkspaceNavigation('/nutritionist/reviews', 'rnd', navigate)).toBe(false);
      expect(navigate).not.toHaveBeenCalled();
    } finally {
      persist.mockRestore();
    }
  });
});

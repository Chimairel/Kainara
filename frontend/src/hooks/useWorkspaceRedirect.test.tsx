import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useWorkspaceRedirect } from './useWorkspaceRedirect';

const mocks = vi.hoisted(() => ({ replace: vi.fn(), recover: vi.fn(), finish: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock('@/lib/workspace-navigation-recovery', () => ({
  recoverWorkspaceNavigation: mocks.recover,
  finishWorkspaceNavigation: mocks.finish,
}));
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/login');
});
afterEach(() => vi.useRealTimers());

it('automatically recovers a stalled soft navigation and retains a bounded manual fallback', () => {
  const { result } = renderHook(() => useWorkspaceRedirect('/nutritionist/reviews', 'rnd'));
  expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/nutritionist/reviews');
  act(() => vi.advanceTimersByTime(15_000));
  expect(mocks.recover).toHaveBeenCalledExactlyOnceWith('/nutritionist/reviews', 'rnd');
  expect(result.current).toBe(false);
  act(() => vi.advanceTimersByTime(15_000));
  expect(result.current).toBe(true);
  expect(mocks.replace).toHaveBeenCalledTimes(1);
});
it('does not interrupt another navigation or retry an unresolved profile', () => {
  const { result, rerender } = renderHook(({ target }) => useWorkspaceRedirect(target, 'rnd'), {
    initialProps: { target: '/nutritionist/reviews' as string | null },
  });
  window.history.replaceState(null, '', '/docs');
  act(() => vi.advanceTimersByTime(30_000));
  expect(mocks.recover).not.toHaveBeenCalled();
  expect(result.current).toBe(false);
  rerender({ target: null });
  act(() => vi.advanceTimersByTime(30_000));
  expect(mocks.replace).toHaveBeenCalledTimes(1);
});

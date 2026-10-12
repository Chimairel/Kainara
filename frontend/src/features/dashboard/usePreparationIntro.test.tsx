import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePreparationIntro } from './usePreparationIntro';

afterEach(() => vi.useRealTimers());
describe('preparation intro', () => {
  it('keeps five seconds when preparation completes early and does not restart on repeated reads', () => {
    vi.useFakeTimers();
    const view = renderHook(({ active }) => usePreparationIntro(active, 'member:cycle', false), {
      initialProps: { active: true },
    });
    act(() => vi.advanceTimersByTime(2_000));
    view.rerender({ active: true });
    view.rerender({ active: false });
    act(() => vi.advanceTimersByTime(2_999));
    expect(view.result.current).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(view.result.current).toBe(false);
  });
  it('cancels immediately for failure or eligibility changes and starts anew for another account', () => {
    vi.useFakeTimers();
    const view = renderHook(({ scope, cancelled }) => usePreparationIntro(true, scope, cancelled), {
      initialProps: { scope: 'one:cycle', cancelled: false },
    });
    act(() => vi.advanceTimersByTime(4_000));
    view.rerender({ scope: 'one:cycle', cancelled: true });
    expect(view.result.current).toBe(false);
    view.rerender({ scope: 'two:cycle', cancelled: false });
    act(() => vi.advanceTimersByTime(1_000));
    expect(view.result.current).toBe(true);
    act(() => vi.advanceTimersByTime(4_000));
    expect(view.result.current).toBe(false);
  });
});

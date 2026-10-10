import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { manilaDateFromKey } from '@/lib/manila-date';
import { useDashboardDateSelection } from './useDashboardDateSelection';

const dates = (keys: string[]) => keys.map(manilaDateFromKey);
const week = ['2026-10-09', '2026-10-10', '2026-10-11'];

describe('dashboard date selection during live plan updates', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-10T00:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('defaults to today and preserves another chosen date through repeated polling', () => {
    const { result, rerender } = renderHook(({ values }) => useDashboardDateSelection(values, 'member:cycle'), {
      initialProps: { values: dates(week) },
    });
    expect(result.current.selectedDayOffset).toBe(1);
    act(() => result.current.setSelectedDayOffset(2));
    rerender({ values: dates(week) });
    rerender({ values: dates(week) });
    expect(result.current.selectedDayOffset).toBe(2);
  });

  it('keeps the actual date when new earlier dates change its position', () => {
    const { result, rerender } = renderHook(({ values }) => useDashboardDateSelection(values, 'member:cycle'), {
      initialProps: { values: dates(week) },
    });
    act(() => result.current.setSelectedDayOffset(2));
    rerender({ values: dates(['2026-10-08', ...week]) });
    expect(result.current.selectedDayOffset).toBe(3);
  });

  it('does not carry a manual selection into another account or cycle', () => {
    const { result, rerender } = renderHook(({ scope }) => useDashboardDateSelection(dates(week), scope), {
      initialProps: { scope: 'member:cycle' },
    });
    act(() => result.current.setSelectedDayOffset(2));
    rerender({ scope: 'other:cycle' });
    expect(result.current.selectedDayOffset).toBe(1);
    act(() => result.current.setSelectedDayOffset(0));
    rerender({ scope: 'other:new-cycle' });
    expect(result.current.selectedDayOffset).toBe(1);
  });

  it('falls back to the first future day if the selected day is withdrawn', () => {
    const { result, rerender } = renderHook(({ values }) => useDashboardDateSelection(values, 'member:cycle'), {
      initialProps: { values: dates(week) },
    });
    act(() => result.current.setSelectedDayOffset(0));
    rerender({ values: dates(['2026-10-11', '2026-10-12']) });
    expect(result.current.selectedDayOffset).toBe(0);
  });

  it('handles initial empty data and ignores invalid navigation indices', () => {
    const { result, rerender } = renderHook(({ values }) => useDashboardDateSelection(values, 'member:cycle'), {
      initialProps: { values: [] as Date[] },
    });
    act(() => result.current.setSelectedDayOffset(4));
    expect(result.current.selectedDayOffset).toBe(0);
    rerender({ values: dates(week) });
    expect(result.current.selectedDayOffset).toBe(1);
  });
});

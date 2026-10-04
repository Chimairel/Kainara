import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useNutritionistLibrary } from './useNutritionistLibrary';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'staff-pagination-fixture' } }) }));
vi.mock('@/hooks/useSessionQuery', () => ({
  useSessionQuery: () => ({
    data: { meals: [], total: 40, limit: 20 },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));
afterEach(() => vi.useRealTimers());

it('does not undo an early Next click when the initial search is unchanged', () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useNutritionistLibrary());
  act(() => result.current.setPage(2));
  act(() => vi.advanceTimersByTime(500));
  expect(result.current.page).toBe(2);
  act(() => result.current.setSearchVal('adobo'));
  expect(result.current.page).toBe(2);
  act(() => vi.advanceTimersByTime(400));
  expect(result.current.page).toBe(1);
});

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import api from '@/lib/axios';
import { clearSessionResourceCache } from '@/lib/session-resource-cache';
import type { MealPlan } from '@/types';
import { useMealLibraryCount } from './useMealLibraryCount';
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));
const options = {
  ownerId: 'member',
  enabled: true,
  search: '',
  mealType: 'All',
  riceRole: 'All',
  meals: [] as MealPlan[],
};
const response = (data: unknown) => ({ data: { success: true, data } });
beforeEach(() => {
  clearSessionResourceCache();
  vi.resetAllMocks();
});

it('loads the full catalogue count without fetching any cards or history', async () => {
  vi.mocked(api.get).mockResolvedValue(response({ total: 1960, restrictedProfile: false }));
  const hook = renderHook(() => useMealLibraryCount(options));
  await waitFor(() => expect(hook.result.current.total).toBe(1960));
  expect(api.get).toHaveBeenCalledExactlyOnceWith('/user/meals/verified-recipes/summary', { params: {} });
});
it('counts the full compatible set and approved plan groups without duplicate library identities', async () => {
  const ids = Array.from({ length: 40 }, (_, i) => `recipe-${i}`);
  vi.mocked(api.get).mockResolvedValue(response({ total: ids.length, eligibleIds: ids, restrictedProfile: true }));
  const meal = {
    id: 'slot-1',
    status: 'APPROVED',
    libraryMealId: ids[30],
    mealName: 'Adobo',
    mealType: 'LUNCH',
    calories: 400,
    proteinG: 20,
    carbsG: 40,
    fatG: 10,
  } as MealPlan;
  const hook = renderHook(() =>
    useMealLibraryCount({
      ...options,
      meals: [
        meal,
        { ...meal, id: 'slot-2' },
        { ...meal, id: 'other', libraryMealId: null, mealName: 'Plan-only dish' },
      ],
    })
  );
  await waitFor(() => expect(hook.result.current.total).toBe(41));
});
it('keeps zero as a real total', async () => {
  vi.mocked(api.get).mockResolvedValue(response({ total: 0, restrictedProfile: true, eligibleIds: [] }));
  const hook = renderHook(() => useMealLibraryCount(options));
  await waitFor(() => expect(hook.result.current.total).toBe(0));
});
it('hides old totals and ignores late responses after account and filter changes', async () => {
  const finish: Array<(value: unknown) => void> = [];
  vi.mocked(api.get).mockImplementation(() => new Promise((resolve) => finish.push(resolve)));
  const hook = renderHook(({ ownerId, search }) => useMealLibraryCount({ ...options, ownerId, search }), {
    initialProps: { ownerId: 'old', search: '' },
  });
  await waitFor(() => expect(finish).toHaveLength(1));
  hook.rerender({ ownerId: 'new', search: 'chicken' });
  await waitFor(() => expect(finish).toHaveLength(2));
  await act(async () => finish[1](response({ total: 12, restrictedProfile: false })));
  expect(hook.result.current.total).toBe(12);
  await act(async () => finish[0](response({ total: 999, restrictedProfile: false })));
  expect(hook.result.current.total).toBe(12);
  expect(api.get).toHaveBeenLastCalledWith('/user/meals/verified-recipes/summary', { params: { search: 'chicken' } });
});
it('exposes failed counts for retry without claiming zero recipes', async () => {
  vi.mocked(api.get)
    .mockResolvedValueOnce(response({ total: 3, restrictedProfile: true, eligibleIds: ['one'] }))
    .mockResolvedValueOnce(response({ total: 7, restrictedProfile: false }));
  const hook = renderHook(() => useMealLibraryCount(options));
  await waitFor(() => expect(hook.result.current.error).toBeTruthy());
  expect(hook.result.current.total).toBeNull();
  await act(async () => {
    await hook.result.current.refresh();
  });
  expect(hook.result.current.total).toBe(7);
  expect(hook.result.current.error).toBeNull();
});
it('does not read the library before the report is acknowledged', async () => {
  const hook = renderHook(() => useMealLibraryCount({ ...options, enabled: false }));
  expect(hook.result.current.total).toBeNull();
  expect(api.get).not.toHaveBeenCalled();
});

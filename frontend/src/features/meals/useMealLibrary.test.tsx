import api from '@/lib/axios';
import { clearSessionResourceCache } from '@/lib/session-resource-cache';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SwapOption } from './meals-workspace.types';
import { useMealLibrary } from './useMealLibrary';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }));

const meal = (id: string): SwapOption => ({
  id,
  mealName: id,
  mealType: 'LUNCH',
  mealTypes: ['LUNCH'],
  isFavorite: true,
  calories: 400,
  proteinG: 20,
  carbsG: 40,
  fatG: 10,
  verifiedBy: '',
  prcLicenseNumber: '',
});
const page = (ids: string[], total = 3, nextCursor: string | null = 'next') => ({
  data: { success: true, data: ids.map(meal), meta: { total, nextCursor } },
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}

describe('compatible library state', () => {
  beforeEach(() => {
    clearSessionResourceCache();
    vi.resetAllMocks();
  });

  it('deduplicates concurrent pagination and preserves metadata in the return-visit cache', async () => {
    const next = deferred<ReturnType<typeof page>>();
    vi.mocked(api.get)
      .mockResolvedValueOnce(page(['a']))
      .mockReturnValueOnce(next.promise);
    const hook = renderHook(() => useMealLibrary('user', true, '2026-09-30'));
    await waitFor(() => expect(hook.result.current.libraryMeals).toHaveLength(1));
    act(() => {
      void hook.result.current.fetchLibrary('next');
      void hook.result.current.fetchLibrary('next');
    });
    expect(api.get).toHaveBeenCalledTimes(2);
    await act(async () => next.resolve(page(['a', 'b'], 3, null)));
    expect(hook.result.current.libraryMeals.map(({ id }) => id)).toEqual(['a', 'b']);
    hook.unmount();
    vi.mocked(api.get).mockReturnValue(new Promise(() => {}));
    const returned = renderHook(() => useMealLibrary('user', true, '2026-09-30'));
    expect(returned.result.current.libraryMeals).toHaveLength(2);
    expect(returned.result.current.libraryTotalCount).toBe(3);
    expect(returned.result.current.libraryNextCursor).toBeNull();
    expect(returned.result.current.isLibraryLoading).toBe(false);
  });

  it('ignores old pagination after a filter change', async () => {
    const next = deferred<ReturnType<typeof page>>();
    vi.mocked(api.get)
      .mockResolvedValueOnce(page(['old']))
      .mockReturnValueOnce(next.promise)
      .mockResolvedValueOnce(page(['filtered'], 1, null));
    const hook = renderHook(() => useMealLibrary('user', true, '2026-09-30'));
    await waitFor(() => expect(hook.result.current.libraryMeals).toHaveLength(1));
    act(() => {
      void hook.result.current.fetchLibrary('next');
    });
    act(() => hook.result.current.setLibrarySearch('filtered'));
    await waitFor(() => expect(hook.result.current.libraryMeals[0]?.id).toBe('filtered'));
    await act(async () => next.resolve(page(['late'])));
    expect(hook.result.current.libraryMeals.map(({ id }) => id)).toEqual(['filtered']);
    expect(hook.result.current.libraryTotalCount).toBe(1);
  });

  it('updates the favorite-only list and its cached total without discarding the cursor', async () => {
    vi.mocked(api.get).mockResolvedValue(page(['a', 'b']));
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
    const hook = renderHook(() => useMealLibrary('user', true, '2026-09-30'));
    await waitFor(() => expect(hook.result.current.libraryMeals).toHaveLength(2));
    act(() => hook.result.current.setLibraryFavoriteOnly(true));
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(hook.result.current.isLibraryLoading).toBe(false));
    await act(async () => {
      await hook.result.current.toggleLibraryFavorite(meal('a'));
    });
    expect(api.delete).toHaveBeenCalledWith('/user/meals/library/a/favorite');
    expect(hook.result.current.libraryMeals.map(({ id }) => id)).toEqual(['b']);
    expect(hook.result.current.libraryTotalCount).toBe(2);
    expect(hook.result.current.libraryNextCursor).toBe('next');
  });
});

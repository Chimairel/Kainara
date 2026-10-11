import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useSharedMealLibraryModel } from './useSharedMealLibraryModel';

const state = vi.hoisted(() => ({ owner: 'rnd-first', get: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: { get: state.get } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: state.owner } }) }));
vi.mock('../useNutritionistLibrary', () => ({ useNutritionistLibrary: () => ({ ownerId: state.owner, meals: [] }) }));
function deferred() {
  let resolve!: (value: unknown) => void;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve: (id: string) => resolve({ data: { success: true, data: { id } } }) };
}
beforeEach(() => {
  vi.clearAllMocks();
  state.owner = 'rnd-first';
});
it('keeps the newest recipe selected when detail responses arrive out of order', async () => {
  const first = deferred(),
    second = deferred();
  state.get.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const { result } = renderHook(() => useSharedMealLibraryModel({}));
  let openFirst!: Promise<void>, openSecond!: Promise<void>;
  act(() => {
    openFirst = result.current.openMeal({ id: 'first' });
  });
  act(() => {
    openSecond = result.current.openMeal({ id: 'second' });
  });
  await act(async () => {
    second.resolve('second');
    await openSecond;
  });
  await act(async () => {
    first.resolve('first');
    await openFirst;
  });
  expect(result.current.viewedMeal?.id).toBe('second');
});
it('does not reopen a detail that was closed while loading', async () => {
  const response = deferred();
  state.get.mockReturnValue(response.promise);
  const { result } = renderHook(() => useSharedMealLibraryModel({}));
  let opening!: Promise<void>;
  act(() => {
    opening = result.current.openMeal({ id: 'first' });
  });
  act(() => {
    result.current.setViewedMeal(null);
  });
  await act(async () => {
    response.resolve('first');
    await opening;
  });
  expect(result.current.viewedMeal).toBeNull();
});
it('ignores a detail completion after the account changes', async () => {
  const response = deferred();
  state.get.mockReturnValue(response.promise);
  const { result, rerender } = renderHook(() => useSharedMealLibraryModel({}));
  let opening!: Promise<void>;
  act(() => {
    opening = result.current.openMeal({ id: 'first' });
  });
  state.owner = 'rnd-second';
  rerender();
  await act(async () => {
    response.resolve('first');
    await opening;
  });
  expect(result.current.viewedMeal).toBeNull();
});

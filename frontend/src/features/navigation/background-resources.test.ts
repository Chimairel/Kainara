import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/axios';
import { refreshMealsWorkspace } from '@/features/meals/meal-workspace-resource';
import { fetchGroceryWorkspace } from '@/features/grocery/current-grocery';
import {
  clearSessionResourceCache,
  readSessionResource,
  refreshSessionResource,
  writeSessionResource,
} from '@/lib/session-resource-cache';
import {
  cancelBackgroundResources,
  invalidateBackgroundResources,
  preloadBackgroundResources,
} from './background-resources';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));
const get = vi.mocked(api.get);
const groceries = { current: null, upcoming: null };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  clearSessionResourceCache();
  get.mockReset();
  get.mockImplementation(async (url) => ({
    data: { success: true, data: url === '/user/meals/workspace' ? [] : groceries },
  }));
});

describe('background navigation data', () => {
  it('loads serially and lets both destination pages adopt an in-flight read', async () => {
    const mealRead = deferred<unknown>();
    const groceryRead = deferred<unknown>();
    get.mockImplementation((url) => (url === '/user/meals/workspace' ? mealRead.promise : groceryRead.promise));
    const preload = preloadBackgroundResources('user', () => true);
    const foregroundMeal = refreshMealsWorkspace('user');
    expect(get).toHaveBeenCalledTimes(1);
    mealRead.resolve({ data: { success: true, data: [], meta: { generationStatus: { current: 'COMPLETED' } } } });
    await foregroundMeal;
    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    const foregroundGrocery = refreshSessionResource('user', 'user-grocery-workspace', fetchGroceryWorkspace);
    expect(get).toHaveBeenCalledTimes(2);
    groceryRead.resolve({ data: { success: true, data: groceries } });
    await Promise.all([foregroundGrocery, preload]);
    expect(readSessionResource('user', 'user-grocery-workspace')).toEqual(groceries);
    expect(readSessionResource('other', 'user-grocery-workspace')).toBeNull();
  });

  it('skips recent snapshots without suppressing a foreground revalidation', async () => {
    writeSessionResource('user', 'user-meals-workspace', { meals: [], pendingReview: null });
    writeSessionResource('user', 'user-grocery-workspace', groceries);
    await preloadBackgroundResources('user', () => true);
    expect(get).not.toHaveBeenCalled();
    await refreshMealsWorkspace('user');
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('stops queued work after navigation or hiding without cancelling an adopted read', async () => {
    let active = true;
    const request = deferred<unknown>();
    get.mockReturnValue(request.promise);
    const preload = preloadBackgroundResources('user', () => active);
    const foreground = refreshMealsWorkspace('user');
    active = false;
    request.resolve({ data: { success: true, data: [] } });
    await Promise.all([preload, foreground]);
    expect(get).toHaveBeenCalledTimes(1);
    expect(readSessionResource('user', 'user-meals-workspace')).not.toBeNull();
  });

  it('rejects stale background data after live updates, mutations and account teardown', async () => {
    const request = deferred<unknown>();
    get.mockReturnValue(request.promise);
    let active = true;
    const preload = preloadBackgroundResources('user', () => active);
    const signal = get.mock.calls[0][1]?.signal;
    invalidateBackgroundResources('user');
    active = false;
    cancelBackgroundResources('user');
    expect(signal?.aborted).toBe(true);
    request.resolve({ data: { success: true, data: [{ id: 'old' }] } });
    await preload;
    expect(get).toHaveBeenCalledTimes(1);
    expect(readSessionResource('user', 'user-meals-workspace')).toBeNull();
  });

  it.each([
    { success: false, data: [] },
    { success: true, data: null },
  ])('keeps invalid meal responses out of cache and stops optional work: %j', async (body) => {
    get.mockResolvedValue({ data: body });
    await preloadBackgroundResources('user', () => true);
    expect(get).toHaveBeenCalledTimes(1);
    expect(readSessionResource('user', 'user-meals-workspace')).toBeNull();
  });

  it('keeps a newer local snapshot when a slow preload finishes', async () => {
    const request = deferred<unknown>();
    get.mockReturnValue(request.promise);
    const preload = preloadBackgroundResources('user', () => true);
    const newest = { meals: [{ id: 'swapped' }], pendingReview: null };
    writeSessionResource('user', 'user-meals-workspace', newest);
    writeSessionResource('user', 'user-grocery-workspace', groceries);
    request.resolve({ data: { success: true, data: [{ id: 'old' }] } });
    await preload;
    expect(readSessionResource('user', 'user-meals-workspace')).toBe(newest);
    expect(get).toHaveBeenCalledTimes(1);
  });
});

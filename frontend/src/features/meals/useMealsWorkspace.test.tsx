import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getManilaDateKey } from '@/lib/manila-date';
import { useMealsWorkspace } from './useMealsWorkspace';
import {
  clearSessionResourceCache,
  invalidateSessionResource,
  readSessionResource,
  writeSessionResource,
} from '@/lib/session-resource-cache';
import { refreshMealsWorkspace } from './meal-workspace-resource';
import type { MealPlan } from '@/types';
import type { SwapOption } from './meals-workspace.types';

const { getMock, postMock, toastMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  toastMock: { loading: vi.fn(), success: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: toastMock }));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { userId: 'user-1' } }),
}));

vi.mock('@/lib/axios', () => ({
  default: { get: getMock, post: postMock },
}));

const historyRows = Array.from({ length: 3 }, (_, index) => ({ id: `history-${index}` }));
const libraryRows = Array.from({ length: 5 }, (_, index) => ({ id: `library-${index}` }));

function successfulResponseFor(url: string) {
  if (url === '/user/meals/history') return { data: { success: true, data: historyRows } };
  if (url === '/user/meals/compatible-library') return { data: { success: true, data: libraryRows } };
  return { data: { success: true, data: [], meta: {} } };
}

describe('useMealsWorkspace', () => {
  beforeEach(() => {
    clearSessionResourceCache();
    getMock.mockReset();
    postMock.mockReset();
    Object.values(toastMock).forEach((mock) => mock.mockReset());
    getMock.mockImplementation(async (url: string) => successfulResponseFor(url));
  });

  it('adopts a dashboard preload without starting another workspace request', async () => {
    let finish!: (value: unknown) => void;
    getMock.mockImplementation((url: string) =>
      url === '/user/meals/workspace'
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : Promise.resolve(successfulResponseFor(url))
    );
    const preload = refreshMealsWorkspace('user-1');
    const { result } = renderHook(() => useMealsWorkspace());
    expect(getMock.mock.calls.filter(([url]) => url === '/user/meals/workspace')).toHaveLength(1);
    await act(async () => {
      finish({ data: { success: true, data: [{ id: 'saved' }], meta: {} } });
      await preload;
    });
    expect(result.current.meals).toEqual([{ id: 'saved' }]);
    expect(result.current.error).toBeNull();
  });

  it('keeps a newer swap snapshot when an adopted preload finishes late', async () => {
    let finish!: (value: unknown) => void;
    getMock.mockImplementation((url: string) =>
      url === '/user/meals/workspace'
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : Promise.resolve(successfulResponseFor(url))
    );
    const preload = refreshMealsWorkspace('user-1');
    const { result } = renderHook(() => useMealsWorkspace());
    const newest = { meals: [{ id: 'swapped', scheduledDate: '2026-10-03' }], pendingReview: null };
    writeSessionResource('user-1', 'user-meals-workspace', newest);
    await act(async () => {
      finish({ data: { success: true, data: [{ id: 'old' }], meta: {} } });
      await preload;
    });
    expect(result.current.meals).toEqual(newest.meals);
    expect(readSessionResource('user-1', 'user-meals-workspace')).toEqual(newest);
  });

  it('rejects an invalidated preload instead of displaying stale meals or a generation state', async () => {
    let finish!: (value: unknown) => void;
    getMock.mockImplementation((url: string) =>
      url === '/user/meals/workspace'
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : Promise.resolve(successfulResponseFor(url))
    );
    const preload = refreshMealsWorkspace('user-1');
    const { result } = renderHook(() => useMealsWorkspace());
    invalidateSessionResource('user-1', 'user-meals-workspace');
    await act(async () => {
      finish({ data: { success: true, data: [{ id: 'old' }], meta: {} } });
      await preload;
    });
    expect(result.current.meals).toEqual([]);
    expect(result.current.error).toBeTruthy();
    expect(readSessionResource('user-1', 'user-meals-workspace')).toBeNull();
  });

  it('honors an explicit replacement even when every old meal was hidden, and coalesces repeated clicks', async () => {
    const { result } = renderHook(() => useMealsWorkspace());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let resolvePayment: ((value: unknown) => void) | undefined;
    postMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePayment = resolve;
        })
    );
    let first: Promise<void>;
    act(() => {
      first = result.current.handleRegeneratePlan({ replaceExisting: true, skipConfirm: true });
    });
    await act(async () => result.current.handleRegeneratePlan({ replaceExisting: true, skipConfirm: true }));
    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock.mock.calls[0][1].replaceExisting).toBe(true);
    await act(async () => {
      resolvePayment?.({ data: { success: true } });
      await first!;
    });
    expect(result.current.isRegenerating).toBe(false);
  });

  it('loads history and library only when their tabs are opened', async () => {
    const { result } = renderHook(() => useMealsWorkspace());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getMock).not.toHaveBeenCalledWith('/user/meals/history', { params: {} });
    expect(getMock).not.toHaveBeenCalledWith('/user/meals/compatible-library', {
      params: { date: getManilaDateKey(new Date()), limit: '24' },
    });

    act(() => result.current.setActiveTab('history'));
    await waitFor(() => expect(result.current.historyTotalCount).toBe(3));
    expect(getMock).toHaveBeenCalledWith('/user/meals/history', { params: {} });

    act(() => result.current.setActiveTab('library'));
    await waitFor(() => expect(result.current.libraryTotalCount).toBe(5));
    expect(getMock).toHaveBeenCalledWith('/user/meals/compatible-library', {
      params: { date: getManilaDateKey(new Date()), limit: '24' },
    });
  });

  it('keeps the existing workspace visible during a focus refresh', async () => {
    const { result } = renderHook(() => useMealsWorkspace());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let resolveRefresh: ((value: ReturnType<typeof successfulResponseFor>) => void) | undefined;
    getMock.mockImplementation((url: string) => {
      if (url !== '/user/meals/workspace') return Promise.resolve(successfulResponseFor(url));
      return new Promise((resolve) => {
        resolveRefresh = resolve;
      });
    });

    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(resolveRefresh).toBeTypeOf('function'));
    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      resolveRefresh?.(successfulResponseFor('/user/meals/workspace'));
    });
  });

  it('keeps a failed plan read visible while retrying and clears it only after a valid response', async () => {
    getMock.mockImplementation(async (url: string) => {
      if (url === '/user/meals/workspace') throw new Error('Request timed out');
      return successfulResponseFor(url);
    });
    const { result } = renderHook(() => useMealsWorkspace());
    await waitFor(() => expect(result.current.error).toBe('Failed to fetch weekly plan menu.'));
    let resolveRetry: ((value: unknown) => void) | undefined;
    getMock.mockImplementation((url: string) => {
      if (url !== '/user/meals/workspace') return Promise.resolve(successfulResponseFor(url));
      return new Promise((resolve) => {
        resolveRetry = resolve;
      });
    });
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(resolveRetry).toBeTypeOf('function'));
    expect(result.current.error).toBe('Failed to fetch weekly plan menu.');
    await act(async () => resolveRetry?.({ data: { success: true, data: [], meta: {} } }));
    expect(result.current.error).toBeNull();
  });

  async function prepareSwap() {
    const mounted = renderHook(() => useMealsWorkspace());
    await waitFor(() => expect(mounted.result.current.isLoading).toBe(false));
    act(() => {
      mounted.result.current.setActiveSwapMeal({ id: 'slot', mealName: 'Original meal' } as MealPlan);
      mounted.result.current.setConfirmSwapMeal({ id: 'replacement', mealName: 'Replacement meal' } as SwapOption);
      mounted.result.current.setSwapPreview({
        previewToken: 'proof',
        requestKey: 'key',
        warningRequired: false,
      } as NonNullable<typeof mounted.result.current.swapPreview>);
    });
    return mounted;
  }

  it('blocks duplicate submissions and announces success before a slow plan refresh finishes', async () => {
    const { result } = await prepareSwap();
    let finishPost!: (value: unknown) => void;
    let finishRead!: (value: unknown) => void;
    postMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishPost = resolve;
        })
    );
    getMock.mockImplementation((url: string) =>
      url === '/user/meals/workspace'
        ? new Promise((resolve) => {
            finishRead = resolve;
          })
        : Promise.resolve(successfulResponseFor(url))
    );
    const notificationEvent = vi.fn();
    window.addEventListener('nutrimind:notifications-updated', notificationEvent);
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.handleConfirmSwapAnyway();
      void result.current.handleConfirmSwapAnyway();
    });
    expect(postMock).toHaveBeenCalledTimes(1);
    expect(result.current.isSwapping).toBe(true);
    expect(toastMock.loading).toHaveBeenCalledWith('Swapping meal…', expect.anything());
    expect(toastMock.success).not.toHaveBeenCalled();
    await act(async () => finishPost({ data: { success: true, data: { swapsRemaining: 5 } } }));
    await waitFor(() => expect(result.current.isRefreshingSwap).toBe(true));
    expect(toastMock.success).toHaveBeenCalledWith(
      'Meal swapped',
      expect.objectContaining({ description: expect.stringContaining('5 swaps left') })
    );
    expect(notificationEvent).toHaveBeenCalledTimes(1);
    expect(result.current.activeSwapMeal).not.toBeNull();
    await act(async () => {
      finishRead(successfulResponseFor('/user/meals/workspace'));
      await pending;
    });
    expect(result.current.isSwapping).toBe(false);
    expect(result.current.isRefreshingSwap).toBe(false);
    expect(result.current.activeSwapMeal).toBeNull();
    window.removeEventListener('nutrimind:notifications-updated', notificationEvent);
  });

  it.each([
    ['request failure', () => Promise.reject(new Error('Swap timed out'))],
    ['unsuccessful response', () => Promise.resolve({ data: { success: false, error: 'Swap rejected' } })],
  ])('clears swap progress and retains the same preview for retry after %s', async (_name, response) => {
    const { result } = await prepareSwap();
    postMock.mockImplementationOnce(response);
    await act(async () => result.current.handleConfirmSwapAnyway());
    expect(result.current.isSwapping).toBe(false);
    expect(result.current.swapOptionsError).toBeTruthy();
    expect(result.current.swapPreview?.requestKey).toBe('key');
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(toastMock.error).toHaveBeenCalled();
    postMock.mockResolvedValueOnce({ data: { success: true } });
    await act(async () => result.current.handleConfirmSwapAnyway());
    expect(postMock).toHaveBeenCalledTimes(2);
    expect(result.current.activeSwapMeal).toBeNull();
  });

  it.each([
    { success: false, data: [] },
    { success: true, data: null },
  ])('rejects an unsuccessful or malformed plan read instead of recording an empty plan: %j', async (body) => {
    getMock.mockImplementation(async (url: string) =>
      url === '/user/meals/workspace' ? { data: body } : successfulResponseFor(url)
    );
    const { result } = renderHook(() => useMealsWorkspace());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.cycles).toBeNull();
  });

  it('preserves saved meals and cycle identity when a later refresh times out', async () => {
    const saved = { id: 'saved-meal', scheduledDate: '2026-10-03', calories: 500, proteinG: 25, carbsG: 60, fatG: 18 };
    const cycle = { id: 'saved-cycle', status: 'ACTIVE' };
    getMock.mockImplementation(async (url: string) =>
      url === '/user/meals/workspace'
        ? {
            data: {
              success: true,
              data: [saved],
              meta: { cycles: { current: cycle }, generationStatus: { current: 'COMPLETED', upcoming: null } },
            },
          }
        : successfulResponseFor(url)
    );
    const { result } = renderHook(() => useMealsWorkspace());
    await waitFor(() => expect(result.current.meals).toEqual([saved]));
    getMock.mockImplementation(async (url: string) => {
      if (url === '/user/meals/workspace') throw new Error('Request timed out');
      return successfulResponseFor(url);
    });
    act(() => window.dispatchEvent(new Event('focus')));
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.meals).toEqual([saved]);
    expect(result.current.cycles?.current).toEqual(cycle);
    expect(result.current.generationStatus.current).toBe('COMPLETED');
  });

  it('restores the previous plan immediately after route remount and revalidates silently', async () => {
    getMock.mockImplementation(async (url: string) => {
      if (url === '/user/meals/workspace') {
        return { data: { success: true, data: [{ id: 'cached-meal' }], meta: {} } };
      }
      return successfulResponseFor(url);
    });
    const firstRender = renderHook(() => useMealsWorkspace());
    await waitFor(() => expect(firstRender.result.current.isLoading).toBe(false));
    firstRender.unmount();

    let resolveRefresh: ((value: ReturnType<typeof successfulResponseFor>) => void) | undefined;
    getMock.mockImplementation((url: string) => {
      if (url !== '/user/meals/workspace') return Promise.resolve(successfulResponseFor(url));
      return new Promise((resolve) => {
        resolveRefresh = resolve;
      });
    });

    const secondRender = renderHook(() => useMealsWorkspace());
    expect(secondRender.result.current.isLoading).toBe(false);
    expect(secondRender.result.current.meals).toEqual([{ id: 'cached-meal' }]);
    await waitFor(() => expect(resolveRefresh).toBeTypeOf('function'));

    await act(async () => {
      resolveRefresh?.(successfulResponseFor('/user/meals/workspace'));
    });
  });
  it.each([
    ['request failure', () => Promise.reject(new Error('Request timed out'))],
    ['unsuccessful response', () => Promise.resolve({ data: { success: false } })],
  ])('clears regeneration loading and permits retry after %s', async (_name, response) => {
    postMock.mockImplementationOnce(response);
    const { result } = renderHook(() => useMealsWorkspace());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => result.current.handleRegeneratePlan({ skipConfirm: true }));
    expect(result.current.isRegenerating).toBe(false);
    expect(result.current.error).toBeTruthy();
    postMock.mockResolvedValueOnce({ data: { success: true } });
    await act(async () => result.current.handleRegeneratePlan({ skipConfirm: true }));
    expect(postMock).toHaveBeenCalledTimes(2);
    expect(result.current.isRegenerating).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

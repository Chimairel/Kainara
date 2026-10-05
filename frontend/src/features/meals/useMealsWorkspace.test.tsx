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
import { AxiosError } from 'axios';
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
    window.history.replaceState({}, '', '/meals');
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

  it('retries an invalidated preload without displaying stale meals, generation state or a transient error', async () => {
    let finish!: (value: unknown) => void;
    let finishRetry!: (value: unknown) => void;
    let reads = 0;
    getMock.mockImplementation((url: string) =>
      url === '/user/meals/workspace'
        ? new Promise((resolve) => {
            if (++reads === 1) finish = resolve;
            else finishRetry = resolve;
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
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(true);
    expect(readSessionResource('user-1', 'user-meals-workspace')).toBeNull();
    await act(async () => finishRetry({ data: { success: true, data: [{ id: 'fresh' }], meta: {} } }));
    expect(result.current.meals).toEqual([{ id: 'fresh' }]);
    expect(result.current.error).toBeNull();
  });

  it('retries initial preparation without replacing a plan, and coalesces repeated clicks', async () => {
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
      first = result.current.handleRetryPreparation();
    });
    await act(async () => result.current.handleRetryPreparation());
    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock).toHaveBeenCalledWith('/user/meals/generate', {});
    await act(async () => {
      resolvePayment?.({ data: { success: true } });
      await first!;
    });
    expect(result.current.isPreparing).toBe(false);
  });

  it('does not replace existing meals when preparation is retried', async () => {
    getMock.mockResolvedValue({ data: { success: true, data: [{ id: 'existing' }], meta: {} } });
    const { result } = renderHook(() => useMealsWorkspace());
    await waitFor(() => expect(result.current.meals).toHaveLength(1));
    await act(async () => result.current.handleRetryPreparation());
    expect(postMock).not.toHaveBeenCalled();
  });

  it('ignores retired regeneration links and preserves other query parameters', async () => {
    window.history.replaceState({}, '', '/meals?regenerate=true&date=2026-10-05');
    const { result } = renderHook(() => useMealsWorkspace());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(window.location.search).toBe('?date=2026-10-05');
    expect(postMock).not.toHaveBeenCalled();
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

  const updatedMeal = { id: 'slot', mealName: 'Replacement meal', scheduledDate: '2026-10-03' };
  const updatedResponse = { data: { success: true, data: [updatedMeal], meta: {} } };

  it('makes overlapping plan refresh callers wait for the same read', async () => {
    const { result } = await prepareSwap();
    let finish!: (value: unknown) => void;
    getMock.mockImplementation((url: string) =>
      url === '/user/meals/workspace'
        ? new Promise((resolve) => {
            finish = resolve;
          })
        : Promise.resolve(successfulResponseFor(url))
    );
    let first!: Promise<void>;
    let second!: Promise<void>;
    let returnedEarly = false;
    act(() => {
      first = result.current.retryPlanLoad();
      second = result.current.retryPlanLoad().then(() => {
        returnedEarly = true;
      });
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(returnedEarly).toBe(false);
    await act(async () => {
      finish(updatedResponse);
      await Promise.all([first, second]);
    });
    expect(result.current.meals).toEqual([updatedMeal]);
  });

  it.each(['success', 'failure'])(
    'ignores a pre-swap background read ending in %s while the committed swap refresh runs',
    async (outcome) => {
      const { result } = await prepareSwap();
      let finishOld!: (value: unknown) => void;
      let failOld!: (reason: unknown) => void;
      let finishFresh!: (value: unknown) => void;
      let reads = 0;
      getMock.mockImplementation((url: string) =>
        url === '/user/meals/workspace'
          ? new Promise((resolve, reject) => {
              if (++reads === 1) {
                finishOld = resolve;
                failOld = reject;
              } else finishFresh = resolve;
            })
          : Promise.resolve(successfulResponseFor(url))
      );
      let oldRead!: Promise<void>;
      act(() => {
        oldRead = result.current.retryPlanLoad();
      });
      postMock.mockResolvedValueOnce({ data: { success: true, data: { swapsRemaining: 5 } } });
      let swap!: Promise<void>;
      act(() => {
        swap = result.current.handleConfirmSwapAnyway();
      });
      await waitFor(() => expect(reads).toBe(2));
      await act(async () => {
        if (outcome === 'success') finishOld({ data: { success: true, data: [{ id: 'old' }], meta: {} } });
        else failOld(new Error('Old request failed'));
        await oldRead;
      });
      expect(result.current.error).toBeNull();
      expect(result.current.isSwapping).toBe(true);
      expect(result.current.meals).not.toEqual([{ id: 'old' }]);
      await act(async () => {
        finishFresh(updatedResponse);
        await swap;
      });
      expect(result.current.meals).toEqual([updatedMeal]);
      expect(result.current.error).toBeNull();
      expect(postMock).toHaveBeenCalledTimes(1);
      expect(toastMock.error).not.toHaveBeenCalled();
    }
  );

  it.each(['live invalidation', 'network timeout'])(
    'recovers a post-swap %s without an error flash or another swap',
    async (failure) => {
      const { result } = await prepareSwap();
      let finishFirst!: (value: unknown) => void;
      let failFirst!: (reason: unknown) => void;
      let finishRetry!: (value: unknown) => void;
      let reads = 0;
      getMock.mockImplementation((url: string) =>
        url === '/user/meals/workspace'
          ? new Promise((resolve, reject) => {
              if (++reads === 1) {
                finishFirst = resolve;
                failFirst = reject;
              } else finishRetry = resolve;
            })
          : Promise.resolve(successfulResponseFor(url))
      );
      postMock.mockResolvedValueOnce({ data: { success: true } });
      let swap!: Promise<void>;
      act(() => {
        swap = result.current.handleConfirmSwapAnyway();
      });
      await waitFor(() => expect(reads).toBe(1));
      await act(async () => {
        if (failure === 'live invalidation') {
          invalidateSessionResource('user-1', 'user-meals-workspace');
          finishFirst({ data: { success: true, data: [{ id: 'superseded' }], meta: {} } });
        } else failFirst(new AxiosError('timeout', 'ECONNABORTED'));
      });
      expect(reads).toBe(2);
      expect(result.current.error).toBeNull();
      expect(result.current.isSwapping).toBe(true);
      expect(toastMock.error).not.toHaveBeenCalled();
      await act(async () => {
        finishRetry(updatedResponse);
        await swap;
      });
      expect(result.current.meals).toEqual([updatedMeal]);
      expect(postMock).toHaveBeenCalledTimes(1);
      expect(toastMock.success).toHaveBeenCalled();
    }
  );

  it('reports a persistently failed refresh as a saved swap, without resubmitting it', async () => {
    const { result } = await prepareSwap();
    getMock.mockImplementation(async (url: string) => {
      if (url === '/user/meals/workspace') throw new AxiosError('timeout', 'ECONNABORTED');
      return successfulResponseFor(url);
    });
    getMock.mockClear();
    postMock.mockResolvedValueOnce({ data: { success: true } });
    await act(async () => result.current.handleConfirmSwapAnyway());
    expect(getMock.mock.calls.filter(([url]) => url === '/user/meals/workspace')).toHaveLength(2);
    expect(postMock).toHaveBeenCalledTimes(1);
    expect(result.current.error).toContain('Meal swapped');
    expect(result.current.activeSwapMeal).toBeNull();
    expect(result.current.isSwapping).toBe(false);
    expect(toastMock.error).toHaveBeenCalledWith('Meal swapped; plan refresh unavailable', expect.anything());
    expect(toastMock.error).not.toHaveBeenCalledWith('Could not confirm meal swap', expect.anything());
  });

  it.each(['CLINICAL_EVIDENCE_REQUIRED', 'PROFILE_REVIEW_REQUIRED'])(
    'preserves the %s gate on a post-swap read without retrying it',
    async (errorCode) => {
      const { result } = await prepareSwap();
      getMock.mockImplementation(async (url: string) => {
        if (url === '/user/meals/workspace')
          throw Object.assign(new AxiosError('gate'), {
            response: { status: 403, data: { errorCode, error: 'Review required' } },
          });
        return successfulResponseFor(url);
      });
      getMock.mockClear();
      postMock.mockResolvedValueOnce({ data: { success: true } });
      await act(async () => result.current.handleConfirmSwapAnyway());
      expect(getMock.mock.calls.filter(([url]) => url === '/user/meals/workspace')).toHaveLength(1);
      expect(result.current.meals).toEqual([]);
      expect(result.current.cycles).toBeNull();
      expect(
        errorCode === 'CLINICAL_EVIDENCE_REQUIRED'
          ? result.current.clinicalEvidenceRequired
          : result.current.profileReviewRequired
      ).toBe(true);
      expect(readSessionResource('user-1', 'user-meals-workspace')).toBeNull();
      expect(result.current.error).toBeTruthy();
    }
  );

  it('blocks duplicate submissions and keeps one toast pending until the fresh plan is displayed', async () => {
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
    expect(result.current.refreshingSwapMealId).toBeNull();
    expect(toastMock.success).not.toHaveBeenCalled();
    await act(async () => finishPost({ data: { success: true, data: { swapsRemaining: 5 } } }));
    await waitFor(() => expect(finishRead).toBeTypeOf('function'));
    expect(toastMock.loading).toHaveBeenLastCalledWith('Meal swapped. Refreshing plan…', expect.anything());
    expect(result.current.isSwapping).toBe(true);
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(notificationEvent).toHaveBeenCalledTimes(1);
    expect(result.current.activeSwapMeal).toBeNull();
    expect(result.current.refreshingSwapMealId).toBe('slot');
    await act(async () => {
      finishRead(successfulResponseFor('/user/meals/workspace'));
      await pending;
    });
    expect(toastMock.success).toHaveBeenCalledWith(
      'Meal swapped',
      expect.objectContaining({ description: expect.stringContaining('5 swaps left') })
    );
    expect(result.current.isSwapping).toBe(false);
    expect(result.current.activeSwapMeal).toBeNull();
    expect(result.current.refreshingSwapMealId).toBeNull();
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
    expect(result.current.refreshingSwapMealId).toBeNull();
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
  ])('clears preparation loading and permits retry after %s', async (_name, response) => {
    postMock.mockImplementationOnce(response);
    const { result } = renderHook(() => useMealsWorkspace());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => result.current.handleRetryPreparation());
    expect(result.current.isPreparing).toBe(false);
    expect(result.current.error).toBeTruthy();
    postMock.mockResolvedValueOnce({ data: { success: true } });
    await act(async () => result.current.handleRetryPreparation());
    expect(postMock).toHaveBeenCalledTimes(2);
    expect(result.current.isPreparing).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

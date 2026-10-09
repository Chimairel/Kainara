import api from '@/lib/axios';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNutritionistReviews } from './useNutritionistReviews';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'nutritionist-1' } }) }));

const preview = {
  mealPlan: { id: 'meal-1', status: 'PENDING_REVIEW' },
  claimStatus: { claimedByMe: false, claimedByOther: false, claimedByName: null, claimExpiresAt: null },
};

describe('RND review claim controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockImplementation(async (url) => ({
      data: { success: true, data: url === '/nutritionist/queue' ? [] : preview },
    }));
    vi.mocked(api.post).mockImplementation(async (url) => ({
      data: {
        success: true,
        data: url.endsWith('/claim')
          ? {
              ...preview,
              claimStatus: { ...preview.claimStatus, claimedByMe: true },
            }
          : { released: true },
      },
    }));
  });

  it('fetches only while the case workspace is active and preserves selection on return', async () => {
    const { result, rerender } = renderHook(({ enabled }) => useNutritionistReviews(enabled), {
      initialProps: { enabled: false },
    });
    expect(api.get).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.handleSelectMeal('meal-1');
    });
    rerender({ enabled: false });
    expect(result.current.selectedMealId).toBe('meal-1');
    vi.mocked(api.get).mockClear();
    rerender({ enabled: true });
    await waitFor(() => expect(api.get).toHaveBeenCalledWith('/nutritionist/queue', { signal: undefined }));
    expect(result.current.selectedMealId).toBe('meal-1');
  });

  it('previews without claiming, claims explicitly, then releases and clears selection', async () => {
    const { result } = renderHook(() => useNutritionistReviews());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.handleSelectMeal('meal-1');
    });
    expect(api.get).toHaveBeenCalledWith('/nutritionist/queue/meal-1');
    expect(api.post).not.toHaveBeenCalled();
    expect(result.current.detailData?.claimStatus.claimedByMe).toBe(false);

    await act(async () => {
      await result.current.handleClaimMeal();
    });
    expect(api.post).toHaveBeenCalledWith('/nutritionist/queue/meal-1/claim');
    expect(result.current.detailData?.claimStatus.claimedByMe).toBe(true);

    await act(async () => {
      await result.current.handleReleaseMeal();
    });
    expect(api.post).toHaveBeenCalledWith('/nutritionist/queue/meal-1/release');
    expect(result.current.selectedMealId).toBeNull();
    expect(result.current.detailData).toBeNull();
  });

  it('explains a detail timeout and blocks claiming until a successful retry', async () => {
    const { result } = renderHook(() => useNutritionistReviews());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    vi.mocked(api.get).mockRejectedValueOnce({ code: 'ECONNABORTED' });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await act(async () => {
      await result.current.handleSelectMeal('meal-1');
    });
    expect(result.current.errorMsg).toBe('Loading this review took too long. Please retry.');
    await act(async () => {
      await result.current.handleClaimMeal();
    });
    expect(api.post).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.handleSelectMeal('meal-1');
    });
    expect(result.current.errorMsg).toBeNull();
    expect(result.current.detailData?.mealPlan.id).toBe('meal-1');
    await act(async () => {
      await result.current.handleClaimMeal();
    });
    expect(api.post).toHaveBeenCalledWith('/nutritionist/queue/meal-1/claim');
    log.mockRestore();
  });

  it('shares an in-flight initial queue read with refresh callers', async () => {
    let resolve!: (value: unknown) => void;
    vi.mocked(api.get).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const { result } = renderHook(() => useNutritionistReviews());
    let pending!: Promise<void>;
    act(() => {
      pending = result.current.fetchQueue(true);
      void result.current.fetchQueue();
    });
    expect(api.get).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve({ data: { success: true, data: [] } });
      await pending;
    });
    expect(result.current.queueError).toBeNull();
  });

  it('shows a queue timeout and clears it after retry', async () => {
    vi.mocked(api.get).mockRejectedValueOnce({ code: 'ECONNABORTED' });
    const { result } = renderHook(() => useNutritionistReviews());
    await waitFor(() =>
      expect(result.current.queueError).toBe('Loading the review queue took too long. Please retry.')
    );
    await act(async () => {
      await result.current.fetchQueue();
    });
    expect(result.current.queueError).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('refreshes after a claim and ignores an older queue response', async () => {
    let resolveOld!: (value: unknown) => void;
    vi.mocked(api.get).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolveOld = done;
        })
    );
    const { result } = renderHook(() => useNutritionistReviews());
    await act(async () => {
      await result.current.handleSelectMeal('meal-1');
    });
    await act(async () => {
      await result.current.handleClaimMeal();
    });
    expect(api.get).toHaveBeenCalledTimes(3);
    await act(async () => {
      resolveOld({ data: { success: true, data: [{ id: 'stale-before-claim' }] } });
    });
    expect(result.current.queue).toEqual([]);
    expect(result.current.detailData?.claimStatus.claimedByMe).toBe(true);
  });
});

it('closes a previously open case when its claim request reports expiry and refreshes the active queue', async () => {
  vi.resetAllMocks();
  vi.mocked(api.get).mockImplementation(async (url) => ({
    data: { success: true, data: url === '/nutritionist/queue' ? [] : preview },
  }));
  vi.mocked(api.post).mockRejectedValueOnce({
    response: { data: { code: 'MEAL_REVIEW_INACTIVE', error: 'This meal approval request expired.' } },
  });
  const { result } = renderHook(() => useNutritionistReviews());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  await act(() => result.current.handleSelectMeal('meal-1'));
  expect(result.current.selectedMealId).toBe('meal-1');
  await act(() => result.current.handleClaimMeal());
  expect(result.current.selectedMealId).toBeNull();
  expect(result.current.detailData).toBeNull();
  expect(result.current.queue).toEqual([]);
  expect(result.current.errorMsg).toBeNull();
});

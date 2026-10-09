import api from '@/lib/axios';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNutritionistReviews } from './useNutritionistReviews';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
const auth = vi.hoisted(() => ({ owner: 'nutritionist-1' }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: auth.owner } }) }));

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


it('binds decisions to the opened context and retains notes when a stale decision closes the case', async () => {
  vi.resetAllMocks();
  const context = { contextKey: 'a'.repeat(64), profileRevision: 1, scopeKey: 'profile-scope' };
  vi.mocked(api.get).mockImplementation(async (url) => ({ data: { success: true, data: url === '/nutritionist/queue' ? [] : { ...preview, reviewContext: context } } }));
  vi.mocked(api.patch).mockRejectedValue({ response: { data: { code: 'MEAL_REVIEW_CONTEXT_CHANGED' } } });
  const { result } = renderHook(() => useNutritionistReviews());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  await act(async () => { await result.current.handleSelectMeal('meal-1'); });
  act(() => { result.current.setGeneralNote('Reduce the portion if clinically indicated.'); result.current.setRejectNote('Check the new treatment before deciding.'); });
  await act(async () => { await result.current.handleApprove(); });
  expect(api.patch).toHaveBeenCalledWith('/nutritionist/review/meal-1', { action: 'approve', note: 'Reduce the portion if clinically indicated.', expectedContextKey: context.contextKey });
  expect(result.current.selectedMealId).toBeNull();
  expect(result.current.detailData).toBeNull();
  expect(result.current.reviewNotice).toContain('no longer current');
  expect(result.current.savedReviewNotes[0]).toMatchObject({ contextKey: context.contextKey, note: 'Reduce the portion if clinically indicated.', rejection: 'Check the new treatment before deciding.' });
  expect(result.current.generalNote).toBe('');
});

it('does not resurrect an older selection after a slow detail response', async () => {
  vi.resetAllMocks();
  let resolveOld!: (value: unknown) => void;
  vi.mocked(api.get).mockImplementation(async (url) => {
    if (url === '/nutritionist/queue') return { data: { success: true, data: [] } };
    if (url.endsWith('meal-old')) return new Promise((resolve) => { resolveOld = resolve; });
    return { data: { success: true, data: { ...preview, mealPlan: { ...preview.mealPlan, id: 'meal-new' } } } };
  });
  const { result } = renderHook(() => useNutritionistReviews());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  let pending!: Promise<void>;
  act(() => { pending = result.current.handleSelectMeal('meal-old'); });
  await act(async () => { await result.current.handleSelectMeal('meal-new'); });
  await act(async () => { resolveOld({ data: { success: true, data: preview } }); await pending; });
  expect(result.current.selectedMealId).toBe('meal-new');
  expect(result.current.detailData?.mealPlan.id).toBe('meal-new');
});

it('closes changed contexts on live refresh without overwriting the opened review', async () => {
  vi.resetAllMocks();
  let key = 'a'.repeat(64);
  vi.mocked(api.get).mockImplementation(async (url) => ({ data: { success: true, data: url === '/nutritionist/queue' ? [] : { ...preview, reviewContext: { contextKey: key, profileRevision: 1, scopeKey: 'scope' } } } }));
  const { result } = renderHook(() => useNutritionistReviews());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  await act(async () => { await result.current.handleSelectMeal('meal-1'); });
  act(() => result.current.setGeneralNote('Unfinished live-review note'));
  key = 'b'.repeat(64);
  act(() => window.dispatchEvent(new Event('focus')));
  await waitFor(() => expect(result.current.selectedMealId).toBeNull());
  expect(result.current.savedReviewNotes[0].note).toBe('Unfinished live-review note');
  expect(result.current.detailData).toBeNull();
});


it('clears saved clinical drafts on account change and ignores an old claim response', async () => {
  vi.resetAllMocks();
  vi.mocked(api.get).mockImplementation(async (url) => ({ data: { success: true, data: url === '/nutritionist/queue' ? [] : preview } }));
  let resolveClaim!: (value: unknown) => void;
  vi.mocked(api.post).mockImplementation(() => new Promise(resolve => { resolveClaim = resolve; }));
  const { result, rerender } = renderHook(() => useNutritionistReviews());
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  await act(async () => { await result.current.handleSelectMeal('meal-1'); });
  act(() => result.current.setGeneralNote('Private account A draft'));
  act(() => { result.current.retireInactiveReview({ response: { data: { code: 'MEAL_REVIEW_CONTEXT_CHANGED' } } }, 'meal-1'); });
  expect(result.current.savedReviewNotes).toHaveLength(1);
  await act(async () => { await result.current.handleSelectMeal('meal-1'); });
  let pending!: Promise<void>;
  act(() => { pending = result.current.handleClaimMeal(); });
  auth.owner = 'nutritionist-2'; rerender();
  await act(async () => { resolveClaim({ data: { success: true, data: preview } }); await pending; });
  expect(result.current.savedReviewNotes).toEqual([]);
  expect(result.current.reviewNotice).toBeNull();
  expect(result.current.detailData).toBeNull();
  expect(result.current.actionLoading).toBeNull();
  auth.owner = 'nutritionist-1';
});

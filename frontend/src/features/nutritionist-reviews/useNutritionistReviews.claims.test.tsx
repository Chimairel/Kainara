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

describe('nutritionist review claim controls', () => {
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
});

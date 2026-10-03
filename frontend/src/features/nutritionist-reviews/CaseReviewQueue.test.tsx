import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CaseReviewQueue from './CaseReviewQueue';
import type { useNutritionistReviews } from './useNutritionistReviews';

describe('single nutritionist case queue', () => {
  it('keeps an older partial review selectable while respecting peer claims', () => {
    const select = vi.fn();
    const meal = {
      id: 'partial',
      mealName: 'Tinola',
      mealType: 'LUNCH',
      highRiskReviewRequired: true,
      reviewApprovalCount: 1,
      requiresIndependentSecondReview: true,
      sourceProvenance: 'RAW_RECIPE_CORPUS',
      shoppingDeadlineAt: '2026-10-03',
      cookDeadlineAt: '2026-10-03',
      assuranceTier: 'ENHANCED',
      remainingReviewers: 1,
      user: { id: 'member', name: 'Synthetic Member' },
      calories: 600,
      claimStatus: { claimedByOther: false, claimedByMe: false },
    };
    const review = {
      queue: [
        meal,
        {
          ...meal,
          id: 'claimed',
          mealName: 'Adobo',
          claimStatus: { claimedByOther: true, claimedByMe: false, claimedByName: 'Another nutritionist' },
        },
      ],
      fetchQueue: vi.fn(),
      isLoading: false,
      selectedMealId: null,
      errorMsg: '',
      handleSelectMeal: select,
    } as unknown as ReturnType<typeof useNutritionistReviews>;
    render(<CaseReviewQueue review={review} caseFilter="pending" expanded={false} />);
    fireEvent.click(screen.getByRole('button', { name: /Tinola/ }));
    expect(select).toHaveBeenCalledWith('partial');
    expect(screen.getByRole('button', { name: /Adobo/ })).toBeDisabled();
    expect(screen.queryByText(/second review/i)).not.toBeInTheDocument();
    expect(screen.getAllByText('One nutritionist approval required')).toHaveLength(2);
  });
});

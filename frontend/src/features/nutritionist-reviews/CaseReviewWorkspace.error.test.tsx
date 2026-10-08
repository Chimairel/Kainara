import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CaseReviewWorkspace from './CaseReviewWorkspace';
import type { useNutritionistReviews } from './useNutritionistReviews';

describe('case detail load failure', () => {
  it('offers retry without claiming that access was blocked', () => {
    const retry = vi.fn();
    const back = vi.fn();
    const review = {
      queue: [],
      isLoading: false,
      selectedMealId: 'meal-1',
      detailLoading: false,
      detailData: null,
      errorMsg: 'Loading this review took too long. Please retry.',
      actionLoading: null,
      handleSelectMeal: retry,
      setSelectedMealId: back,
    } as unknown as ReturnType<typeof useNutritionistReviews>;
    render(
      <CaseReviewWorkspace
        review={review}
        caseFilter="pending"
        expanded={false}
        setExpanded={vi.fn()}
        navigation={null}
        caseFilters={null}
      />
    );
    expect(screen.getByRole('heading', { name: 'Review details unavailable' })).toBeVisible();
    expect(screen.queryByText('Access Blocked')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Claim review' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry details' }));
    expect(retry).toHaveBeenCalledWith('meal-1');
    fireEvent.click(screen.getByRole('button', { name: 'Back to Queue', exact: true }));
    expect(back).toHaveBeenCalledWith(null);
  });
});

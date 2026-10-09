import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CaseReviewWorkspace from './CaseReviewWorkspace';
import type { useNutritionistReviews } from './useNutritionistReviews';

describe('case detail load failure', () => {
  it('returns to the queue after selection clears, even if previous details and fullscreen state remain', () => {
    const close = vi.fn();
    const review = {
      queue: [],
      isLoading: false,
      selectedMealId: null,
      detailLoading: false,
      detailData: { mealPlan: { id: 'previous-meal' } },
      errorMsg: null,
      actionLoading: null,
    } as unknown as ReturnType<typeof useNutritionistReviews>;
    render(
      <CaseReviewWorkspace
        review={review}
        caseFilter="pending"
        expanded
        setExpanded={close}
        navigation={null}
        caseFilters={null}
      />
    );
    expect(screen.queryByRole('region', { name: 'Document viewer' })).not.toBeInTheDocument();
    expect(close).toHaveBeenCalledWith(false);
  });

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
    fireEvent.click(screen.getByRole('button', { name: 'Back to Queue' }));
    expect(back).toHaveBeenCalledWith(null);
  });
});


it('returns fullscreen to the default panel and exposes the saved draft without reloading', () => {
  const close = vi.fn();
  const review = {
    queue: [], isLoading: false, selectedMealId: null, detailLoading: false, detailData: null, errorMsg: null, actionLoading: null,
    reviewNotice: 'This review is no longer current.', dismissReviewNotice: vi.fn(),
    savedReviewNotes: [{ mealId: 'old', mealName: 'Recorded old meal', note: 'Unfinished member guidance', rejection: 'Unfinished clinical reason' }],
  } as unknown as ReturnType<typeof useNutritionistReviews>;
  render(<CaseReviewWorkspace review={review} caseFilter="pending" expanded setExpanded={close} navigation={null} caseFilters={null} />);
  expect(close).toHaveBeenCalledWith(false);
  expect(screen.getByRole('heading', { name: 'A clear path to every review' })).toBeVisible();
  expect(screen.getByText('This review is no longer current.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'View saved notes' }));
  expect(screen.getByRole('dialog', { name: 'Unfinished review notes' })).toBeVisible();
  expect(screen.getByText('Unfinished member guidance')).toBeVisible();
  expect(screen.getByText('Unfinished clinical reason')).toBeVisible();
});

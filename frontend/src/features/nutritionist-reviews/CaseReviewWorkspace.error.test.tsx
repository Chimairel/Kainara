import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CaseReviewWorkspace from './CaseReviewWorkspace';
import type { useNutritionistReviews } from './useNutritionistReviews';

describe('case detail load failure', () => {
  it('shows an independence restriction before the other-claim state and offers no retry or claim', () => {
    const back = vi.fn();
    const claim = vi.fn();
    const review = {
      queue: [{ id: 'another-case', mealName: 'Other case', mealType: 'LUNCH', user: { name: 'Synthetic member' },
        sourceProvenance: 'RAW_RECIPE_CORPUS', assuranceTier: 'BASE', remainingReviewers: 1,
        claimStatus: { claimedByMe: true, claimedByOther: false } }],
      isLoading: false, selectedMealId: 'flagged-case', detailLoading: false, detailData: null,
      claimBlocked: true, errorMsg: null, actionLoading: null, setSelectedMealId: back, handleClaimMeal: claim,
    } as unknown as ReturnType<typeof useNutritionistReviews>;
    render(<CaseReviewWorkspace review={review} caseFilter="pending" expanded={false} setExpanded={vi.fn()} navigation={null} caseFilters={null} />);
    const button = screen.getByRole('button', { name: 'Another RND required' });
    expect(button).toBeDisabled();
    expect(button).toHaveClass('!bg-[#fff4df]');
    expect(screen.getByRole('region', { name: 'Independent review required' })).toBeVisible();
    expect(screen.queryByText('Review details unavailable')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry details' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(button);
    expect(claim).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('region', { name: 'Independent review required' })).getByRole('button', { name: 'Back to queue' }));
    expect(back).toHaveBeenCalledWith(null);
  });
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
    expect(screen.getByRole('button', { name: 'Claim review' })).toHaveTextContent('Claim review');
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
    savedReviewNotes: [{ mealId: 'old', mealName: 'Recorded old meal', note: 'Unfinished member guidance', rejection: 'Unfinished clinical reason', clarification: { title: 'Unfinished clarification', questions: [{ id: 'q', type: 'CHOICE', required: true, label: 'Recorded follow-up question', choices: 'Yes\nNo' }] } }],
  } as unknown as ReturnType<typeof useNutritionistReviews>;
  render(<CaseReviewWorkspace review={review} caseFilter="pending" expanded setExpanded={close} navigation={null} caseFilters={null} />);
  expect(close).toHaveBeenCalledWith(false);
  expect(screen.getByRole('heading', { name: 'A clear path to every review' })).toBeVisible();
  expect(screen.getByText('This review is no longer current.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'View saved notes' }));
  expect(screen.getByRole('dialog', { name: 'Unfinished review notes' })).toBeVisible();
  expect(screen.getByText('Unfinished member guidance')).toBeVisible();
  expect(screen.getByText('Unfinished clarification')).toBeVisible();
  expect(screen.getByText('Recorded follow-up question')).toBeVisible();
  expect(screen.getByText('Unfinished clinical reason')).toBeVisible();
});

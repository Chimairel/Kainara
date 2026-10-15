import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CaseReviewQueue from './CaseReviewQueue';
import type { useNutritionistReviews } from './useNutritionistReviews';

describe('single RND case queue', () => {
  it('pins my claimed case before other cases and keeps it visible during search', () => {
    const meal = { id: 'available', mealName: 'Available meal', mealType: 'LUNCH', user: { name: 'Member' },
      claimStatus: { claimedByMe: false, claimedByOther: false }, coalescedDependentCount: 1,
      assuranceTier: 'BASE', remainingReviewers: 1, sourceProvenance: 'RAW_RECIPE_CORPUS' };
    const review = { queue: [meal, { ...meal, id: 'mine', mealName: 'My claimed meal', claimStatus: { claimedByMe: true, claimedByOther: false } }],
      fetchQueue: vi.fn(), isLoading: false, handleSelectMeal: vi.fn() } as unknown as ReturnType<typeof useNutritionistReviews>;
    render(<CaseReviewQueue review={review} caseFilter="pending" expanded={false} />);
    const rows = screen.getAllByRole('button').filter(button => button.getAttribute('aria-pressed') !== null);
    expect(rows[0]).toHaveTextContent('My claimed meal');
    expect(screen.getByRole('img', { name: 'Claimed by you' })).toBeVisible();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'no match' } });
    expect(screen.getByRole('button', { name: /My claimed meal/ })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Available meal/ })).not.toBeInTheDocument();
  });
  it('offers retry rather than claiming an unavailable queue is clear', () => {
    const retry = vi.fn();
    const review = {
      queue: [],
      isLoading: false,
      selectedMealId: null,
      queueError: 'The review queue could not be refreshed. Please retry.',
      fetchQueue: retry,
    } as unknown as ReturnType<typeof useNutritionistReviews>;
    render(<CaseReviewQueue review={review} caseFilter="pending" expanded={false} />);
    expect(screen.getByRole('alert')).toHaveTextContent('could not be refreshed');
    expect(screen.queryByText('Queue clear')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry queue' }));
    expect(retry).toHaveBeenCalledOnce();
  });
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
      requiresSafetyRevalidation: true,
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
          claimStatus: { claimedByOther: true, claimedByMe: false, claimedByName: 'Another RND' },
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
    expect(screen.queryByText('One RND approval required')).not.toBeInTheDocument();
    expect(screen.queryByText('Updated review needed')).not.toBeInTheDocument();
    expect(screen.getAllByText('Synthetic Member')).toHaveLength(2);
    expect(screen.getAllByText('Shop by Oct 3, 2026')).toHaveLength(2);
    expect(screen.getAllByText('Cook Oct 3, 2026')).toHaveLength(2);
    expect(screen.queryByText(/600 kcal|raw recipe corpus|enhanced assurance/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/recheck/i)).not.toBeInTheDocument();
  });
});

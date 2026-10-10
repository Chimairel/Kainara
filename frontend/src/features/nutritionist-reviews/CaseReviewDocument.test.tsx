import type { ComponentProps } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import CaseReviewDocument from './CaseReviewDocument';

vi.mock('./sections/CaseProfileSection', () => ({ default: () => <p>Recorded profile</p> }));
vi.mock('./sections/CaseAuditSection', () => ({ default: () => <p>Recorded meal evidence</p> }));
vi.mock('./sections/CaseDecisionSection', () => ({ default: () => <p>Decision controls</p> }));
vi.mock('./useReviewSwap', () => ({ useReviewSwap: () => ({}) }));

it('shows a claimed-case release failure inside the fullscreen canvas', () => {
  const error = 'Could not release this meal. Refresh the queue and try again.';
  const model = {
    selectedMealId: 'synthetic-case',
    expanded: true,
    setExpanded: vi.fn(),
    setSelectedMealId: vi.fn(),
    claimHeader: <button>Release claim</button>,
    errorMsg: error,
    review: { fetchQueue: vi.fn(), handleSelectMeal: vi.fn(), retireInactiveReview: vi.fn() },
    detailData: {
      mealPlan: { id: 'synthetic-case', mealName: 'Synthetic plate', mealType: 'LUNCH', scheduledDate: '2026-10-10' },
      user: { name: 'Synthetic member' },
      claimStatus: { claimedByMe: true },
      warnings: [],
    },
  } as unknown as ComponentProps<typeof CaseReviewDocument>['model'];
  render(<CaseReviewDocument model={model} />);
  const canvas = screen.getByRole('dialog', { name: /Case approval.*fullscreen/ });
  expect(within(canvas).getByRole('alert')).toHaveTextContent(error);
  expect(within(canvas).getByRole('button', { name: 'Release claim' })).toBeVisible();
});

it('keeps claim errors visible inside the preview canvas', () => {
  const model = {
    selectedMealId: 'synthetic-case',
    expanded: false,
    setExpanded: vi.fn(),
    setSelectedMealId: vi.fn(),
    claimHeader: <button>Claim review</button>,
    errorMsg: 'This case is being reviewed by another RND.',
    review: { fetchQueue: vi.fn(), handleSelectMeal: vi.fn(), retireInactiveReview: vi.fn() },
    detailData: {
      mealPlan: { id: 'synthetic-case', mealName: 'Synthetic plate', mealType: 'LUNCH', scheduledDate: '2026-10-10' },
      user: { name: 'Synthetic member' },
      claimStatus: { claimedByMe: false },
      warnings: [],
    },
  } as unknown as ComponentProps<typeof CaseReviewDocument>['model'];
  render(<CaseReviewDocument model={model} />);
  const canvas = screen.getByRole('region', { name: 'RND review canvas' });
  expect(within(canvas).getByRole('alert')).toHaveTextContent('This case is being reviewed by another RND.');
  fireEvent.click(screen.getByRole('button', { name: 'Back to queue' }));
  expect(model.setSelectedMealId).toHaveBeenCalledWith(null);
});

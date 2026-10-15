import type { ComponentProps } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/lib/context/ThemeContext';
import OutsideMealReviewDetail from './OutsideMealReviewDetail';

it('uses the shared canvas with information first and opens feedback only from its tool', () => {
  const model = {
    selected: {
      id: 'request',
      claimStatus: { claimedByOther: false },
      messages: [],
      outsideMealLogItem: {
        name: 'Test food',
        calories: 200,
        proteinG: 10,
        carbsG: 20,
        fatG: 8,
        currentRevision: 2,
        ingredients: ['Rice', 'Egg'],
        mealLog: { loggedAt: '2026-10-15T01:00:00Z', mealType: 'LUNCH' },
      },
    },
    feedback: 'Try a smaller portion.',
    setFeedback: vi.fn(),
    sendFeedback: vi.fn(),
    selectReview: vi.fn(),
    busy: false,
  } as unknown as ComponentProps<typeof OutsideMealReviewDetail>['model'];
  const setExpanded = vi.fn();
  const { rerender } = render(
    <ThemeProvider>
      <OutsideMealReviewDetail model={model} expanded={false} setExpanded={setExpanded} />
    </ThemeProvider>
  );
  expect(screen.getByRole('article', { name: 'Logged food' })).toHaveTextContent('200 kcal');
  expect(screen.queryByRole('article', { name: 'RND feedback' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Claim|Approve|Reject/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Write feedback' }));
  expect(screen.getByRole('textbox', { name: 'Feedback for the member' })).toHaveValue('Try a smaller portion.');
  rerender(
    <ThemeProvider>
      <OutsideMealReviewDetail model={model} expanded setExpanded={setExpanded} />
    </ThemeProvider>
  );
  const canvas = screen.getByRole('dialog', { name: /Outside food.*fullscreen/ });
  expect(within(canvas).getAllByRole('article', { name: 'RND feedback' })).toHaveLength(1);
  fireEvent.click(within(canvas).getByRole('button', { name: 'Send feedback' }));
  expect(model.sendFeedback).toHaveBeenCalledTimes(1);
  fireEvent.click(within(canvas).getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('article', { name: 'RND feedback' })).not.toBeInTheDocument();
});

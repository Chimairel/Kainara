import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import ReusableReviewReferences from './ReusableReviewReferences';

it('shows recorded attribution and zero nutrients without private source details or approval controls', () => {
  render(
    <ReusableReviewReferences
      references={[
        {
          reviewedAt: '2026-10-10T00:00:00Z',
          reviewerName: 'Recorded reviewer',
          decision: 'APPROVE',
          match: 'Exact recorded profile, clinical inputs, clarifications and recipe serving',
          use: 'Reference only; a separate current review decision is required',
          plateFacts: { calories: 600, proteinG: 30, carbsG: 0, fatG: 15 },
        },
      ]}
    />
  );
  fireEvent.click(screen.getByText(/Approved by Recorded reviewer, RND/));
  expect(screen.getByText('0 g')).toBeInTheDocument();
  expect(screen.getByText(/a separate current review decision is required/)).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

it('does not invent a missing reviewer name or missing historical references', () => {
  render(<ReusableReviewReferences references={[]} />);
  expect(screen.getByText('No matching prior review is available.')).toBeInTheDocument();
});

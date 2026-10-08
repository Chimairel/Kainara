import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import ReviewRoutingLabel from './ReviewRoutingLabel';

it('labels experience fallback without claiming condition expertise and keeps the general-access deadline', () => {
  const { rerender } = render(
    <ReviewRoutingLabel
      routing={{
        stage: 'SPECIALIST',
        reason: 'EXPERIENCE_PRIORITY',
        opensAt: '2026-10-09T10:00:00Z',
      }}
    />
  );
  expect(screen.getByText('Verified experience priority')).toBeInTheDocument();
  expect(screen.queryByText('Matching specialist priority')).not.toBeInTheDocument();
  expect(screen.getByText(/General access by.*PHT/)).toBeInTheDocument();
  rerender(<ReviewRoutingLabel routing={{ stage: 'GENERAL', reason: 'WINDOW_EXPIRED', opensAt: null }} />);
  expect(screen.getByText('Open to eligible RNDs')).toBeInTheDocument();
  expect(screen.queryByText(/General access by/)).not.toBeInTheDocument();
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FeedbackNotice from './FeedbackNotice';

describe('feedback announcements and recovery', () => {
  it('announces a failure once and retains an actionable recovery control', () => {
    const retry = vi.fn();
    render(
      <FeedbackNotice title="Could not load your meals">
        <p>Please try again.</p>
        <button onClick={retry}>Retry</button>
      </FeedbackNotice>
    );
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load your meals');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('keeps an urgent warning assertive when its feature requires it', () => {
    render(
      <FeedbackNotice tone="warning" role="alert" variant="inline">
        Could not refresh. Showing the last saved queue.
      </FeedbackNotice>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Showing the last saved queue');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('announces ordinary information politely and preserves recovery links', () => {
    render(
      <FeedbackNotice tone="info">
        <a href="/forgot-password">Reset your password</a>
      </FeedbackNotice>
    );
    expect(screen.getByRole('status')).toHaveTextContent('Reset your password');
    expect(screen.getByRole('link')).toHaveAttribute('href', '/forgot-password');
  });

  it('keeps long server feedback and disabled actions available without dismissing them', () => {
    render(
      <FeedbackNotice>
        <span>Service unavailable; no changes have been saved.</span>
        <button disabled>Save</button>
      </FeedbackNotice>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('no changes have been saved');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /dismiss|close/i })).not.toBeInTheDocument();
  });
});

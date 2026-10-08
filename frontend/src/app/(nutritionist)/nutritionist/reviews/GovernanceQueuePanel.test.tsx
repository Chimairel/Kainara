import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import GovernanceQueuePanel from './GovernanceQueuePanel';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: api }));

describe('equal RND review permissions', () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
  });

  it('allows dispute submission despite a legacy false lead flag', async () => {
    api.get.mockResolvedValue({
      data: {
        data: {
          canLeadReview: false,
          clearances: [],
          plans: [{ id: 'legacy-case', mealName: 'Tinola', mealType: 'LUNCH', user: { name: 'Synthetic Member' } }],
        },
      },
    });
    api.post.mockResolvedValue({ data: { success: true } });
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('Reviewed the recorded dispute evidence.');
    try {
      render(<GovernanceQueuePanel tab="disputed" />);
      fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
      await waitFor(() =>
        expect(api.post).toHaveBeenCalledWith('/nutritionist/review/legacy-case/dispute-resolution', {
          decision: 'APPROVE',
          rationale: 'Reviewed the recorded dispute evidence.',
        })
      );
    } finally {
      prompt.mockRestore();
    }
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NutritionistAuditPage from './page';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: mocks }));
vi.mock('@/features/nutritionist-reviews/useReviewWorkCounts', () => ({
  useReviewWorkCounts: () => ({ meal: 1, case: 2, profile: 3, audit: 125 }),
}));
vi.mock('../reviews/GovernanceQueuePanel', () => ({
  default: ({ tab }: { tab: string }) => <div data-testid="recheck-queue">{tab}</div>,
}));

describe('nutritionist audit page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockImplementation((_path: string, options: { params: { page: number } }) => Promise.resolve({ data: { data: {
      rows: [{ id: `row-${options.params.page}`, occurredAt: '2026-09-29T00:00:00.000Z',
        nutritionist: 'Andrea Reyes', action: 'Flagged a meal', subject: 'Basilog', outcome: 'Needs attention' }],
      page: options.params.page, total: 21, totalPages: 2,
    } } }));
  });

  it('shows review history across nutritionists, pages results, and opens due rechecks', async () => {
    render(<NutritionistAuditPage />);
    expect(await screen.findByText('Andrea Reyes')).toBeInTheDocument();
    expect(screen.getByText('Flagged a meal')).toBeInTheDocument();
    expect(screen.getByText('Basilog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('/nutritionist/audit-history',
      { params: { page: 2, limit: 20 } }));
    expect(await screen.findByText(/Page 2 of 2/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Due rechecks.*99\+/ }));
    expect(screen.getByTestId('recheck-queue')).toHaveTextContent('audit');
  });
});

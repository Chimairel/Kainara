import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { clearSessionResourceCache } from '@/lib/session-resource-cache';
import SubscriptionHistoryCard, { type SubscriptionHistory } from './SubscriptionHistoryCard';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: mocks }));
const data: SubscriptionHistory = {
  member: { id: 'member', name: 'Synthetic member' },
  total: 2,
  page: 1,
  totalPages: 1,
  serverTime: '2026-10-09T00:00:00Z',
  rows: [
    {
      id: 'trial',
      plan: 'Free Health Plan',
      period: '30 days',
      source: 'Introductory access',
      status: 'ENDED',
      startsAt: '2026-09-01T00:00:00Z',
      endsAt: '2026-10-01T00:00:00Z',
      recordedAt: '2026-09-01T00:00:00Z',
      revokedAt: null,
      supersededAt: null,
      amountCentavos: null,
      currency: null,
      note: null,
    },
    {
      id: 'paid',
      plan: 'Health',
      period: 'Monthly',
      source: 'Test checkout',
      status: 'ACTIVE',
      startsAt: '2026-10-01T00:00:00Z',
      endsAt: '2026-10-31T00:00:00Z',
      recordedAt: '2026-10-01T00:00:00Z',
      revokedAt: null,
      supersededAt: null,
      amountCentavos: 0,
      currency: 'PHP',
      note: null,
    },
  ],
};
beforeEach(() => {
  vi.resetAllMocks();
  clearSessionResourceCache();
  mocks.get.mockResolvedValue({ data: { success: true, data } });
});
it('uses the same recorded trial and test-payment presentation for member and admin', async () => {
  render(<SubscriptionHistoryCard endpoint="/admin/membership-history/member" ownerId="admin" admin />);
  await screen.findByRole('heading', { name: 'Free Health Plan' });
  expect(screen.getByText('30 days · Introductory access')).toBeVisible();
  expect(screen.getByText('Monthly · Test checkout')).toBeVisible();
  expect(screen.getByText('₱0.00')).toBeVisible();
  expect(screen.getByText(/Synthetic member/)).toBeVisible();
  expect(screen.queryByText(/Meal eaten/)).not.toBeInTheDocument();
});
it('does not invent dates for an unstarted trial and retries a failed read', async () => {
  mocks.get.mockRejectedValueOnce(new Error('Unavailable'));
  render(<SubscriptionHistoryCard endpoint="/user/membership/history" ownerId="member" />);
  await screen.findByRole('alert');
  expect(screen.queryByText('No subscription periods have been recorded yet.')).not.toBeInTheDocument();
  mocks.get.mockResolvedValueOnce({
    data: {
      success: true,
      data: { ...data, total: 1, rows: [{ ...data.rows[0], status: 'NOT_STARTED', startsAt: null, endsAt: null }] },
    },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Retry history' }));
  expect(await screen.findByText('Not recorded')).toBeVisible();
  expect(screen.getAllByText('Not started')).toHaveLength(2);
});
it('discards a late previous-owner read and pages through the bounded endpoint', async () => {
  let finish!: (value: unknown) => void;
  mocks.get.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const view = render(<SubscriptionHistoryCard endpoint="/user/membership/history" ownerId="member" />);
  await waitFor(() => expect(mocks.get).toHaveBeenCalled());
  mocks.get.mockResolvedValue({ data: { success: true, data: { ...data, rows: [], total: 11, totalPages: 2 } } });
  view.rerender(<SubscriptionHistoryCard endpoint="/user/membership/history" ownerId="other" />);
  await screen.findByText('No subscription periods have been recorded yet.');
  await act(async () => finish({ data: { success: true, data } }));
  expect(screen.queryByRole('heading', { name: 'Free Health Plan' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await waitFor(() =>
    expect(mocks.get).toHaveBeenLastCalledWith('/user/membership/history', { params: { page: 2, limit: 10 } })
  );
});

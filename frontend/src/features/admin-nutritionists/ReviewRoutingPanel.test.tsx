import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import ReviewRoutingPanel from './ReviewRoutingPanel';
import api from '@/lib/axios';

const auth = vi.hoisted(() => ({ owner: 'admin-one' }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: auth.owner } }) }));
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), patch: vi.fn() } }));
const snapshot = (enabled: boolean, name = 'Synthetic member') => ({
  data: {
    success: true,
    data: {
      config: { enabled },
      episodes: [
        {
          id: 'episode',
          user: { name },
          conditions: ['HEART_CONDITION'],
          stage: 'SPECIALIST',
          reason: 'MATCHING_EXPERTISE',
          opensAt: '2026-10-09T10:00:00Z',
          selectedReviewerIds: ['rnd'],
        },
      ],
    },
  },
});
beforeEach(() => {
  vi.clearAllMocks();
  auth.owner = 'admin-one';
});

it('loads disabled routing and refreshes after an admin enables it', async () => {
  vi.mocked(api.get).mockResolvedValueOnce(snapshot(false)).mockResolvedValue(snapshot(true));
  vi.mocked(api.patch).mockResolvedValue({ data: { success: true } });
  render(<ReviewRoutingPanel />);
  const toggle = screen.getByRole('switch', { name: 'Enable specialist review priority' });
  await waitFor(() => expect(toggle).not.toBeDisabled());
  expect(toggle).toHaveAttribute('aria-checked', 'false');
  fireEvent.click(toggle);
  await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
  expect(api.patch).toHaveBeenCalledWith('/admin/review-routing', { enabled: true });
});

it('does not show a former administrator’s late routing response after switching accounts', async () => {
  let finish!: (value: ReturnType<typeof snapshot>) => void;
  vi.mocked(api.get).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  vi.mocked(api.get).mockResolvedValue(snapshot(false, 'Current member'));
  const { rerender } = render(<ReviewRoutingPanel />);
  auth.owner = 'admin-two';
  rerender(<ReviewRoutingPanel />);
  await waitFor(() => expect(screen.getByText(/Current member/)).toBeInTheDocument());
  await act(async () => {
    finish(snapshot(true, 'Former private member'));
  });
  expect(screen.queryByText(/Former private member/)).not.toBeInTheDocument();
  expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
});

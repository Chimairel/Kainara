import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { clearSessionResourceCache } from '@/lib/session-resource-cache';
import AdminAuditWorkspace from './AdminAuditWorkspace';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: { get: mocks.get } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'admin' } }) }));
const row = {
  id: 'flag',
  occurredAt: '2026-10-04T08:00:00Z',
  actor: 'Former staff',
  role: 'ADMIN',
  action: 'Flagged an entire meal',
  subject: 'Test lunch',
  outcome: 'Needs attention',
};
beforeEach(() => {
  vi.clearAllMocks();
  clearSessionResourceCache();
  mocks.get.mockImplementation(async (_url, { params }) => ({
    data: { success: true, data: { rows: [row], total: 25, page: params.page, totalPages: 2 } },
  }));
});

it('loads admin history, sends My actions and pagination, and switches to read-only nutritionist history', async () => {
  render(<AdminAuditWorkspace />);
  await screen.findByText('Former staff');
  fireEvent.click(screen.getByLabelText('My actions'));
  await waitFor(() =>
    expect(mocks.get).toHaveBeenLastCalledWith('/admin/audit-history', {
      params: expect.objectContaining({ mine: 'true', view: 'admin', page: 1 }),
    })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('25 records · Page 2 of 2');
  fireEvent.click(screen.getByRole('button', { name: 'Nutritionist history' }));
  await waitFor(() =>
    expect(mocks.get).toHaveBeenLastCalledWith('/admin/audit-history', {
      params: expect.objectContaining({ mine: undefined, view: 'nutritionist', page: 1 }),
    })
  );
  expect(screen.queryByLabelText('My actions')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
});

it('opens a related timeline and restores the prior filters when returning', async () => {
  render(<AdminAuditWorkspace />);
  await screen.findByText('Former staff');
  fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'FLAGGED' } });
  await waitFor(() =>
    expect(mocks.get).toHaveBeenLastCalledWith('/admin/audit-history', {
      params: expect.objectContaining({ action: 'FLAGGED' }),
    })
  );
  await screen.findByText('Former staff');
  fireEvent.click(screen.getByRole('button', { name: /Related activity:/ }));
  await waitFor(() =>
    expect(mocks.get).toHaveBeenLastCalledWith('/admin/audit-history/flag/related', { params: { page: 1 } })
  );
  expect(screen.queryByRole('region', { name: 'Audit filters' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Back to audit' }));
  expect(screen.getByLabelText('Action')).toHaveValue('FLAGGED');
});

it('debounces staff search and blocks reversed dates including manual refresh', async () => {
  render(<AdminAuditWorkspace />);
  await screen.findByText('Former staff');
  fireEvent.change(screen.getByLabelText('Staff name'), { target: { value: 'Former' } });
  await waitFor(() =>
    expect(mocks.get).toHaveBeenLastCalledWith('/admin/audit-history', {
      params: expect.objectContaining({ actor: 'Former' }),
    })
  );
  fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-10-04' } });
  fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-10-03' } });
  expect(screen.getByRole('alert')).toHaveTextContent('The end date must be on or after');
  expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
  expect(mocks.get.mock.calls.some(([, options]) => options.params.from > options.params.to)).toBe(false);
});

it('shows a recoverable fetch failure instead of presenting an empty successful history', async () => {
  mocks.get.mockRejectedValue(new Error('Unavailable'));
  render(<AdminAuditWorkspace />);
  await screen.findByRole('alert');
  expect(screen.queryByText('No activity matches these filters.')).not.toBeInTheDocument();
  mocks.get.mockResolvedValue({ data: { success: true, data: { rows: [], total: 0, page: 1, totalPages: 0 } } });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  await screen.findByText('No activity matches these filters.');
});

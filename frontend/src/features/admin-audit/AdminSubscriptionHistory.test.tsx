import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { clearSessionResourceCache } from '@/lib/session-resource-cache';
import AdminAuditWorkspace from './AdminAuditWorkspace';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: mocks }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'admin' } }) }));
beforeEach(() => {
  vi.resetAllMocks();
  clearSessionResourceCache();
  mocks.get.mockImplementation(async (url: string) => ({
    data: {
      success: true,
      data:
        url === '/admin/membership-history/members'
          ? {
              rows: [
                { id: 'one', name: 'Member One', email: 'one@example.test' },
                { id: 'two', name: 'Member Two', email: 'two@example.test' },
              ],
              total: 2,
              page: 1,
              totalPages: 1,
            }
          : url.startsWith('/admin/membership-history/')
            ? {
                member: { id: url.split('/').at(-1), name: 'Selected member' },
                rows: [],
                total: 0,
                page: 1,
                totalPages: 0,
              }
            : { rows: [], total: 0, page: 1, totalPages: 0 },
    },
  }));
});
it('adds a separate subscription view, switches members and preserves staff audit tabs', async () => {
  render(<AdminAuditWorkspace />);
  fireEvent.click(screen.getByRole('button', { name: 'Member subscriptions' }));
  await screen.findByRole('heading', { name: 'Subscription history' });
  expect(screen.queryByRole('region', { name: 'Audit filters' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('combobox', { name: 'Subscription member' }));
  fireEvent.click(screen.getByRole('option', { name: /Member Two/ }));
  await waitFor(() =>
    expect(mocks.get).toHaveBeenCalledWith('/admin/membership-history/two', { params: { page: 1, limit: 10 } })
  );
  fireEvent.change(screen.getByRole('searchbox', { name: 'Member name or email' }), { target: { value: 'Two' } });
  await waitFor(() =>
    expect(mocks.get).toHaveBeenCalledWith('/admin/membership-history/members', {
      params: { page: 1, limit: 10, search: 'Two' },
    })
  );
  fireEvent.click(screen.getByRole('button', { name: 'RND history' }));
  expect(screen.getByRole('region', { name: 'Audit filters' })).toBeVisible();
  expect(screen.queryByRole('heading', { name: 'Subscription history' })).not.toBeInTheDocument();
  expect(mocks.get.mock.calls.some(([, config]) => config?.params?.view === 'subscriptions')).toBe(false);
});

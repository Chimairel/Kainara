import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import api from '@/lib/axios';
import NaraActivityWorkspace from './NaraActivityWorkspace';
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));
it('shows submitted member text, filters explicitly, paginates and preserves rows on failure', async () => {
  const record = {
    id: 'first',
    message: 'What is protein? 🥚',
    mode: 'AI_REQUEST',
    createdAt: '2026-10-20T00:00:00Z',
    user: { id: 'member', name: 'Test member', email: 'fixture@example.invalid' },
  };
  vi.mocked(api.get).mockResolvedValue({ data: { data: { items: [record], nextCursor: 'first' } } });
  render(<NaraActivityWorkspace />);
  await screen.findByText(record.message);
  expect(screen.getByText('/ai request')).toBeVisible();
  expect(screen.getByText(record.user.email)).toBeVisible();
  fireEvent.change(screen.getByLabelText('Search submitted messages'), { target: { value: 'protein' } });
  expect(api.get).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Search', exact: true }));
  await waitFor(() =>
    expect(api.get).toHaveBeenLastCalledWith('/admin/nara-answers/activity', { params: { search: 'protein' } })
  );
  await waitFor(() => expect(screen.getByRole('button', { name: 'Older messages' })).toBeEnabled());
  vi.mocked(api.get).mockRejectedValueOnce(new Error('Offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Older messages' }));
  await screen.findByRole('alert');
  expect(screen.getByText(record.message)).toBeVisible();
  expect(api.get).toHaveBeenLastCalledWith('/admin/nara-answers/activity', {
    params: { search: 'protein', cursor: 'first' },
  });
});

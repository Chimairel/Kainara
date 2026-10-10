import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import AuditHistoryList, { type AuditDetails, type AuditRow } from './AuditHistoryList';
import { clearSessionResourceCache } from '@/lib/session-resource-cache';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: mocks }));
const row: AuditRow = {
  id: 'egg',
  occurredAt: '2026-10-05T01:00:00Z',
  actor: 'Reviewer',
  role: 'NUTRITIONIST',
  action: 'Corrected outside food',
  subject: 'Outside food log',
  outcome: 'Completed',
};
const details: AuditDetails = {
  facts: [{ label: 'Revision', value: '2' }],
  reason: 'Checked the serving.',
  food: {
    name: 'Egg',
    portionGrams: 50,
    source: 'NUTRITIONIST_REVIEWED',
    nutritionStatus: 'CORRECTED',
    ingredients: [{ name: 'egg', quantity: null, unit: null }],
  },
  previous: { calories: 85, proteinG: 6, carbsG: 1, fatG: 6 },
  effective: { calories: 75, proteinG: 6, carbsG: 0, fatG: null },
};
beforeEach(() => {
  vi.clearAllMocks();
  clearSessionResourceCache();
  mocks.get.mockResolvedValue({ data: { success: true, data: details } });
});
it('loads only on expansion and presents recorded changes, zero and missing nutrients', async () => {
  render(<AuditHistoryList rows={[row]} ownerId="admin" endpoint="/admin/audit-history" canAuthor />);
  expect(mocks.get).not.toHaveBeenCalled();
  expect(screen.getByRole('table', { name: 'Audit records' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Staff' })).toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  const button = screen.getByRole('button', { name: /Details:/ });
  fireEvent.click(button);
  const panel = await screen.findByRole('region', { name: /Corrected outside food details/ });
  expect(await within(panel).findByRole('heading', { name: 'Egg' })).toBeInTheDocument();
  expect(mocks.get).toHaveBeenCalledWith('/admin/audit-history/egg');
  expect(within(panel).getByText('0 g')).toBeInTheDocument();
  expect(within(panel).getByText('Not recorded')).toBeInTheDocument();
  expect(within(panel).getByText('Checked the serving.')).toBeInTheDocument();
  expect(within(panel).getByRole('link', { name: 'Author a meal' })).toHaveAttribute('href', '/admin/meals?tab=author');
  expect(button).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(button);
  expect(screen.queryByRole('region', { name: /Corrected outside food details/ })).not.toBeInTheDocument();
  expect(button).toHaveAttribute('aria-expanded', 'false');
});
it('keeps failure visible and retries without any mutation', async () => {
  mocks.get.mockRejectedValueOnce(new Error('Details unavailable'));
  render(<AuditHistoryList rows={[row]} ownerId="rnd" endpoint="/nutritionist/audit-history" />);
  fireEvent.click(screen.getByRole('button', { name: /Details:/ }));
  await screen.findByRole('alert');
  expect(screen.queryByText('No additional details were recorded.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry details' }));
  await screen.findByRole('heading', { name: 'Egg' });
  expect(screen.queryByRole('link', { name: 'Author a meal' })).not.toBeInTheDocument();
});
it('does not flash a late response in a different record or account', async () => {
  let finish!: (value: unknown) => void;
  mocks.get.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const second = { ...row, id: 'rice', subject: 'Rice' };
  const view = render(<AuditHistoryList rows={[row, second]} ownerId="admin" endpoint="/admin/audit-history" />);
  fireEvent.click(screen.getByRole('button', { name: /Details:.*Outside food log/ }));
  await waitFor(() => expect(mocks.get).toHaveBeenCalled());
  mocks.get.mockResolvedValue({
    data: { success: true, data: { ...details, food: { ...details.food!, name: 'Rice' } } },
  });
  fireEvent.click(screen.getByRole('button', { name: /Details:.*Rice/ }));
  await screen.findByRole('heading', { name: 'Rice' });
  await act(async () => finish({ data: { success: true, data: details } }));
  expect(screen.queryByRole('heading', { name: 'Egg' })).not.toBeInTheDocument();
  mocks.get.mockResolvedValue({
    data: { success: true, data: { facts: [], food: null, reason: null, previous: null, effective: null } },
  });
  view.rerender(<AuditHistoryList rows={[row, second]} ownerId="other" endpoint="/admin/audit-history" />);
  await screen.findByText('No additional details were recorded.');
  expect(screen.queryByRole('heading', { name: 'Rice' })).not.toBeInTheDocument();
});

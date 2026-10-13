import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import RecipeCaseHistory from './RecipeCaseHistory';
import { clearSessionResourceCache } from '@/lib/session-resource-cache';
const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: mocks }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'rnd' } }) }));
beforeEach(() => { mocks.get.mockReset(); clearSessionResourceCache(); });
it('shows a member decision separately from reusable approvals and opens the shared audit modal', async () => {
  mocks.get.mockImplementation(async (url: string) => ({ data: { success: true, data: url.includes('case-history') ? {
    total: 1, totalPages: 1, rows: [{ id: 'case', occurredAt: '2026-10-13T08:00:00Z', actor: 'RND', role: 'NUTRITIONIST',
      subject: 'Bam-I Recipe', type: 'Meal approval', action: 'Approved a case', outcome: 'Completed' }],
  } : { facts: [], reason: null, food: null, effective: null, previous: null } } }));
  render(<RecipeCaseHistory mealId="recipe" />);
  await screen.findByText('Bam-I');
  expect(screen.getByText(/separate from reusable approvals/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /^Details:/ }));
  await screen.findByRole('dialog', { name: /Meal approval .* Bam-I/ });
  expect(mocks.get).toHaveBeenCalledWith('/nutritionist/audit-history/case');
});
it('labels absent older identity links without inventing approvals', async () => {
  mocks.get.mockResolvedValue({ data: { success: true, data: { total: 0, totalPages: 0, rows: [] } } });
  render(<RecipeCaseHistory mealId="recipe" />);
  await screen.findByText(/Older records without that link remain available in Audit/);
  expect(screen.queryByRole('button', { name: /^Details:/ })).not.toBeInTheDocument();
});
it('handles an incompatible or unavailable response instead of crashing the recipe view', async () => {
  mocks.get.mockResolvedValue({ data: { success: true, data: [] } });
  render(<RecipeCaseHistory mealId="recipe" />);
  await screen.findByRole('alert');
  expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
});

for (const role of ['admin', 'nutritionist'] as const) it(`${role} requests approval-only rows and opens its role-authorized audit details`, async () => {
  mocks.get.mockImplementation(async (url: string) => ({ data: { success: true, data: url.includes('case-history') ? {
    total: 1, totalPages: 1, rows: [{ id: 'case', occurredAt: '2026-10-13T08:00:00Z', actor: 'RND', role: 'NUTRITIONIST',
      subject: 'Bam-I', type: 'Meal approval', action: 'Approved a case', outcome: 'Completed' }],
  } : { facts: [], reason: null, food: null, effective: null, previous: null } } }));
  render(<RecipeCaseHistory mealId="recipe" role={role} approvalsOnly />);
  await screen.findByText('Bam-I');
  expect(mocks.get).toHaveBeenCalledWith(`/${role}/library/recipe/case-history`, { params: { page: 1, approvalsOnly: 'true' } });
  expect(screen.getByRole('heading', { name: 'Approvals', exact: true })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /^Details:/ }));
  await screen.findByRole('dialog', { name: /Meal approval .* Bam-I/ });
  expect(mocks.get).toHaveBeenCalledWith(`/${role}/audit-history/case`);
});

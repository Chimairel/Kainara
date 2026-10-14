import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import GovernanceQueuePanel from './GovernanceQueuePanel';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: api }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'rnd' } }) }));

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation(async (path: string) => ({
    data: {
      data: path.includes('governance')
        ? {
            clearances: [
              {
                id: 'flagged',
                mealLibraryId: 'recipe',
                condition: 'DIABETES',
                assuranceTier: 'ENHANCED',
                state: 'SUSPENDED',
                mealLibrary: { mealName: 'Tinola' },
              },
            ],
          }
        : path.includes('/approvals/') ? { meal: { mealName: 'Tinola', calories: 400, proteinG: 20, carbsG: 50, fatG: 10 },
            originatingPlan: null, flagReview: { expectedVersion: 'synthetic-version', state: 'SUSPENDED',
              canResolve: true, blockedByRecipe: false, matchesCurrentRecipe: true,
              concern: { id: 'flagged', notes: { explanation: 'Recorded synthetic concern.' } } } } : [],
    },
  }));
  api.post.mockResolvedValue({ data: { success: true } });
});

it('opens the shared resolution canvas rather than clearing a flag through a prompt', async () => {
  const prompt = vi.spyOn(window, 'prompt');
  render(<GovernanceQueuePanel tab="audit" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Recheck' }));
  await screen.findByRole('heading', { name: 'Recorded flag concern' });
  expect(api.get).toHaveBeenCalledWith(
    '/nutritionist/library/recipe/approvals/CONDITION/flagged',
    expect.objectContaining({ signal: expect.any(AbortSignal) })
  );
  expect(api.post).not.toHaveBeenCalled();
  expect(prompt).not.toHaveBeenCalled();
  prompt.mockRestore();
});

it('keeps malformed governance evidence out of the rendered queue', async () => {
  api.get.mockResolvedValue({ data: { data: {} } });
  render(<GovernanceQueuePanel tab="audit" />);
  await screen.findByText('Governance queue could not be loaded.');
  expect(screen.queryByRole('button', { name: 'Recheck' })).not.toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});

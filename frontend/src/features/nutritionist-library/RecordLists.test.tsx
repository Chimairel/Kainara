import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import PendingMealRereviews from '../nutritionist-reviews/PendingMealRereviews';
import QuarantinedMeals from './QuarantinedMeals';
import ObservedMealCorpusSection from '../nutritionist-outside-meals/ObservedMealCorpusSection';
import { clearSessionResourceCache } from '@/lib/session-resource-cache';
import type { ObservedSubmission } from '../nutritionist-outside-meals/OutsideMealReviewsPanel.shared';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'synthetic-record-reviewer' } }) }));
vi.mock('@/lib/axios', () => ({ default: mocks }));
beforeEach(() => {
  clearSessionResourceCache();
  vi.clearAllMocks();
});

for (const isAdmin of [false, true]) {
  it(`keeps ${isAdmin ? 'admin' : 'RND'} held-case access and opens the exact selected recipe`, async () => {
    const row = { id: 'held-fixture', mealName: 'Synthetic soup', state: 'QUARANTINED', incidentCount: 2 };
    mocks.get.mockResolvedValue({ data: { success: true, data: [row, { ...row, id: 'pending', mealName: 'Pending meal', state: 'PENDING_REREVIEW' }] } });
    const openMeal = vi.fn(async () => undefined);
    render(<QuarantinedMeals isAdmin={isAdmin} active openMeal={openMeal} />);
    const table = await screen.findByRole('table', { name: 'Quarantined meals' });
    expect(mocks.get).toHaveBeenCalledWith(`/${isAdmin ? 'admin' : 'nutritionist'}/meal-review-cases`, { params: { state: 'QUARANTINED' } });
    expect(within(table).getByText('Quarantined')).toBeInTheDocument();
    expect(within(table).queryByText('Pending meal')).not.toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: /^2$/ })).toBeInTheDocument();
    fireEvent.click(within(table).getByRole('button', { name: 'View meal' }));
    expect(openMeal).toHaveBeenCalledWith(row);
    expect(within(table).queryByRole('checkbox')).not.toBeInTheDocument();
  });
}

it('keeps observation selection separate from admitting a reference and labels unavailable source data', () => {
  const observation: ObservedSubmission = {
    id: 'consented-fixture',
    sourceRevision: 3,
    createdAt: '2026-10-10',
    sourceOutsideMealItem: null,
  };
  const selectObserved = vi.fn();
  const admitObserved = vi.fn(async () => undefined);
  render(
    <ObservedMealCorpusSection
      model={{
        isLoading: false,
        submissions: [observation],
        selectObserved,
        observed: null,
        observedKind: 'FOOD_REFERENCE',
        setObservedKind: vi.fn(),
        canonicalName: '',
        setCanonicalName: vi.fn(),
        ingredientLines: '',
        setIngredientLines: vi.fn(),
        preparation: '',
        setPreparation: vi.fn(),
        applicableTypes: [],
        setApplicableTypes: vi.fn(),
        busy: false,
        admitObserved,
      }}
    />
  );
  const table = screen.getByRole('table', { name: 'Consented food observations' });
  expect(within(table).getByText('Source no longer available')).toBeInTheDocument();
  expect(within(table).getByText('Unknown g')).toBeInTheDocument();
  fireEvent.click(within(table).getByRole('button', { name: 'Classify' }));
  expect(selectObserved).toHaveBeenCalledWith(observation);
  expect(admitObserved).not.toHaveBeenCalled();
});

it('routes first-incident re-review to Reviews and excludes quarantined records there', async () => {
  mocks.get.mockResolvedValue({ data: { success: true, data: [
    { id: 'pending/meal', mealName: 'First incident meal', state: 'PENDING_REREVIEW', incidentCount: 1 },
    { id: 'quarantine', mealName: 'Quarantined meal', state: 'QUARANTINED', incidentCount: 2 },
  ] } });
  render(<PendingMealRereviews />);
  await screen.findByText('First incident meal');
  expect(screen.queryByText('Quarantined meal')).not.toBeInTheDocument();
  expect(mocks.get).toHaveBeenCalledWith('/nutritionist/meal-review-cases', { params: { state: 'PENDING_REREVIEW' } });
  expect(screen.getByRole('link', { name: 'Review meal' })).toHaveAttribute('href', '/nutritionist/library?mealId=pending%2Fmeal');
});

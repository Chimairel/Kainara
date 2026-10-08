import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { clearSessionResourceCache } from '@/lib/session-resource-cache';
import MealLogDetail from './MealLogDetail';
import AdminMealPopularity from './AdminMealPopularity';
import AdminMealLogAudit from './AdminMealLogAudit';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: { get: mocks.get } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'admin' } }) }));
const snapshot = {
  mealName: 'Tinola',
  mealDate: '2026-10-08T04:00:00Z',
  source: 'USER_LOGGED',
  status: 'DONE',
  calories: 420,
};
const record = {
  logId: 'log',
  memberName: 'Synthetic member',
  memberId: 'member',
  snapshot,
  ageGroup: '18-24',
  membership: 'FREE_HEALTH',
  firstRecordedAt: null,
  lastActionAt: null,
  contextVersion: 'LEGACY_UNAVAILABLE',
  deleted: false,
};
beforeEach(() => {
  vi.clearAllMocks();
  clearSessionResourceCache();
});

it('opens recorded RND changes through the dropdown and preserves before/after values and rationale', async () => {
  mocks.get.mockResolvedValue({
    data: {
      success: true,
      data: {
        record,
        items: [],
        events: [
          {
            id: 'event',
            entityType: 'ITEM',
            action: 'UPDATE',
            actorName: 'Synthetic reviewer',
            actorRole: 'NUTRITIONIST',
            occurredAt: '2026-10-08T05:00:00Z',
            reason: 'Corrected portion evidence',
            before: { calories: 440 },
            after: { calories: 420 },
          },
        ],
        total: 1,
        page: 1,
        totalPages: 1,
      },
    },
  });
  render(<MealLogDetail logId="log" ownerId="admin" />);
  await screen.findByText(/This log predates change recording/);
  fireEvent.click(screen.getByLabelText('Meal log change'));
  fireEvent.click(screen.getByRole('option', { name: /Updated dish/ }));
  expect(screen.getByText('Corrected portion evidence')).toBeInTheDocument();
  expect(screen.getByText(/Synthetic reviewer · RND/)).toBeInTheDocument();
  expect(screen.getByText('440')).toBeInTheDocument();
  expect(screen.getByText('420')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Before' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'After' })).toBeInTheDocument();
});

it('failed detail reads offer retry and never present an empty successful history', async () => {
  mocks.get.mockRejectedValue(new Error('Unavailable'));
  render(<MealLogDetail logId="log" ownerId="admin" />);
  await screen.findByRole('alert');
  expect(screen.queryByText('No saved change events.')).not.toBeInTheDocument();
  mocks.get.mockResolvedValue({
    data: { success: true, data: { record, items: [], events: [], total: 0, page: 1, totalPages: 0 } },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Retry details' }));
  await screen.findByText('No saved change events.');
});

it('popularity preserves cohort notices and links to supporting logs with the date and recipe identity', async () => {
  mocks.get.mockResolvedValue({
    data: {
      success: true,
      data: {
        rows: [
          {
            key: 'library:recipe',
            name: 'Tinola',
            eaten: 6,
            members: 5,
            repeatEaters: 1,
            skipped: 1,
            eatenPercentage: 85.7,
          },
        ],
        total: 1,
        totalPages: 1,
        unmatchedItems: 2,
        legacyLogs: 3,
        minimumCohort: 5,
      },
    },
  });
  render(<AdminMealPopularity />);
  await screen.findByText('1. Tinola');
  expect(screen.getByText(/at least 5 distinct eaters/)).toBeInTheDocument();
  expect(screen.getByText('85.7%')).toBeInTheDocument();
  const link = screen.getByRole('link', { name: 'View meal logs →' });
  const url = new URL(link.getAttribute('href')!, 'http://localhost');
  expect(url.searchParams.get('recipeKey')).toBe('library:recipe');
  expect(url.searchParams.get('view')).toBe('meal-logs');
  expect(url.searchParams.has('includeTests')).toBe(false);
  expect(mocks.get.mock.calls[0][1].params).not.toHaveProperty('includeTests');
});

it('audit applies filters explicitly rather than fetching on each search edit', async () => {
  mocks.get.mockImplementation(async () => ({
    data: { success: true, data: { rows: [record], total: 1, totalPages: 1 } },
  }));
  render(<AdminMealLogAudit />);
  await screen.findByText('Tinola');
  fireEvent.change(screen.getByLabelText('Member name or email'), { target: { value: 'Synthetic' } });
  expect(mocks.get).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() =>
    expect(mocks.get).toHaveBeenLastCalledWith('/admin/meal-logs', {
      params: expect.objectContaining({ member: 'Synthetic' }),
    })
  );
});

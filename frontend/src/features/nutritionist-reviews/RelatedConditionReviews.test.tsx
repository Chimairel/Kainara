import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import RelatedConditionReviews from './RelatedConditionReviews';
import type { DetailData } from './review-types';
import api from '@/lib/axios';
import { toast } from 'sonner';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'current-rnd' } }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
const detail = { mealPlan: { id: 'current-meal' }, user: { conditions: ['HEART_CONDITION', 'DIABETES'] },
  reviewContext: { contextKey: 'current-key' } } as unknown as DetailData;
const row = { id: 'record', mealName: 'Recorded heart meal', decision: 'APPROVE', reviewedAt: '2026-10-13T10:00:00Z',
  reviewerName: 'Original RND', needsReview: false, plateFacts: { calories: 500, proteinG: 20, carbsG: 0, fatG: 10 },
  ingredients: [{ name: 'Recorded vegetable', quantity: 100, unit: 'g', source: 'FNRI' }] };
const page = { data: { data: { condition: 'HEART_CONDITION', rows: [row], total: 11, page: 1, totalPages: 2 } } };
afterEach(() => vi.resetAllMocks());
it('shows saved meal evidence inline and keeps comparison separate from approval', async () => {
  vi.mocked(api.get).mockResolvedValue(page);
  render(<RelatedConditionReviews detail={detail} />);
  const panel = screen.getByRole('region', { name: 'Related condition reviews', exact: true });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await within(panel).findByText('Original RND');
  expect(api.get).toHaveBeenCalledWith('/nutritionist/queue/current-meal/condition-reviews', expect.objectContaining({
    params: expect.objectContaining({ condition: 'HEART_CONDITION', expectedContextKey: 'current-key', page: 1 }),
  }));
  fireEvent.click(within(panel).getByRole('button', { name: 'View evidence for Recorded heart meal' }));
  expect(within(panel).getByText('0 g')).toBeInTheDocument();
  expect(within(panel).getByText('Recorded vegetable')).toBeInTheDocument();
  expect(within(panel).getByText(/shared condition alone/)).toBeInTheDocument();
  expect(within(panel).queryByRole('button', { name: /approve|claim|reuse/i })).not.toBeInTheDocument();
  fireEvent.click(within(panel).getByRole('button', { name: 'Next' }));
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({
    params: expect.objectContaining({ page: 2 }),
  })));
  fireEvent.change(within(panel).getByLabelText('Condition'), { target: { value: 'DIABETES' } });
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({
    params: expect.objectContaining({ condition: 'DIABETES', page: 1 }),
  })));
});
it('reports failures through Sonner and allows a retry and empty result', async () => {
  vi.mocked(api.get).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: { data: { rows: [], total: 0, totalPages: 0 } } });
  render(<RelatedConditionReviews detail={detail} />);
  await screen.findByRole('button', { name: 'Try again' });
  expect(toast.error).toHaveBeenCalledWith('Could not load related reviews. Try again.');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('No completed reviews for this condition yet.');
});
it('hides related-condition browsing for a case without a health condition', () => {
  render(<RelatedConditionReviews detail={{ ...detail, user: { ...detail.user, conditions: ['NONE'] } }} />);
  expect(screen.queryByRole('region', { name: 'Related condition reviews', exact: true })).not.toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalled();
});

it('ignores an older response after the condition changes', async () => {
  let resolveOld!: (value: typeof page) => void;
  vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
    .mockResolvedValueOnce({ data: { data: { condition: 'DIABETES', rows: [], total: 0, totalPages: 0 } } });
  render(<RelatedConditionReviews detail={detail} />);
  fireEvent.change(screen.getByLabelText('Condition'), { target: { value: 'DIABETES' } });
  await screen.findByText('No completed reviews for this condition yet.');
  await act(async () => { resolveOld(page); });
  expect(screen.queryByText('Original RND')).not.toBeInTheDocument();
  expect(screen.getByText('0 completed reviews for diabetes')).toBeInTheDocument();
});

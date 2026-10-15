import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useOutsideMealReviewsPanelModel } from './useOutsideMealReviewsPanelModel';
import type { QueueRow } from './OutsideMealReviewsPanel.shared';

const mocks = vi.hoisted(() => ({ owner: 'rnd-a', get: vi.fn(), post: vi.fn(), patch: vi.fn(), write: vi.fn(), toast: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: mocks.owner } }) }));
vi.mock('@/hooks/useVisiblePolling', () => ({ useVisiblePolling: () => {} }));
vi.mock('@/lib/axios', () => ({ default: { get: mocks.get, post: mocks.post, patch: mocks.patch } }));
vi.mock('sonner', () => ({ toast: { success: mocks.toast } }));
vi.mock('@/lib/session-resource-cache', () => ({ readSessionResource: () => null, writeSessionResource: mocks.write }));
const row = (id: string) =>
  ({ id, outsideMealLogItem: { calories: 300, proteinG: 10, carbsG: 40, fatG: 10 } }) as QueueRow;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.owner = 'rnd-a';
  mocks.get.mockImplementation(async (url: string) => ({
    data: { data: url.endsWith('/outside-meal-reviews') ? [row(mocks.owner)] : [] },
  }));
});

it('ignores a previous account’s delayed review-list response and cache write', async () => {
  const pending = deferred<{ data: { data: QueueRow[] } }>();
  mocks.get.mockImplementation((url: string) =>
    url.endsWith('/outside-meal-reviews') && mocks.owner === 'rnd-a'
      ? pending.promise
      : Promise.resolve({ data: { data: url.endsWith('/outside-meal-reviews') ? [row('rnd-b')] : [] } })
  );
  const { result, rerender } = renderHook(() => useOutsideMealReviewsPanelModel());
  mocks.owner = 'rnd-b';
  rerender();
  await waitFor(() => expect(result.current.rows[0]?.id).toBe('rnd-b'));
  await act(async () => pending.resolve({ data: { data: [row('private-rnd-a')] } }));
  expect(result.current.rows.map((item) => item.id)).toEqual(['rnd-b']);
  expect(mocks.write.mock.calls.every(([owner]) => owner === 'rnd-b')).toBe(true);
});

it('does not notify or clear another account when an old feedback submission finishes', async () => {
  const pending = deferred<{ data: { data: QueueRow } }>();
  mocks.patch.mockReturnValue(pending.promise);
  const { result, rerender } = renderHook(() => useOutsideMealReviewsPanelModel());
  await waitFor(() => expect(result.current.rows[0]?.id).toBe('rnd-a'));
  act(() => { result.current.selectReview(row('private-rnd-a')); result.current.setFeedback('Recorded feedback.'); });
  let claiming!: Promise<void>;
  act(() => { claiming = result.current.sendFeedback(); });
  mocks.owner = 'rnd-b';
  rerender();
  await waitFor(() => expect(result.current.rows[0]?.id).toBe('rnd-b'));
  await act(async () => {
    pending.resolve({ data: { data: row('private-rnd-a') } });
    await claiming;
  });
  expect(result.current.selected).toBeNull();
  expect(result.current.busy).toBe(false);
  expect(mocks.toast).not.toHaveBeenCalled();
});

it('sends feedback once without claiming, closes the selected log and updates work counts', async () => {
  mocks.patch.mockResolvedValue({ data: { success: true } });
  const events = vi.fn(); window.addEventListener('nutrimind:review-work-updated', events);
  const { result } = renderHook(() => useOutsideMealReviewsPanelModel());
  await waitFor(() => expect(result.current.rows).toHaveLength(1));
  act(() => { result.current.selectReview({ ...row('request'), outsideMealLogItem: { ...row('request').outsideMealLogItem, currentRevision: 2 } }); result.current.setFeedback('Recorded advice.'); });
  await act(async () => { await Promise.all([result.current.sendFeedback(), result.current.sendFeedback()]); });
  expect(mocks.patch).toHaveBeenCalledExactlyOnceWith('/nutritionist/outside-meal-reviews/request', { action: 'FEEDBACK', expectedRevision: 2, reason: 'Recorded advice.' });
  expect(mocks.post).not.toHaveBeenCalled();
  expect(result.current.selected).toBeNull(); expect(mocks.toast).toHaveBeenCalledTimes(1); expect(events).toHaveBeenCalled();
  window.removeEventListener('nutrimind:review-work-updated', events);
});

it('retains feedback on failure and never silently retargets it to a newer food revision', async () => {
  mocks.patch.mockRejectedValue({ response: { data: { error: 'Food changed. Refresh the request.' } } });
  const { result } = renderHook(() => useOutsideMealReviewsPanelModel());
  await waitFor(() => expect(result.current.rows).toHaveLength(1));
  act(() => { result.current.selectReview({ ...row('rnd-a'), outsideMealLogItem: { ...row('rnd-a').outsideMealLogItem, currentRevision: 2 } }); result.current.setFeedback('Recorded advice.'); });
  mocks.get.mockResolvedValue({ data: { data: [{ ...row('rnd-a'), outsideMealLogItem: { currentRevision: 3 } }] } });
  await act(() => result.current.sendFeedback());
  expect(result.current.feedback).toBe('Recorded advice.'); expect(result.current.selected?.outsideMealLogItem.currentRevision).toBe(2);
  expect(result.current.error).toBe('Food changed. Refresh the request.'); expect(mocks.toast).not.toHaveBeenCalled();
});

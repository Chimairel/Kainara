import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useOutsideMealReviewsPanelModel } from './useOutsideMealReviewsPanelModel';
import type { QueueRow } from './OutsideMealReviewsPanel.shared';

const mocks = vi.hoisted(() => ({ owner: 'rnd-a', get: vi.fn(), post: vi.fn(), write: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: mocks.owner } }) }));
vi.mock('@/hooks/useVisiblePolling', () => ({ useVisiblePolling: () => {} }));
vi.mock('@/lib/axios', () => ({ default: { get: mocks.get, post: mocks.post } }));
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

it('does not restore a previous account’s selection when its late claim finishes', async () => {
  const pending = deferred<{ data: { data: QueueRow } }>();
  mocks.post.mockReturnValue(pending.promise);
  const { result, rerender } = renderHook(() => useOutsideMealReviewsPanelModel());
  await waitFor(() => expect(result.current.rows[0]?.id).toBe('rnd-a'));
  let claiming!: Promise<void>;
  act(() => {
    claiming = result.current.claim(row('private-rnd-a'));
  });
  mocks.owner = 'rnd-b';
  rerender();
  await waitFor(() => expect(result.current.rows[0]?.id).toBe('rnd-b'));
  await act(async () => {
    pending.resolve({ data: { data: row('private-rnd-a') } });
    await claiming;
  });
  expect(result.current.selected).toBeNull();
  expect(result.current.busy).toBe(false);
});

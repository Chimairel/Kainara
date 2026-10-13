import api from '@/lib/axios';
import { clearSessionResourceCache } from '@/lib/session-resource-cache';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useMealHistory } from './useMealHistory';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));
beforeEach(() => {
  clearSessionResourceCache();
  vi.resetAllMocks();
});

it('does not display the previous account history or count while the new account loads', async () => {
  vi.mocked(api.get).mockImplementation(async (url) =>
    url === '/user/meals/history/count'
      ? { data: { success: true, data: { total: 1 } } }
      : { data: { success: true, data: [{ id: 'old-log' }] } }
  );
  const fetchMeals = vi.fn().mockResolvedValue(undefined);
  const hook = renderHook(({ ownerId }) => useMealHistory(ownerId, true, fetchMeals), {
    initialProps: { ownerId: 'old' },
  });
  await waitFor(() => expect(hook.result.current.historyTotalCount).toBe(1));
  vi.mocked(api.get).mockReturnValue(new Promise(() => {}));
  hook.rerender({ ownerId: 'new' });
  expect(hook.result.current.historyLogs).toEqual([]);
  expect(hook.result.current.historyTotalCount).toBeNull();
  expect(hook.result.current.isHistoryLoading).toBe(true);
});

it('preloads history totals on Plan and refreshes them after a new log', async () => {
  let total = 4;
  vi.mocked(api.get).mockImplementation(async (url) =>
    url === '/user/meals/history/count'
      ? { data: { success: true, data: { total } } }
      : { data: { success: true, data: Array.from({ length: total }, (_, id) => ({ id })) } }
  );
  const hook = renderHook(() => useMealHistory('member', false, vi.fn()));
  await waitFor(() => expect(hook.result.current.historyTotalCount).toBe(4));
  expect(api.get).toHaveBeenCalledExactlyOnceWith('/user/meals/history/count');
  total = 5;
  await act(async () => {
    await hook.result.current.fetchHistory();
  });
  expect(hook.result.current.historyTotalCount).toBe(5);
});

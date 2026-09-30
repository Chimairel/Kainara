import api from '@/lib/axios';
import { clearSessionResourceCache } from '@/lib/session-resource-cache';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useMealHistory } from './useMealHistory';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));
beforeEach(() => {
  clearSessionResourceCache();
  vi.resetAllMocks();
});

it('does not display the previous account history or count while the new account loads', async () => {
  vi.mocked(api.get)
    .mockResolvedValueOnce({ data: { success: true, data: [{ id: 'old-log' }] } })
    .mockReturnValueOnce(new Promise(() => {}));
  const fetchMeals = vi.fn().mockResolvedValue(undefined);
  const hook = renderHook(({ ownerId }) => useMealHistory(ownerId, true, fetchMeals), {
    initialProps: { ownerId: 'old' },
  });
  await waitFor(() => expect(hook.result.current.historyTotalCount).toBe(1));
  hook.rerender({ ownerId: 'new' });
  expect(hook.result.current.historyLogs).toEqual([]);
  expect(hook.result.current.historyTotalCount).toBeNull();
  expect(hook.result.current.isHistoryLoading).toBe(true);
});

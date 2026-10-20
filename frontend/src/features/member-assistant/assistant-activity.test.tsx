import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import api from '@/lib/axios';
import { useMemberAssistant } from './useMemberAssistant';
import { recordLocalAssistantMessage } from './assistant-activity';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockResolvedValue({
    data: {
      data: { enabled: true, allowance: { tier: 'FREE', cap: 5, used: 0, remaining: 5, resetsAt: '2099-01-01' } },
    },
  });
  vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
});
it('does not record typing, records one submitted local reply without context, and does not record restoration', async () => {
  const { result, unmount } = renderHook(() => useMemberAssistant(true, 'activity-member'));
  await act(async () => {});
  act(() => result.current.setDraft('hello'));
  expect(api.post).not.toHaveBeenCalled();
  await act(async () => result.current.send());
  expect(api.post).toHaveBeenCalledExactlyOnceWith(
    '/user/assistant/activity',
    { requestKey: expect.any(String), message: 'hello' },
    { skipTransientRetry: true, timeout: 10000 }
  );
  expect(result.current.messages.at(-1)?.reply?.creditsUsed).toBe(0);
  unmount();
  renderHook(() => useMemberAssistant(true, 'activity-member'));
  await act(async () => {});
  expect(api.post).toHaveBeenCalledTimes(1);
  sessionStorage.clear();
});
it('a failed activity write does not throw or replay the submitted message', async () => {
  vi.mocked(api.post).mockRejectedValue(new Error('Offline'));
  await expect(recordLocalAssistantMessage('key', 'hello')).resolves.toBeUndefined();
  expect(api.post).toHaveBeenCalledTimes(1);
});

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import api from '@/lib/axios';
import { useMemberAssistant } from './useMemberAssistant';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const allowance = {
  tier: 'FREE',
  cap: 5,
  used: 5,
  remaining: 0,
  resetsAt: '2026-10-18T16:00:00Z',
  nextAiRequestAt: '2026-10-17T09:01:00Z',
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-17T09:00:00Z'));
  vi.mocked(api.get).mockResolvedValue({
    data: { data: { enabled: true, allowance, instantQuestions: ['why do i need to log my weight every week'] } },
  });
  vi.mocked(api.post).mockResolvedValue({
    data: {
      data: {
        allowance,
        confirmationRequired: false,
        reply: { text: 'A current weight supports planning updates.', source: 'SYSTEM', creditsUsed: 0 },
      },
    },
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it('routes an indexed custom question to the server instead of a built-in reply during AI cooldown', async () => {
  const { result } = renderHook(() => useMemberAssistant(true));
  await act(async () => {});
  act(() => result.current.setDraft('Why do I need to log my weight every week?'));
  expect(result.current.cooldownBlocksDraft).toBe(false);
  await act(async () => result.current.send());
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(result.current.messages.at(-1)?.text).toBe('A current weight supports planning updates.');
  expect(result.current.allowance?.remaining).toBe(0);
});

it('keeps an /ai-prefixed custom question behind the AI cooldown', async () => {
  const { result } = renderHook(() => useMemberAssistant(true));
  await act(async () => {});
  act(() => result.current.setDraft('/ai Why do I need to log my weight every week?'));
  expect(result.current.cooldownBlocksDraft).toBe(true);
  await act(async () => result.current.send());
  expect(api.post).not.toHaveBeenCalled();
});

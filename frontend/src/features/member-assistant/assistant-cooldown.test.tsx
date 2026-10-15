import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import api from '@/lib/axios';
import { useMemberAssistant, type MemberAssistantModel } from './useMemberAssistant';
import AssistantConversation from './AssistantConversation';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const allowance = { tier: 'FREE' as const, cap: 5, used: 0, remaining: 5, resetsAt: '2026-10-18T16:00:00Z' };
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-15T14:00:00Z')); vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(api.get).mockResolvedValue({ data: { data: { enabled: true,
    allowance: { ...allowance, nextAiRequestAt: '2026-10-15T14:01:00Z' } } } });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it('counts down locally, preserves blocked drafts and allows free system help without extra reads', async () => {
  const { result } = renderHook(() => useMemberAssistant(true));
  await act(async () => {}); act(() => result.current.setOpen(true));
  expect(result.current.cooldownSeconds).toBe(60);
  act(() => result.current.setDraft('What is protein?'));
  act(() => result.current.send());
  expect(result.current.draft).toBe('What is protein?'); expect(result.current.messages).toEqual([]);
  expect(result.current.cooldownBlocksDraft).toBe(true); expect(api.post).not.toHaveBeenCalled();
  act(() => result.current.send(undefined, 'how to report issue?'));
  expect(result.current.messages.at(-1)?.text).toContain('Contact Support');
  act(() => vi.advanceTimersByTime(31_000)); expect(result.current.cooldownSeconds).toBe(29);
  expect(api.get).toHaveBeenCalledTimes(1);
  act(() => result.current.newChat()); expect(result.current.cooldownSeconds).toBe(29);
  act(() => vi.advanceTimersByTime(29_000)); expect(result.current.cooldownSeconds).toBe(0);
  expect(result.current.cooldownBlocksDraft).toBe(false); expect(api.get).toHaveBeenCalledTimes(1);
});

it('429 restores a server deadline and the question without recovery or an automatic retry', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: { data: { enabled: true, allowance } } });
  vi.mocked(api.post).mockRejectedValue({ response: { status: 429,
    data: { error: 'Cooldown', errorCode: 'ASSISTANT_TOO_FAST', retryAt: '2026-10-15T14:00:42Z' } } });
  const { result } = renderHook(() => useMemberAssistant(true));
  await act(async () => {}); act(() => result.current.setOpen(true));
  await act(async () => result.current.send(undefined, 'What is protein?'));
  expect(result.current.cooldownSeconds).toBe(42); expect(result.current.draft).toBe('What is protein?');
  expect(result.current.recoveryKey).toBeNull(); expect(result.current.error).toBeNull();
  act(() => result.current.retry()); expect(api.post).toHaveBeenCalledTimes(1);
  act(() => vi.advanceTimersByTime(42_000)); expect(result.current.cooldownSeconds).toBe(0);
  expect(api.post).toHaveBeenCalledTimes(1);
});

it('a remount restores remaining cooldown from the server instead of restarting a full minute', async () => {
  const first = renderHook(() => useMemberAssistant(true)); await act(async () => {});
  first.unmount(); vi.advanceTimersByTime(20_000);
  const second = renderHook(() => useMemberAssistant(true)); await act(async () => {});
  act(() => second.result.current.setOpen(true));
  expect(second.result.current.cooldownSeconds).toBe(40);
  expect(api.post).not.toHaveBeenCalled();
});

it('a transport 429 uses Retry-After without waiting for a nonexistent receipt', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: { data: { enabled: true, allowance } } });
  vi.mocked(api.post).mockRejectedValue({ response: { status: 429, headers: { 'retry-after': '23' } } });
  const { result } = renderHook(() => useMemberAssistant(true)); await act(async () => {});
  act(() => result.current.setOpen(true));
  await act(async () => result.current.send(undefined, 'What is protein?'));
  expect(result.current.cooldownSeconds).toBe(23); expect(result.current.error).toBeNull();
  expect(result.current.draft).toBe('What is protein?'); expect(result.current.recoveryKey).toBeNull();
  expect(vi.mocked(api.get).mock.calls.some(([path]) => String(path).includes('/requests/'))).toBe(false);
});

it('shows a timer, keeps typing available, and disables AI send and confirmation during cooldown', () => {
  const model = { messages: [], busy: false, pending: null, allowance, draft: 'What is protein?',
    error: null, cooldownSeconds: 42, cooldownBlocksDraft: true, setDraft: vi.fn() } as unknown as MemberAssistantModel;
  const view = render(<AssistantConversation model={model} titleId="cooldown" />);
  expect(screen.getByRole('timer')).toHaveTextContent('0:42');
  expect(screen.getByRole('textbox', { name: 'Message the assistant' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  expect(screen.getByText('Free system help is still available.')).toBeVisible();
  view.rerender(<AssistantConversation model={{ ...model, pending: { requestKey: 'key', allowAi: false, message: 'question', context: [] } }} titleId="cooldown" />);
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
});

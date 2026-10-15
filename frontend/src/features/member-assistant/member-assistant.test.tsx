import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import api from '@/lib/axios';
import { useMemberAssistant } from './useMemberAssistant';
import AssistantConversation from './AssistantConversation';
import type { MemberAssistantModel } from './useMemberAssistant';
import * as Dialog from '@radix-ui/react-dialog';
import { ASSISTANT_BALANCE_MAX_AGE_MS } from './useMemberAssistant';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const allowance = { tier: 'FREE' as const, cap: 5, used: 0, remaining: 5, resetsAt: '2026-10-18T16:00:00Z' };
beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(api.get).mockResolvedValue({ data: { data: { enabled: true, allowance } } });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it('answers repeated information and navigation questions entirely in the browser', async () => {
  const { result } = renderHook(() => useMemberAssistant(true));
  await waitFor(() => expect(result.current.enabled).toBe(true));
  for (const message of ['what is the system all about?', 'how to change my weight', 'how to change my weight', 'hello', 'how do credits work', 'change my plan']) {
    act(() => result.current.setDraft(message));
    act(() => result.current.send());
  }
  act(() => result.current.send('FIND_MEAL', 'Find a meal'));
  expect(api.post).not.toHaveBeenCalled();
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(result.current.messages).toHaveLength(14);
  expect(result.current.messages.filter(message => message.role === 'assistant').every(message => message.reply?.creditsUsed === 0)).toBe(true);
  expect(result.current.pending).toBeNull();
});

it('reuses a recent balance on reopen, refreshes after expiry and deduplicates concurrent refreshes', async () => {
  const clock = vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-15T10:00:00Z').getTime());
  const { result } = renderHook(() => useMemberAssistant(true));
  await waitFor(() => expect(result.current.enabled).toBe(true));
  await act(async () => { await result.current.refreshAllowance(); await result.current.refreshAllowance(); });
  expect(api.get).toHaveBeenCalledTimes(1);
  clock.mockReturnValue(new Date('2026-10-15T10:00:00Z').getTime() + ASSISTANT_BALANCE_MAX_AGE_MS + 1);
  await act(async () => { await Promise.all([result.current.refreshAllowance(), result.current.refreshAllowance()]); });
  expect(api.get).toHaveBeenCalledTimes(2);
});

it('invalidates the display after membership changes and discards an older in-flight balance', async () => {
  const { result } = renderHook(() => useMemberAssistant(true));
  await waitFor(() => expect(result.current.enabled).toBe(true));
  let resolveOld!: (value: unknown) => void;
  vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  act(() => { void result.current.refreshAllowance(true); });
  vi.mocked(api.get).mockResolvedValueOnce({ data: { data: { enabled: true, allowance: { ...allowance, cap: 40, remaining: 40, tier: 'HEALTH' } } } });
  await act(async () => { window.dispatchEvent(new Event('kainara:membership-updated')); });
  expect(result.current.allowance?.remaining).toBe(40);
  await act(async () => { resolveOld({ data: { data: { enabled: true, allowance } } }); });
  expect(result.current.allowance?.remaining).toBe(40);
  expect(api.get).toHaveBeenCalledTimes(3);
});

it('refreshes at weekly reset while open even if its cached balance is recent', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-18T15:59:59Z'));
  const { result } = renderHook(() => useMemberAssistant(true));
  await act(async () => {});
  act(() => result.current.setOpen(true));
  vi.mocked(api.get).mockResolvedValueOnce({ data: { data: { enabled: true, allowance: { ...allowance, resetsAt: '2026-10-25T16:00:00Z' } } } });
  await act(async () => { await vi.advanceTimersByTimeAsync(1100); });
  expect(api.get).toHaveBeenCalledTimes(2);
  expect(result.current.allowance?.resetsAt).toBe('2026-10-25T16:00:00Z');
});

it('does not let an older status read overwrite the balance returned by a new request', async () => {
  const { result } = renderHook(() => useMemberAssistant(true));
  await waitFor(() => expect(result.current.enabled).toBe(true));
  let resolveOld!: (value: unknown) => void;
  vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  act(() => { void result.current.refreshAllowance(true); });
  vi.mocked(api.post).mockResolvedValueOnce({ data: { data: { confirmationRequired: true, requestKey: 'key', allowance: { ...allowance, used: 3, remaining: 2 } } } });
  act(() => result.current.setDraft('find chicken dinner'));
  act(() => result.current.send());
  await waitFor(() => expect(result.current.allowance?.remaining).toBe(2));
  await act(async () => { resolveOld({ data: { data: { enabled: true, allowance } } }); });
  expect(result.current.allowance?.remaining).toBe(2);
});

it('aborts status reads and keeps account balance and messages out of the next mounted session', async () => {
  const first = renderHook(() => useMemberAssistant(true));
  await waitFor(() => expect(first.result.current.enabled).toBe(true));
  act(() => first.result.current.setDraft('hello'));
  act(() => first.result.current.send());
  first.unmount();
  let signal: AbortSignal | undefined;
  vi.mocked(api.get).mockImplementationOnce((_path, config) => {
    signal = config?.signal as AbortSignal;
    return new Promise(() => {});
  });
  const second = renderHook(() => useMemberAssistant(true));
  expect(second.result.current.allowance).toBeNull();
  expect(second.result.current.messages).toEqual([]);
  second.unmount();
  expect(signal?.aborted).toBe(true);
});

it('free shortcut returns immediately without a confirmation or AI consent', async () => {
  vi.mocked(api.post).mockResolvedValue({ data: { data: { confirmationRequired: false, allowance,
    reply: { text: 'Recorded totals', source: 'SYSTEM', creditsUsed: 0 } } } });
  const { result } = renderHook(() => useMemberAssistant(true));
  await waitFor(() => expect(result.current.enabled).toBe(true));
  act(() => result.current.send('TODAY', 'Today’s nutrition'));
  await waitFor(() => expect(result.current.messages).toHaveLength(2));
  expect(result.current.pending).toBeNull();
  expect(api.post).toHaveBeenCalledWith('/user/assistant/messages', expect.objectContaining({ action: 'TODAY', allowAi: false }), expect.anything());
});

it('AI requests wait for explicit confirmation and reuse the same request key', async () => {
  vi.mocked(api.post).mockImplementation(async (_path, body) => {
    const input = body as { requestKey: string; allowAi: boolean };
    return { data: { data: input.allowAi
      ? { confirmationRequired: false, allowance: { ...allowance, used: 1, remaining: 4 }, reply: { text: 'Chicken results', source: 'AI', creditsUsed: 1 } }
      : { confirmationRequired: true, cost: 1, requestKey: input.requestKey, allowance } } };
  });
  const { result } = renderHook(() => useMemberAssistant(true));
  await waitFor(() => expect(result.current.enabled).toBe(true));
  act(() => result.current.setDraft('chicken dinner'));
  act(() => result.current.send());
  await waitFor(() => expect(result.current.pending).not.toBeNull());
  expect(api.post).toHaveBeenCalledTimes(1);
  const key = result.current.pending!.requestKey;
  act(() => { result.current.confirm(); result.current.confirm(); });
  await waitFor(() => expect(result.current.allowance?.remaining).toBe(4));
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.post).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ requestKey: key, allowAi: true }), expect.anything());
});

it('cancel never sends a second request and keeps the credit balance', async () => {
  vi.mocked(api.post).mockImplementation(async (_path, body) => ({ data: { data: {
    confirmationRequired: true, requestKey: (body as { requestKey: string }).requestKey, cost: 1, allowance,
  } } }));
  const { result } = renderHook(() => useMemberAssistant(true));
  act(() => result.current.setDraft('find chicken'));
  act(() => result.current.send());
  await waitFor(() => expect(result.current.pending).not.toBeNull());
  act(() => result.current.cancel());
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(result.current.allowance?.remaining).toBe(5);
});

it('closing preserves draft and history; new chat clears context without refilling credits', async () => {
  const { result } = renderHook(() => useMemberAssistant(true));
  await waitFor(() => expect(result.current.enabled).toBe(true));
  act(() => { result.current.setOpen(true); result.current.setDraft('unfinished question'); });
  act(() => result.current.setOpen(false));
  act(() => result.current.setOpen(true));
  expect(result.current.draft).toBe('unfinished question');
  act(() => result.current.newChat());
  expect(result.current.draft).toBe('');
  expect(result.current.allowance?.remaining).toBe(5);
});

it('unmount aborts the active account request, preventing a late reply reaching another session', async () => {
  let signal: AbortSignal | undefined;
  vi.mocked(api.post).mockImplementation((_path, _body, config) => {
    signal = config?.signal as AbortSignal; return new Promise(() => {});
  });
  const { result, unmount } = renderHook(() => useMemberAssistant(true));
  act(() => result.current.send('TODAY', 'Today’s nutrition'));
  unmount();
  expect(signal?.aborted).toBe(true);
});

it('renders an inline confirmation only for paid AI requests and disables Continue at zero credits', () => {
  const model = {
    messages: [], busy: false, pending: { requestKey: 'key' }, allowance: { ...allowance, remaining: 0 },
    draft: '', error: null, send: vi.fn(), confirm: vi.fn(), cancel: vi.fn(), newChat: vi.fn(), setOpen: vi.fn(), setDraft: vi.fn(),
  } as unknown as MemberAssistantModel;
  const view = render(<AssistantConversation model={model} titleId="chat" />);
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(model.cancel).toHaveBeenCalledOnce();
  view.rerender(<AssistantConversation model={{ ...model, pending: null }} titleId="chat" />);
  expect(screen.queryByRole('region', { name: 'Confirm AI credit use' })).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Message the assistant' })).toBeEnabled();
});

it('mobile internal result links close the covering panel so the destination can be read', () => {
  const reply = { text: 'Your meal plan', source: 'SYSTEM' as const, creditsUsed: 0, links: [{ label: 'Open my meal plan', href: '/meals' }] };
  const model = { messages: [{ id: 'reply', role: 'assistant', text: reply.text, reply }], busy: false, pending: null,
    allowance, draft: '', error: null, setOpen: vi.fn() } as unknown as MemberAssistantModel;
  render(<Dialog.Root open><Dialog.Content aria-describedby={undefined}><AssistantConversation model={model} titleId="chat" modal /></Dialog.Content></Dialog.Root>);
  fireEvent.click(screen.getByRole('link', { name: 'Open my meal plan' }));
  expect(model.setOpen).toHaveBeenCalledWith(false);
});

it('renders help destinations as inline links without a duplicate navigation row', () => {
  const reply = { text: 'Open Progress and select Log today’s weight.', source: 'SYSTEM' as const, creditsUsed: 0,
    links: [{ label: 'Progress', href: '/progress' }] };
  const model = { messages: [{ id: 'reply', role: 'assistant', text: reply.text, reply }], busy: false, pending: null,
    allowance: { ...allowance, remaining: 0 }, draft: '', error: null, setOpen: vi.fn() } as unknown as MemberAssistantModel;
  render(<Dialog.Root open><Dialog.Content aria-describedby={undefined}><AssistantConversation model={model} titleId="chat" modal /></Dialog.Content></Dialog.Root>);
  const links = screen.getAllByRole('link', { name: 'Progress' });
  expect(links).toHaveLength(1);
  expect(links[0]).toHaveAttribute('href', '/progress');
  expect(links[0].closest('p')).toHaveTextContent(reply.text);
  expect(screen.queryByRole('region', { name: 'Confirm AI credit use' })).toBeNull();
  fireEvent.click(links[0]);
  expect(model.setOpen).toHaveBeenCalledWith(false);
});

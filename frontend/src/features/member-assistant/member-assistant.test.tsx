import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import api from '@/lib/axios';
import { useMemberAssistant } from './useMemberAssistant';
import AssistantConversation from './AssistantConversation';
import type { MemberAssistantModel } from './useMemberAssistant';
import * as Dialog from '@radix-ui/react-dialog';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const allowance = { tier: 'FREE' as const, cap: 5, used: 0, remaining: 5, resetsAt: '2026-10-18T16:00:00Z' };
beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(api.get).mockResolvedValue({ data: { data: { enabled: true, allowance } } });
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

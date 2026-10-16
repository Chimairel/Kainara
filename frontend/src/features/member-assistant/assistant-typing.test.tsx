import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import api from '@/lib/axios';
import { readAssistantSession, saveAssistantSession } from '@/lib/assistant-session';
import { useAssistantTyping } from './useAssistantTyping';
import { useMemberAssistant, type MemberAssistantModel } from './useMemberAssistant';
import AssistantConversation from './AssistantConversation';

const preference = vi.hoisted(() => ({ reduced: false }));
vi.mock('motion/react', async original => ({ ...await original<typeof import('motion/react')>(), useReducedMotion: () => preference.reduced }));
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const allowance = { tier: 'FREE' as const, cap: 5, used: 0, remaining: 5, resetsAt: '2026-10-18T16:00:00Z' };
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-16T04:00:00Z')); vi.clearAllMocks(); sessionStorage.clear();
  preference.reduced = false;
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(api.get).mockResolvedValue({ data: { data: { enabled: true, allowance } } });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

it('reveals complete graphemes progressively and bounds even a long reply to 2.4 seconds plus one tick', () => {
  const { result, unmount } = renderHook(() => useAssistantTyping(true));
  const text = '👩🏽‍🍳'.repeat(200);
  act(() => result.current.start('reply', text));
  expect(result.current.reply?.text).toBe('');
  act(() => vi.advanceTimersByTime(320));
  expect(result.current.reply!.text.length).toBeGreaterThan(0);
  expect(result.current.reply!.text.length).toBeLessThan(text.length);
  expect(result.current.reply!.text.replaceAll('👩🏽‍🍳', '')).toBe('');
  act(() => vi.advanceTimersByTime(2112));
  expect(result.current.reply).toBeNull(); expect(result.current.active.current).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
  act(() => result.current.start('another', 'A later reply'));
  unmount(); expect(vi.getTimerCount()).toBe(0);
});

it('finishes on close, document hiding or a reduced-motion preference change and does not replay on reopen', () => {
  const view = renderHook(({ open }) => useAssistantTyping(open), { initialProps: { open: true } });
  act(() => view.result.current.start('first', 'A complete reply'));
  view.rerender({ open: false });
  expect(view.result.current.reply).toBeNull(); expect(vi.getTimerCount()).toBe(0);
  view.rerender({ open: true }); expect(view.result.current.reply).toBeNull();
  act(() => view.result.current.start('second', 'Another complete reply'));
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  fireEvent(document, new Event('visibilitychange'));
  expect(view.result.current.reply).toBeNull(); expect(vi.getTimerCount()).toBe(0);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  act(() => view.result.current.start('third', 'One more complete reply'));
  preference.reduced = true; view.rerender({ open: true });
  expect(view.result.current.reply).toBeNull(); expect(vi.getTimerCount()).toBe(0);
  act(() => view.result.current.start('fourth', 'This one appears instantly'));
  expect(view.result.current.active.current).toBeNull();
});

it('blocks rapid free and API sends while revealing, preserves the next draft and makes no animation API calls', async () => {
  const { result } = renderHook(() => useMemberAssistant(true, 'owner'));
  await act(async () => {}); act(() => result.current.setOpen(true));
  act(() => { result.current.send(undefined, 'hello'); result.current.send('TODAY', 'Today’s nutrition'); });
  expect(result.current.messages).toHaveLength(2); expect(result.current.typingReply).not.toBeNull();
  act(() => result.current.setDraft('My next question'));
  act(() => { result.current.send(); result.current.newChat(); });
  expect(result.current.messages).toHaveLength(2); expect(result.current.draft).toBe('My next question');
  expect(readAssistantSession('owner')?.messages.at(-1)?.text).toBe(result.current.messages.at(-1)?.text);
  expect(api.post).not.toHaveBeenCalled(); expect(api.get).toHaveBeenCalledTimes(1);
  act(() => vi.advanceTimersByTime(2500));
  expect(result.current.typingReply).toBeNull(); expect(result.current.allowance).toEqual(allowance);
  act(() => result.current.send(undefined, 'hello'));
  expect(result.current.messages).toHaveLength(4); expect(api.post).not.toHaveBeenCalled();
});

it('reveals an API reply without another request or credit deduction and keeps it complete after reopening', async () => {
  const reply = { text: 'Your recorded daily totals are ready.', source: 'SYSTEM', creditsUsed: 0 };
  vi.mocked(api.post).mockResolvedValue({ data: { data: { confirmationRequired: false, allowance, reply } } });
  const { result } = renderHook(() => useMemberAssistant(true));
  await act(async () => {}); act(() => result.current.setOpen(true));
  await act(async () => result.current.send('TODAY', 'Today’s nutrition'));
  expect(result.current.typingReply?.id).toBe(result.current.messages.at(-1)?.id);
  expect(result.current.messages.at(-1)?.text).toBe(reply.text);
  act(() => result.current.setOpen(false)); expect(result.current.typingReply).toBeNull();
  act(() => result.current.setOpen(true)); expect(result.current.typingReply).toBeNull();
  expect(result.current.messages.at(-1)?.text).toBe(reply.text);
  expect(result.current.allowance).toEqual(allowance); expect(api.post).toHaveBeenCalledTimes(1);
});

it('refresh restores the full reply immediately even if the original reveal was interrupted', async () => {
  const first = renderHook(() => useMemberAssistant(true, 'owner'));
  await act(async () => {}); act(() => first.result.current.setOpen(true));
  act(() => first.result.current.send(undefined, 'hello'));
  const complete = first.result.current.messages.at(-1)?.text;
  expect(first.result.current.typingReply).not.toBeNull(); first.unmount();
  const second = renderHook(() => useMemberAssistant(true, 'owner'));
  await act(async () => {});
  expect(second.result.current.messages.at(-1)?.text).toBe(complete);
  expect(second.result.current.messages.at(-1)?.restored).toBe(true);
  expect(second.result.current.typingReply).toBeNull(); expect(api.post).not.toHaveBeenCalled();
});

it('reduced motion leaves free help immediately available and restored history never acquires a reveal', async () => {
  preference.reduced = true;
  saveAssistantSession({ version: 1, owner: 'owner', createdAt: Date.now(), open: true, draft: '', recoveryKey: null, pending: null,
    messages: [{ id: 'saved', role: 'assistant', text: 'An earlier reply' }] });
  const { result } = renderHook(() => useMemberAssistant(true, 'owner'));
  await act(async () => {});
  expect(result.current.typingReply).toBeNull();
  act(() => { result.current.send(undefined, 'hello'); result.current.send(undefined, 'hello'); });
  expect(result.current.messages).toHaveLength(5); expect(result.current.typingReply).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
});

it('keeps the full accessible answer, withholds partial links/facts and blocks Enter and submit until completion', () => {
  const text = 'Open Help for support.';
  const model = { messages: [{ id: 'answer', role: 'assistant', text, reply: { text, source: 'SYSTEM', creditsUsed: 0,
    links: [{ label: 'Help', href: '/help' }], facts: [{ label: 'Energy', value: '100 kcal' }] } }],
    typingReply: { id: 'answer', text: 'Open H' }, busy: false, pending: null, recoveryKey: null, allowance,
    draft: 'Next question', setDraft: vi.fn(), send: vi.fn(), newChat: vi.fn(), setOpen: vi.fn(), cooldownSeconds: 0,
  } as unknown as MemberAssistantModel;
  const view = render(<AssistantConversation model={model} titleId="typing" />);
  expect(screen.getByText(text)).toHaveClass('sr-only');
  expect(screen.getByRole('status')).toHaveTextContent('Nara is typing');
  expect(screen.getByRole('status').querySelectorAll('[data-nara-typing-dot]')).toHaveLength(3);
  expect(screen.queryByRole('link', { name: 'Help' })).not.toBeInTheDocument();
  expect(screen.queryByText('100 kcal')).not.toBeInTheDocument();
  const input = screen.getByRole('combobox'); expect(input).toBeEnabled();
  fireEvent.keyDown(input, { key: 'Enter' }); fireEvent.submit(input.closest('form')!);
  expect(model.send).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'About KAINARA' })).toBeDisabled();
  view.rerender(<AssistantConversation model={{ ...model, typingReply: null }} titleId="typing" />);
  expect(screen.getByRole('link', { name: 'Help' })).toHaveAttribute('href', '/help');
  expect(screen.getByText('100 kcal')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled();
  fireEvent.keyDown(input, { key: 'Enter' }); expect(model.send).toHaveBeenCalledOnce();
});

it('shows three staggered dots while waiting, pauses them in hidden tabs and removes them after the reply', () => {
  const model = { messages: [], busy: true, pending: null, allowance, draft: '', setDraft: vi.fn(), setOpen: vi.fn(),
    send: vi.fn(), newChat: vi.fn(), cooldownSeconds: 0,
  } as unknown as MemberAssistantModel;
  const view = render(<AssistantConversation model={model} titleId="waiting" />);
  const status = screen.getByRole('status'); expect(status).toHaveTextContent('Nara is thinking');
  const dots = Array.from(status.querySelectorAll<HTMLElement>('[data-nara-typing-dot]'));
  expect(dots).toHaveLength(3);
  expect(dots.map(dot => dot.style.animationDelay)).toEqual(['0ms', '160ms', '320ms']);
  expect(dots.every(dot => dot.classList.contains('motion-safe:animate-bounce'))).toBe(true);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  fireEvent(document, new Event('visibilitychange'));
  expect(dots.every(dot => dot.style.animationPlayState === 'paused')).toBe(true);
  view.rerender(<AssistantConversation model={{ ...model, busy: false }} titleId="waiting" />);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(view.container.querySelector('[data-nara-typing-dot]')).toBeNull();
});

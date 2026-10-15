import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import api from '@/lib/axios';
import AssistantComposer from './AssistantComposer';
import AssistantConversation from './AssistantConversation';
import { useMemberAssistant } from './useMemberAssistant';
import { readAssistantSession, saveAssistantSession } from '@/lib/assistant-session';
import { preserveComposerEscape } from './assistant-composer.policy';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const allowance = { tier: 'FREE', cap: 5, remaining: 5, used: 0, resetsAt: '2026-10-18T16:00:00Z' };
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear(); Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(api.get).mockResolvedValue({ data: { data: { enabled: true, allowance } } });
  vi.mocked(api.post).mockImplementation(async (_url, body) => {
    const input = body as { requestKey: string; allowAi: boolean };
    return { data: { data: input.allowAi
      ? { confirmationRequired: false, allowance, reply: { text: 'AI answer', source: 'AI', creditsUsed: 1 } }
      : { confirmationRequired: true, requestKey: input.requestKey, cost: 1, allowance } } };
  });
});
function setup(initial = '') {
  const sent = vi.fn();
  function Fixture() {
    const [draft, setDraft] = useState(initial);
    return <><output data-testid="draft">{draft}</output><AssistantComposer id="composer" draft={draft} onChange={setDraft}
      onSend={sent} disabled={false} sendBlocked={false} cooldownBlocked={false} /></>;
  }
  const view = render(<Fixture />);
  return { ...view, sent, input: screen.getByRole('combobox') as HTMLTextAreaElement };
}
function backspace(input: HTMLTextAreaElement, repeat = false) {
  fireEvent.keyDown(input, { key: 'Backspace', repeat });
  if (!repeat) fireEvent.keyUp(input, { key: 'Backspace' });
}
function mobileDelete(input: HTMLTextAreaElement) {
  fireEvent(input, new InputEvent('beforeinput', { inputType: 'deleteContentBackward', bubbles: true, cancelable: true }));
}

it.each(['Tab', 'Enter'])('selects /ai with %s without sending the command', key => {
  const { input, sent } = setup('/ai');
  expect(screen.getByRole('listbox', { name: 'Nara commands' })).toBeInTheDocument();
  fireEvent.keyDown(input, { key });
  expect(screen.queryByRole('listbox')).toBeNull(); expect(input).toHaveValue('');
  expect(screen.getByTestId('draft')).toHaveTextContent('/ai'); expect(sent).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  fireEvent.keyDown(input, { key: 'Enter' }); expect(sent).not.toHaveBeenCalled();
});

it('supports slash filtering, click selection and Escape without submitting or trapping focus', () => {
  const { input, sent } = setup('/');
  fireEvent.keyDown(input, { key: 'Escape' }); expect(screen.queryByRole('listbox')).toBeNull();
  fireEvent.change(input, { target: { value: '/a' } });
  fireEvent.click(screen.getByRole('option', { name: /Ask AI/ }));
  expect(input).toHaveValue(''); expect(sent).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: 'What is protein?' } });
  expect(screen.getByTestId('draft')).toHaveTextContent('/ai What is protein?');
});

it('formats pasted commands, protects the prefix from selection/cut, and requires two separate Backspaces', () => {
  const { input } = setup();
  fireEvent.change(input, { target: { value: '/AI What is protein?' } });
  expect(input).toHaveValue('What is protein?');
  input.setSelectionRange(0, input.value.length); fireEvent.select(input);
  fireEvent.change(input, { target: { value: '' } });
  expect(screen.getByTestId('draft')).toHaveTextContent('/ai');
  input.setSelectionRange(0, 0);
  backspace(input); expect(screen.getByText(/^Press Backspace again to remove/)).toBeInTheDocument();
  fireEvent.keyDown(input, { key: 'Backspace', repeat: true });
  expect(screen.getByTestId('draft')).toHaveTextContent('/ai');
  backspace(input); expect(screen.getByTestId('draft')).toHaveTextContent('');
});

it('removes only AI mode with two Backspaces at the start of a nonempty question', () => {
  const { input } = setup('/ai My question'); input.setSelectionRange(0, 0);
  backspace(input); backspace(input);
  expect(input).toHaveValue('My question'); expect(screen.getByTestId('draft')).toHaveTextContent(/^My question$/);
});

it('clears the first-Backspace selection on typing, caret movement and blur', () => {
  const { input } = setup('/ai Question'); input.setSelectionRange(0, 0);
  backspace(input); fireEvent.keyDown(input, { key: 'ArrowRight' });
  backspace(input); expect(screen.getByTestId('draft')).toHaveTextContent('/ai Question');
  fireEvent.blur(input); backspace(input); expect(screen.getByTestId('draft')).toHaveTextContent('/ai Question');
  fireEvent.change(input, { target: { value: 'Changed' } }); input.setSelectionRange(0, 0);
  backspace(input); expect(screen.getByTestId('draft')).toHaveTextContent('/ai Changed');
});

it('handles mobile deletion and never double-counts hardware keydown plus beforeinput', () => {
  const { input } = setup('/ai Keep text'); input.setSelectionRange(0, 0);
  fireEvent.keyDown(input, { key: 'Backspace' }); mobileDelete(input);
  expect(screen.getByTestId('draft')).toHaveTextContent('/ai Keep text');
  fireEvent.keyUp(input, { key: 'Backspace' }); mobileDelete(input);
  expect(screen.getByTestId('draft')).toHaveTextContent(/^Keep text$/);
});

it('supports two virtual-keyboard deletions without hardware events and avoids a duplicate pasted prefix', () => {
  const { input } = setup('/ai Question');
  fireEvent.change(input, { target: { value: '/ai Pasted question' } });
  expect(screen.getByTestId('draft')).toHaveTextContent(/^\/ai Pasted question$/);
  input.setSelectionRange(0, 0); mobileDelete(input);
  expect(screen.getByTestId('draft')).toHaveTextContent(/^\/ai Pasted question$/);
  mobileDelete(input); expect(screen.getByTestId('draft')).toHaveTextContent(/^Pasted question$/);
});

it('does not select/send during IME composition and preserves Shift+Enter', () => {
  const { input, sent } = setup('/ai');
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
  expect(screen.getByRole('listbox')).toBeInTheDocument(); expect(sent).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
  expect(screen.getByRole('listbox')).toBeInTheDocument(); expect(sent).not.toHaveBeenCalled();
});

it('dismisses the command popup before closing the mobile dialog with Escape', () => {
  function Mobile() {
    const [draft, setDraft] = useState('/ai');
    return <Dialog.Root defaultOpen><Dialog.Content onEscapeKeyDown={preserveComposerEscape} aria-describedby={undefined}>
      <Dialog.Title>Nara</Dialog.Title><AssistantComposer id="mobile" draft={draft} onChange={setDraft} onSend={vi.fn()}
        disabled={false} sendBlocked={false} cooldownBlocked={false} />
    </Dialog.Content></Dialog.Root>;
  }
  render(<Mobile />); const input = screen.getByRole('combobox');
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(screen.queryByRole('listbox')).toBeNull(); expect(screen.getByRole('dialog')).toBeInTheDocument();
  fireEvent.keyDown(input, { key: 'Escape' }); expect(screen.queryByRole('dialog')).toBeNull();
});

it('preserves oversized auto-formatted text and blocks sending instead of truncating', () => {
  const { input, sent } = setup(`/ai ${'q'.repeat(1000)}`);
  expect(input.value).toHaveLength(1000); expect(screen.getByText(/Your text has not been cut/)).toBeInTheDocument();
  fireEvent.keyDown(input, { key: 'Enter' }); expect(sent).not.toHaveBeenCalled();
});

it('restores credit questions, invalidates edited consent, reuses the user entry and resets after success', async () => {
  const { result } = renderHook(() => useMemberAssistant(true, 'owner'));
  await waitFor(() => expect(result.current.enabled).toBe(true));
  await act(async () => result.current.send(undefined, 'What is protein?'));
  const id = result.current.messages[0].id;
  expect(result.current.draft).toBe('/ai What is protein?'); expect(result.current.pending?.message).toBe(result.current.draft);
  act(() => result.current.setDraft('/ai What is carbohydrate?'));
  expect(result.current.pending).toBeNull();
  await act(async () => result.current.confirm()); expect(api.post).toHaveBeenCalledTimes(1);
  await act(async () => result.current.send());
  expect(result.current.messages.filter(entry => entry.role === 'user')).toHaveLength(1);
  expect(result.current.messages[0]).toMatchObject({ id, text: '/ai What is carbohydrate?' });
  expect((vi.mocked(api.post).mock.calls[1][1] as { context: unknown[] }).context).toHaveLength(0);
  await act(async () => result.current.confirm());
  expect(vi.mocked(api.post).mock.calls[2][1]).toMatchObject({ message: '/ai What is carbohydrate?', allowAi: true });
  expect(result.current.draft).toBe(''); expect(result.current.messages.at(-1)?.text).toBe('AI answer');
});

it('cancel preserves an editable formatted draft, removes the unconfirmed bubble and never spends', async () => {
  const { result } = renderHook(() => useMemberAssistant(true));
  await waitFor(() => expect(result.current.enabled).toBe(true));
  await act(async () => result.current.send(undefined, 'What is protein?'));
  act(() => result.current.cancel());
  expect(result.current.draft).toBe('/ai What is protein?'); expect(result.current.pending).toBeNull();
  expect(result.current.messages.some(entry => entry.role === 'user')).toBe(false);
  expect(api.post).toHaveBeenCalledTimes(1);
  act(() => result.current.newChat()); expect(result.current.draft).toBe('');
});

it('restores an edited, unconfirmed entry after refresh and migrates old pending sessions without automatic spending', async () => {
  const first = renderHook(() => useMemberAssistant(true, 'owner'));
  await waitFor(() => expect(first.result.current.enabled).toBe(true));
  await act(async () => first.result.current.send(undefined, 'What is protein?'));
  act(() => first.result.current.setDraft('/ai What is fat?'));
  expect(readAssistantSession('owner')?.draftEntryId).toBe(first.result.current.messages[0].id);
  first.unmount();
  const second = renderHook(() => useMemberAssistant(true, 'owner'));
  await waitFor(() => expect(second.result.current.draft).toBe('/ai What is fat?'));
  await act(async () => second.result.current.send());
  expect(second.result.current.messages.filter(entry => entry.role === 'user')).toHaveLength(1);
  second.unmount();
  saveAssistantSession({ version: 1, owner: 'legacy', createdAt: Date.now(), open: false, draft: '', recoveryKey: null,
    messages: [{ id: 'old', role: 'user', text: 'What is protein?' }],
    pending: { requestKey: crypto.randomUUID(), message: 'What is protein?', allowAi: false, context: [] } });
  const posts = vi.mocked(api.post).mock.calls.length;
  const legacy = renderHook(() => useMemberAssistant(true, 'legacy'));
  await waitFor(() => expect(legacy.result.current.draft).toBe('/ai What is protein?'));
  expect(legacy.result.current.pending?.allowAi).toBe(false); expect(api.post).toHaveBeenCalledTimes(posts);
});

it('keeps the restored composer editable while consent is displayed', async () => {
  function Chat() { const model = useMemberAssistant(true); return <AssistantConversation model={model} titleId="edit" />; }
  render(<Chat />); const input = screen.getByRole('combobox');
  fireEvent.change(input, { target: { value: 'What is protein?' } }); fireEvent.keyDown(input, { key: 'Enter' });
  await screen.findByRole('region', { name: 'Confirm AI credit use' });
  expect(input).toBeEnabled(); expect(input).toHaveValue('What is protein?');
  fireEvent.change(input, { target: { value: 'What is fat?' } });
  expect(screen.queryByRole('region', { name: 'Confirm AI credit use' })).toBeNull();
});

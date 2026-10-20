import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import api from '@/lib/axios';
import { useMemberAssistant } from './useMemberAssistant';
import { ASSISTANT_SESSION_PREFIX, ASSISTANT_SESSION_TTL, clearAssistantSessions, readAssistantSession, saveAssistantSession, type AssistantSession } from '@/lib/assistant-session';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const allowance = { tier: 'FREE', cap: 5, remaining: 5, used: 0, resetsAt: '2099-10-18T16:00:00Z' };
const requestKey = '0282d844-a172-4a04-a760-79cbf4285899';
const session = (overrides: Partial<AssistantSession> = {}): AssistantSession => ({ version: 1, owner: 'owner', createdAt: Date.now(), open: true,
  draft: 'draft', recoveryKey: null, pending: null, messages: [{ id: 'message', role: 'user', text: 'hello', createdAt: Date.now() }], ...overrides });
beforeEach(() => {
  sessionStorage.clear(); vi.clearAllMocks();
  vi.mocked(api.get).mockResolvedValue({ data: { data: { enabled: true, allowance } } });
});
afterEach(() => { vi.restoreAllMocks(); });

it('restores /ai confirmation with its original command and never auto-confirms after refresh', async () => {
  saveAssistantSession(session({ open: false, messages: [], pending: { requestKey, allowAi: false,
    message: '/ai why weekly weight?', context: [] } }));
  const { result } = renderHook(() => useMemberAssistant(true, 'owner'));
  await waitFor(() => expect(result.current.pending?.message).toBe('/ai why weekly weight?'));
  expect(api.post).not.toHaveBeenCalled(); expect(result.current.pending?.allowAi).toBe(false);
});

it('restores conversation, draft and open state after remount without posting or reusing a balance', async () => {
  const first = renderHook(() => useMemberAssistant(true, 'owner'));
  await waitFor(() => expect(first.result.current.enabled).toBe(true));
  act(() => first.result.current.send(undefined, 'how to report issue?'));
  act(() => { first.result.current.setDraft('unsent question'); first.result.current.setOpen(true); });
  first.unmount();
  const second = renderHook(() => useMemberAssistant(true, 'owner'));
  await waitFor(() => expect(second.result.current.messages).toHaveLength(2));
  expect(second.result.current.messages[1].text).toContain('Contact Support');
  expect(second.result.current.messages[1].restored).toBe(true);
  expect(second.result.current.draft).toBe('unsent question'); expect(second.result.current.open).toBe(true);
  expect(api.post).not.toHaveBeenCalled(); expect(api.get).toHaveBeenCalledTimes(2);
  act(() => second.result.current.newChat());
  expect(readAssistantSession('owner')).toBeNull();
});

it('bounds history to 40 messages and rejects expired, corrupt, future and wrong-owner storage', () => {
  saveAssistantSession(session({ messages: Array.from({ length: 55 }, (_, i) => ({ id: `${i}`, role: 'user', text: `${i}` })) }));
  expect(readAssistantSession('owner')?.messages).toHaveLength(40);
  expect(readAssistantSession('owner')?.messages[0].text).toBe('15');
  saveAssistantSession(session({ createdAt: Date.now() - ASSISTANT_SESSION_TTL - 1 }));
  expect(readAssistantSession('owner')).toBeNull();
  sessionStorage.setItem(`${ASSISTANT_SESSION_PREFIX}owner`, '{not json');
  expect(readAssistantSession('owner')).toBeNull();
  saveAssistantSession(session({ createdAt: Date.now() + 10000 }));
  expect(readAssistantSession('owner')).toBeNull();
  saveAssistantSession(session()); expect(readAssistantSession('another-owner')).toBeNull();
  expect(readAssistantSession('owner')).toBeNull();
});

it('logout clears persisted and mounted private messages, and storage failure falls back to memory', async () => {
  saveAssistantSession(session());
  const { result } = renderHook(() => useMemberAssistant(true, 'owner'));
  await waitFor(() => expect(result.current.messages).toHaveLength(1));
  act(() => clearAssistantSessions());
  expect(result.current.messages).toEqual([]); expect(sessionStorage.length).toBe(0);
  act(() => result.current.setDraft('must not be saved after logout'));
  expect(sessionStorage.length).toBe(0);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  expect(() => saveAssistantSession(session())).not.toThrow();
});

it('restored consent never auto-confirms or calls a provider', async () => {
  saveAssistantSession(session({ pending: { requestKey, message: 'What is protein?', allowAi: false, context: [] } }));
  const { result } = renderHook(() => useMemberAssistant(true, 'owner'));
  await waitFor(() => expect(result.current.pending?.requestKey).toBe(requestKey));
  expect(api.post).not.toHaveBeenCalled();
  act(() => result.current.cancel()); expect(result.current.pending).toBeNull();
});

it('recovers a successful paid request using only an owned GET and deduplicates the reply', async () => {
  saveAssistantSession(session({ recoveryKey: requestKey }));
  vi.mocked(api.get).mockImplementation(async path => ({ data: { data: String(path).includes('/requests/')
    ? { status: 'SUCCEEDED', reply: { text: 'Recovered answer', source: 'AI', creditsUsed: 1 }, allowance: { ...allowance, remaining: 4, used: 1 } }
    : { enabled: true, allowance } } }));
  const { result } = renderHook(() => useMemberAssistant(true, 'owner'));
  await waitFor(() => expect(result.current.messages.some(item => item.text === 'Recovered answer')).toBe(true));
  expect(result.current.recoveryKey).toBeNull(); expect(result.current.allowance?.remaining).toBe(4);
  expect(api.post).not.toHaveBeenCalled();
  expect(api.get).toHaveBeenCalledWith(`/user/assistant/requests/${requestKey}`, expect.objectContaining({ skipTransientRetry: true }));
});

it('running and not-yet-found requests offer manual checks without a paid retry or a false no-credit claim', async () => {
  saveAssistantSession(session({ recoveryKey: requestKey }));
  vi.mocked(api.get).mockImplementation(async path => ({ data: { data: String(path).includes('/requests/')
    ? { status: 'RUNNING', allowance } : { enabled: true, allowance } } }));
  const { result } = renderHook(() => useMemberAssistant(true, 'owner'));
  await waitFor(() => expect(result.current.recoveryStatus).toContain('still running'));
  act(() => result.current.send(undefined, 'What is protein?'));
  expect(api.post).not.toHaveBeenCalled();
  vi.mocked(api.get).mockResolvedValue({ data: { data: { status: 'NOT_FOUND', allowance } } });
  act(() => result.current.checkRecovery());
  await waitFor(() => expect(result.current.recoveryStatus).toContain('No saved reply'));
  expect(result.current.recoveryKey).toBe(requestKey);
  expect(result.current.recoveryStatus).not.toContain('No credit was spent');
  expect(api.post).not.toHaveBeenCalled();
});

it('failed/expired paid work is not replayed and a new question still requires explicit consent', async () => {
  saveAssistantSession(session({ recoveryKey: requestKey }));
  vi.mocked(api.get).mockImplementation(async path => ({ data: { data: String(path).includes('/requests/')
    ? { status: 'EXPIRED', allowance } : { enabled: true, allowance } } }));
  const { result } = renderHook(() => useMemberAssistant(true, 'owner'));
  await waitFor(() => expect(result.current.messages.some(item => item.text.includes('did not complete'))).toBe(true));
  expect(result.current.recoveryKey).toBeNull(); expect(api.post).not.toHaveBeenCalled();
});

it('food facts enter preflight while support remains entirely local', async () => {
  vi.mocked(api.post).mockResolvedValue({ data: { data: { confirmationRequired: true, requestKey, cost: 1, allowance } } });
  const { result } = renderHook(() => useMemberAssistant(true, 'owner'));
  await waitFor(() => expect(result.current.enabled).toBe(true));
  act(() => result.current.send(undefined, 'how to report issue?'));
  expect(api.post).not.toHaveBeenCalled();
  act(() => result.current.send(undefined, 'can you tell me the nutrition fact of pandesal'));
  await waitFor(() => expect(result.current.pending).not.toBeNull());
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(vi.mocked(api.post).mock.calls[0][1]).toMatchObject({ allowAi: false });
});

it('a definite credit admission rejection unlocks free help instead of waiting for a nonexistent receipt', async () => {
  vi.mocked(api.post).mockResolvedValueOnce({ data: { data: { confirmationRequired: true, requestKey, cost: 1, allowance } } })
    .mockRejectedValueOnce({ response: { data: { error: 'Credits exhausted', errorCode: 'ASSISTANT_CREDITS_EXHAUSTED' } } });
  const { result } = renderHook(() => useMemberAssistant(true, 'owner'));
  await waitFor(() => expect(result.current.enabled).toBe(true));
  act(() => result.current.send(undefined, 'What is protein?'));
  await waitFor(() => expect(result.current.pending).not.toBeNull());
  act(() => result.current.confirm());
  await waitFor(() => expect(result.current.error).toBe('Credits exhausted'));
  expect(result.current.recoveryKey).toBeNull();
  act(() => result.current.send(undefined, 'how to report issue?'));
  expect(result.current.messages.at(-1)?.text).toContain('Contact Support');
  expect(api.post).toHaveBeenCalledTimes(2);
});

it('a failed paid HTTP request checks its receipt once and unlocks a confirmed failure without another AI POST', async () => {
  vi.mocked(api.post).mockResolvedValueOnce({ data: { data: { confirmationRequired: true, requestKey, cost: 1, allowance } } })
    .mockRejectedValueOnce({ response: { status: 502, data: { error: 'AI could not return usable results.', errorCode: 'AI_INVALID_RESPONSE' } } });
  vi.mocked(api.get).mockImplementation(async path => ({ data: { data: String(path).includes('/requests/')
    ? { status: 'FAILED', allowance } : { enabled: true, allowance } } }));
  const { result } = renderHook(() => useMemberAssistant(true, 'owner'));
  await waitFor(() => expect(result.current.enabled).toBe(true));
  act(() => result.current.send(undefined, 'Chicken dinner with at least 25 g protein'));
  await waitFor(() => expect(result.current.pending).not.toBeNull());
  act(() => result.current.confirm());
  await waitFor(() => expect(result.current.messages.at(-1)?.text).toContain('No credit was spent'));
  expect(result.current.recoveryKey).toBeNull(); expect(result.current.busy).toBe(false);
  expect(vi.mocked(api.get).mock.calls.filter(([path]) => String(path).includes('/requests/'))).toHaveLength(1);
  expect(api.post).toHaveBeenCalledTimes(2);
  act(() => result.current.send(undefined, 'how to report issue?'));
  expect(result.current.messages.at(-1)?.text).toContain('Contact Support');
});

it('uncertain delivery checks once but never replays or charges for a still-running request', async () => {
  vi.mocked(api.post).mockResolvedValueOnce({ data: { data: { confirmationRequired: true, requestKey, cost: 1, allowance } } })
    .mockRejectedValueOnce(new Error('Network error'));
  vi.mocked(api.get).mockImplementation(async path => ({ data: { data: String(path).includes('/requests/')
    ? { status: 'RUNNING', allowance } : { enabled: true, allowance } } }));
  const { result } = renderHook(() => useMemberAssistant(true, 'owner'));
  await waitFor(() => expect(result.current.enabled).toBe(true));
  act(() => result.current.send(undefined, 'What is protein?'));
  await waitFor(() => expect(result.current.pending).not.toBeNull());
  act(() => result.current.confirm());
  await waitFor(() => expect(result.current.recoveryStatus).toContain('still running'));
  expect(result.current.recoveryKey).toBe(requestKey); expect(result.current.busy).toBe(false);
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(vi.mocked(api.get).mock.calls.filter(([path]) => String(path).includes('/requests/'))).toHaveLength(1);
});

vi.mock('./assistant-activity', () => ({ recordLocalAssistantMessage: vi.fn() }));

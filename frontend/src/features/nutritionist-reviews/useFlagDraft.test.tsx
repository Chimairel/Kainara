import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import api from '@/lib/axios';
import { useFlagDraft } from './useFlagDraft';
import { emptyFlagReason } from './FlagReasonFields';
vi.mock('@/lib/axios', () => ({ default: { post: vi.fn() } }));
const target = { kind: 'MEAL' as const, targetId: 'recipe' }, version = 'a'.repeat(64);
const free = { blocked: false, canFlag: true, ownerName: null, expiresAt: null, draft: null };
const owned = { ...free, ownerName: 'Test RND', draft: { id: 'lease', expectedVersion: version, notes: { ...emptyFlagReason, explanation: 'Saved private draft' } } };
const response = (data: unknown) => ({ data: { success: true, data } });
beforeEach(() => vi.resetAllMocks());

it('waits for an atomic begin response and suppresses duplicate clicks', async () => {
  let resolve!: (value: unknown) => void;
  vi.mocked(api.post).mockImplementation(async url => url.endsWith('/status') ? response(free) : new Promise(done => { resolve = done; }));
  const { result } = renderHook(() => useFlagDraft(target, version));
  await waitFor(() => expect(result.current.ready).toBe(true));
  let started!: Promise<boolean>;
  act(() => { started = result.current.begin(); void result.current.begin(); });
  expect(result.current.writing).toBe(false);
  expect(vi.mocked(api.post).mock.calls.filter(([url]) => url.endsWith('/begin'))).toHaveLength(1);
  await act(async () => { resolve(response(owned)); await started; });
  expect(result.current.writing).toBe(true);
  expect(result.current.notes.explanation).toBe('Saved private draft');
});

it('keeps a competing RND read-only without receiving private draft notes', async () => {
  vi.mocked(api.post).mockResolvedValue(response({ ...free, blocked: true, ownerName: 'Other RND' }));
  const { result } = renderHook(() => useFlagDraft(target, version));
  await waitFor(() => expect(result.current.status?.blocked).toBe(true));
  expect(result.current.ready).toBe(false); expect(result.current.writing).toBe(false);
  expect(result.current.notes).toEqual(emptyFlagReason);
});

it('ignores a status response started before a successful begin', async () => {
  let resolve!: (value: unknown) => void;
  vi.mocked(api.post).mockImplementation(async url => url.endsWith('/status')
    ? new Promise(done => { resolve = done; }) : response(owned));
  const { result } = renderHook(() => useFlagDraft(target, version));
  await act(async () => { expect(await result.current.begin()).toBe(true); });
  await act(async () => { resolve(response(free)); });
  expect(result.current.writing).toBe(true);
  expect(result.current.notes.explanation).toBe('Saved private draft');
});

it('restores the owner draft, saves privately and cancels after saving finishes', async () => {
  vi.mocked(api.post).mockImplementation(async (url, body) => response(url.endsWith('/cancel') ? free : url.endsWith('/save') ? { ...owned, draft: { ...owned.draft, notes: (body as { notes: unknown }).notes } } : owned));
  const { result } = renderHook(() => useFlagDraft(target, version));
  await waitFor(() => expect(result.current.writing).toBe(true));
  act(() => result.current.setNotes({ ...result.current.notes, reference: 'Private source note' }));
  await act(async () => { expect(await result.current.save()).toBe(true); expect(await result.current.cancel()).toBe(true); });
  expect(result.current.writing).toBe(false); expect(result.current.notes).toEqual(emptyFlagReason);
  expect(api.post).toHaveBeenCalledWith('/nutritionist/flag-drafts/cancel', { target, expectedVersion: version, draftId: 'lease' });
});

it('serializes saves and flushes edits made during the previous request', async () => {
  let resolve!: (value: unknown) => void;
  let calls = 0;
  vi.mocked(api.post).mockImplementation(async (url, body) => {
    if (!url.endsWith('/save')) return response(owned);
    if (++calls === 1) return new Promise(done => { resolve = done; });
    return response({ ...owned, draft: { ...owned.draft, notes: (body as { notes: unknown }).notes } });
  });
  const { result } = renderHook(() => useFlagDraft(target, version));
  await waitFor(() => expect(result.current.writing).toBe(true));
  act(() => result.current.setNotes({ ...result.current.notes, explanation: 'First edit' }));
  let first!: Promise<boolean>, last!: Promise<boolean>;
  act(() => { first = result.current.save(); });
  act(() => result.current.setNotes({ ...result.current.notes, explanation: 'Latest edit' }));
  act(() => { last = result.current.save(); });
  await act(async () => { resolve(response(owned)); await first; await last; });
  expect(calls).toBe(2);
  expect(result.current.notes.explanation).toBe('Latest edit');
  expect(api.post).toHaveBeenLastCalledWith('/nutritionist/flag-drafts/save', expect.objectContaining({ notes: expect.objectContaining({ explanation: 'Latest edit' }) }));
});

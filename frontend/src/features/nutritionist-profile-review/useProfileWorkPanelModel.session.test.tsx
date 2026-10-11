import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSessionResourceCache } from '@/lib/session-resource-cache';
import { useProfileWorkPanelModel } from './useProfileWorkPanelModel';

const state = vi.hoisted(() => ({ owner: 'reviewer-a', get: vi.fn(), post: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: state.owner } }) }));
vi.mock('@/lib/axios', () => ({ default: { get: state.get, post: state.post } }));
vi.mock('@/hooks/useVisiblePolling', () => ({ useVisiblePolling: vi.fn() }));
const person = {
  userId: 'member-a',
  name: 'Private member A',
  currentProfile: { revision: 1 },
  reports: [],
  documents: [],
  requirements: [],
  availableAreas: [],
  profileReview: { scopeKey: 'scope', profileRevision: 1, requirements: [], availableAreas: [] },
};

describe('profile workspace session isolation', () => {
  beforeEach(() => {
    clearSessionResourceCache();
    state.owner = 'reviewer-a';
    state.get
      .mockReset()
      .mockImplementation(async (url: string) => ({ data: { data: url.endsWith('member-a') ? person : [] } }));
    state.post.mockReset();
  });

  it('discards an old profile response after the signed-in reviewer changes', async () => {
    let complete!: (value: unknown) => void;
    const hook = renderHook(useProfileWorkPanelModel);
    await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
    state.get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        })
    );
    let pending!: Promise<void>;
    act(() => {
      pending = hook.result.current.openPerson('member-a');
    });
    state.owner = 'reviewer-b';
    hook.rerender();
    expect(hook.result.current.detail).toBeNull();
    await act(async () => {
      complete({ data: { data: person } });
      await pending;
    });
    expect(hook.result.current.detail).toBeNull();
    expect(hook.result.current.people).toEqual([]);
    hook.unmount();
  });

  it('ignores a late claim error from a previous account', async () => {
    let reject!: (cause: Error) => void;
    const hook = renderHook(useProfileWorkPanelModel);
    await act(async () => {
      await hook.result.current.openPerson('member-a');
    });
    state.post.mockImplementationOnce(
      () =>
        new Promise((_resolve, no) => {
          reject = no;
        })
    );
    let pending!: Promise<void>;
    act(() => {
      pending = hook.result.current.claimProfile();
    });
    state.owner = 'reviewer-b';
    hook.rerender();
    await act(async () => {
      reject(new Error('Previous member claim failed'));
      await pending;
    });
    expect(hook.result.current.error).toBeNull();
    expect(hook.result.current.detail).toBeNull();
    hook.unmount();
  });
});

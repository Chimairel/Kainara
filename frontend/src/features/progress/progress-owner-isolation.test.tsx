import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormEvent } from 'react';
import { clearSessionResourceCache, readSessionResource } from '@/lib/session-resource-cache';
import { useProgressWorkspace } from './useProgressWorkspace';

const state = vi.hoisted(() => ({ owner: 'first', profile: vi.fn(), get: vi.fn(), put: vi.fn(), session: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { userId: state.owner }, updateUserSession: state.session }),
}));
vi.mock('@/lib/user-profile-resource', () => ({
  getRecentUserProfile: state.profile,
  refreshUserProfile: state.profile,
}));
vi.mock('@/lib/axios', () => ({ default: { get: state.get, put: state.put, post: vi.fn() } }));
const profile = (id: string) => ({ id, userProfile: { age: 25, weightKg: id === 'first' ? 60 : 70 } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  clearSessionResourceCache();
  vi.clearAllMocks();
  state.owner = 'first';
  state.profile.mockImplementation(async (owner: string) => profile(owner));
  state.get.mockResolvedValue({ data: { success: true, data: { weightLogs: [], dailyNutritionLogs: [] } } });
});
describe('progress and profile account isolation', () => {
  it('never saves the previous account snapshot under the new owner while loading', async () => {
    const next = deferred<ReturnType<typeof profile>>();
    const { result, rerender } = renderHook(() => useProgressWorkspace('health'));
    await waitFor(() => expect(result.current.currentWeight).toBe(60));
    state.profile.mockReturnValue(next.promise);
    state.owner = 'second';
    rerender();
    expect(result.current.profileData).toBeNull();
    expect(result.current.weightKg).toBe('');
    expect(readSessionResource('second', 'user-progress-page')).toBeNull();
    await act(async () => next.resolve(profile('second')));
    expect(result.current.currentWeight).toBe(70);
  });
  it('discards a late previous-account initial read', async () => {
    const old = deferred<ReturnType<typeof profile>>();
    state.profile.mockImplementation((owner: string) =>
      owner === 'first' ? old.promise : Promise.resolve(profile(owner))
    );
    const { result, rerender } = renderHook(() => useProgressWorkspace('health'));
    state.owner = 'second';
    rerender();
    await waitFor(() => expect(result.current.currentWeight).toBe(70));
    await act(async () => old.resolve(profile('first')));
    expect(result.current.currentWeight).toBe(70);
    expect(readSessionResource('first', 'user-progress-page')).toBeNull();
  });
  it('discards a previous-account save completion instead of changing the current session', async () => {
    const old = deferred<{ data: { success: boolean; data: ReturnType<typeof profile> } }>();
    state.put.mockReturnValue(old.promise);
    const { result, rerender } = renderHook(() => useProgressWorkspace('health'));
    await waitFor(() => expect(result.current.currentWeight).toBe(60));
    let saving!: Promise<void>;
    act(() => {
      saving = result.current.handleBiometricsSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
    });
    state.owner = 'second';
    rerender();
    await waitFor(() => expect(result.current.currentWeight).toBe(70));
    await act(async () => {
      old.resolve({ data: { success: true, data: profile('first') } });
      await saving;
    });
    expect(result.current.currentWeight).toBe(70);
    expect(state.session).not.toHaveBeenCalled();
    expect(result.current.showRegenerateModal).toBe(false);
  });
});

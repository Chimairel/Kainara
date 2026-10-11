import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useNutritionistProfilePageModel } from './useNutritionistProfilePageModel';
const state = vi.hoisted(() => ({ owner: 'rnd-a', profile: { id: 'profile-a', bio: 'Recorded biography A', specialization: 'Recorded focus A', prcLicenseNumber: 'A', prcLicenseExpiry: '2030-01-01', isVerified: true, totalVerified: 0 } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: state.owner }, logout: vi.fn() }) }));
vi.mock('@/hooks/useSessionQuery', () => ({ useSessionQuery: () => ({ data: state.profile, error: null, isLoading: false, setData: vi.fn(), refetch: vi.fn() }) }));
it('preserves unsaved biography while background profile data refreshes, then clears the draft for another owner', () => {
  const hook = renderHook(() => useNutritionistProfilePageModel());
  if (hook.result.current.kind !== 'ready') throw new Error('Profile did not load');
  act(() => hook.result.current.kind === 'ready' && hook.result.current.setBio('Unsaved RND A draft'));
  state.profile = { ...state.profile, bio: 'Background update A' }; hook.rerender();
  expect(hook.result.current.kind === 'ready' && hook.result.current.bio).toBe('Unsaved RND A draft');
  state.owner = 'rnd-b'; state.profile = { ...state.profile, id: 'profile-b', bio: 'Recorded biography B' }; hook.rerender();
  expect(hook.result.current.kind === 'ready' && hook.result.current.bio).toBe('Recorded biography B');
  hook.unmount();
});

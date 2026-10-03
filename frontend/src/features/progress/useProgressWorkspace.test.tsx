import { LIVE_UPDATE_EVENT } from '@/lib/live-events';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FormEvent } from 'react';
import { useProgressWorkspace } from './useProgressWorkspace';

const state = vi.hoisted(() => ({
  put: vi.fn(),
  get: vi.fn(),
  profile: {
    id: 'fixture-user',
    userProfile: {
      age: 25,
      heightCm: 165,
      weightKg: 60,
      goal: 'MAINTAIN',
      biologicalSex: 'FEMALE',
      activityLevel: 'SEDENTARY',
      dietaryPreference: 'OMNIVORE',
      ricePreference: 'FLEXIBLE',
      foodCulture: 'Filipino',
      planningGeographyLevel: 'PROVINCE_HUC',
      planningRegionName: 'Central Visayas',
      planningProvinceHucName: 'Cebu',
    },
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { userId: 'fixture-user' }, updateUserSession: vi.fn() }),
}));
vi.mock('@/lib/axios', () => ({ default: { put: state.put, get: state.get } }));
vi.mock('@/lib/user-profile-resource', () => ({
  getRecentUserProfile: () => Promise.resolve(state.profile),
  refreshUserProfile: () => Promise.resolve(state.profile),
}));
vi.mock('@/lib/session-resource-cache', () => ({ readSessionResource: () => null, writeSessionResource: vi.fn() }));

describe('profile saves without hidden location changes', () => {
  it('loads the starting observation from history while keeping the current profile weight separate', async () => {
    state.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          weightLogs: [
            {
              id: 'baseline',
              weightKg: 57,
              loggedAt: '2026-10-04T02:00:00Z',
              note: 'Starting weight from onboarding',
              source: 'ONBOARDING',
            },
          ],
          dailyNutritionLogs: [],
        },
      },
    });
    const { result } = renderHook(() => useProgressWorkspace('progress'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.groupedLogs).toHaveLength(1);
    expect(result.current.groupedLogs[0].weightKg).toBe(57);
    expect(result.current.currentWeight).toBe(60);
  });
  it('keeps old saved location out of the planning update payload', async () => {
    state.put.mockResolvedValue({ data: { success: true, data: state.profile } });
    const { result } = renderHook(() => useProgressWorkspace('planning'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => result.current.handleBiometricsSubmit({ preventDefault: vi.fn() } as unknown as FormEvent));
    expect(state.put).toHaveBeenCalledWith(
      '/user/profile',
      expect.objectContaining({ ricePreference: 'FLEXIBLE', dietaryPreference: 'OMNIVORE' })
    );
    const payload = state.put.mock.calls[0][1];
    for (const field of ['planningGeographyLevel', 'planningRegionName', 'planningProvinceHucName'])
      expect(payload).not.toHaveProperty(field);
    expect(result.current.biometricsError).toBeNull();
  });
  it('refreshes saved profile data without overwriting unsaved health input', async () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const { result, unmount } = renderHook(() => useProgressWorkspace('health'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => result.current.setWeightKg('72'));
    await act(async () => {
      window.dispatchEvent(new Event(LIVE_UPDATE_EVENT));
    });
    expect(result.current.weightKg).toBe('72');
    unmount();
    vi.restoreAllMocks();
  });
});

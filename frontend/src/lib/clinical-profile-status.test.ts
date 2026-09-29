import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/axios';
import { clearSessionResourceCache } from '@/lib/session-resource-cache';
import type { UserProfileData } from '@/hooks/useProfile';
import { cachedClinicalProfileStatus, refreshClinicalProfileStatus } from './clinical-profile-status';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));

const profile = (safetyRevision: number) => ({ userProfile: { safetyRevision } }) as UserProfileData;

describe('clinical profile status cache', () => {
  beforeEach(() => {
    clearSessionResourceCache();
    vi.clearAllMocks();
  });

  it('reuses one live status read but does not carry approval into a new safety revision', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: { required: true, approved: true } } });
    const [first, second] = await Promise.all([
      refreshClinicalProfileStatus('user-a', profile(3)),
      refreshClinicalProfileStatus('user-a', profile(3)),
    ]);
    expect(first).toEqual(second);
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(cachedClinicalProfileStatus('user-a', profile(3))?.approved).toBe(true);
    expect(cachedClinicalProfileStatus('user-a', profile(4))).toBeNull();
    expect(cachedClinicalProfileStatus('user-b', profile(3))).toBeNull();
  });
});

import api from '@/lib/axios';
import type { UserProfileData } from '@/hooks/useProfile';
import { readSessionResource, refreshSessionResource } from '@/lib/session-resource-cache';
import { cookieHelper, decodeToken } from '@/lib/auth';

export const userProfileResource = 'user-profile';

export type SessionProfileData = UserProfileData & {
  reportAcknowledged?: boolean;
  image?: string;
  googleImage?: string;
  authMethods?: { password: boolean; google: boolean };
  nutritionReport: (NonNullable<UserProfileData['nutritionReport']> & { profileRevision?: number }) | null;
};

export function cachedUserProfile(ownerId: string | undefined) {
  return readSessionResource<SessionProfileData>(ownerId, userProfileResource);
}

export function refreshUserProfile(ownerId: string | undefined): Promise<SessionProfileData> {
  return refreshSessionResource<SessionProfileData>(ownerId, userProfileResource, async () => {
    // A stalled session check must resolve to the retry state rather than leave
    // every protected route behind the full-screen loading state indefinitely.
    let response;
    try {
      response = await api.get('/user/profile', { timeout: 45_000 });
    } catch (error) {
      const failure = error as { code?: string; response?: { status?: number } } | null;
      const transient =
        ['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK'].includes(failure?.code ?? '') ||
        [502, 503, 504].includes(failure?.response?.status ?? 0);
      const currentOwner = decodeToken(cookieHelper.get('nutrimind_session') || '')?.userId;
      if (!transient || !ownerId || currentOwner !== ownerId) throw error;
      // One fresh retry, within a total 60-second budget; never authorize from cached/token claims.
      response = await api.get('/user/profile', { timeout: 15_000 });
    }
    if (!response.data?.success) throw new Error('Profile response was unsuccessful.');
    return response.data.data as SessionProfileData;
  });
}

export function getRecentUserProfile(ownerId: string | undefined, maxAgeMs = 30_000): Promise<SessionProfileData> {
  const cached = readSessionResource<SessionProfileData>(ownerId, userProfileResource, maxAgeMs);
  return cached ? Promise.resolve(cached) : refreshUserProfile(ownerId);
}

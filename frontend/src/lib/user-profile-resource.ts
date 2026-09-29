import api from '@/lib/axios';
import type { UserProfileData } from '@/hooks/useProfile';
import { readSessionResource, refreshSessionResource } from '@/lib/session-resource-cache';

export const userProfileResource = 'user-profile';

export type SessionProfileData = UserProfileData & {
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
    const response = await api.get('/user/profile');
    if (!response.data?.success) throw new Error('Profile response was unsuccessful.');
    return response.data.data as SessionProfileData;
  });
}

export function getRecentUserProfile(ownerId: string | undefined, maxAgeMs = 30_000): Promise<SessionProfileData> {
  const cached = readSessionResource<SessionProfileData>(ownerId, userProfileResource, maxAgeMs);
  return cached ? Promise.resolve(cached) : refreshUserProfile(ownerId);
}

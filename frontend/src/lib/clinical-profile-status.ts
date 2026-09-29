import api from '@/lib/axios';
import type { UserProfileData } from '@/hooks/useProfile';
import { readSessionResource, refreshSessionResource } from '@/lib/session-resource-cache';

export interface ClinicalProfileStatus {
  required: boolean;
  approved: boolean;
  declarationRequired?: boolean;
  documentRequest?: { area: string | null; notes: string | null } | null;
}

// A profile safety change gets a different cache key, so an earlier approval
// cannot unlock a newly edited health profile during navigation.
const resource = (profile: UserProfileData | null) =>
  `clinical-profile-status:${profile?.userProfile?.safetyRevision ?? 'unknown'}`;

export function cachedClinicalProfileStatus(ownerId: string | undefined, profile: UserProfileData | null) {
  return readSessionResource<ClinicalProfileStatus>(ownerId, resource(profile));
}

export function refreshClinicalProfileStatus(ownerId: string | undefined, profile: UserProfileData | null) {
  return refreshSessionResource<ClinicalProfileStatus>(ownerId, resource(profile), async () => {
    const response = await api.get('/user/clinical-profile-review/status');
    if (!response.data?.success) throw new Error('Clinical profile status response was unsuccessful.');
    return response.data.data as ClinicalProfileStatus;
  });
}

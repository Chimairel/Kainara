'use client';
import { useRef, useState } from 'react';
import api from '@/lib/axios';
import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import { getApiErrorMessage } from '@/lib/api-error';
import NutritionistProfileSkeleton from '@/features/profile/NutritionistProfileSkeleton';
import Button from '@/components/ui/Button';
import type { NProfile } from './NutritionistProfilePage.shared';

export function useNutritionistProfilePageModel() {
  const { logout, user } = useAuth();
  const ownerId = user?.userId;
  const currentOwner = useRef(ownerId);
  currentOwner.current = ownerId;
  const query = useSessionQuery<NProfile>({
    ownerId,
    resource: 'nutritionist-profile',
    pollIntervalMs: 60000,
    errorMessage: 'Your professional profile could not be loaded. Please try again.',
    fetcher: async () => {
      const response = await api.get('/nutritionist/profile');
      if (!response.data?.success || !response.data.data) throw new Error('Professional profile unavailable.');
      return response.data.data;
    },
  });
  const profile = query.data;
  const [draft, setDraft] = useState<{ ownerId?: string; bio?: string; specialization?: string }>({});
  const bio = draft.ownerId === ownerId ? (draft.bio ?? profile?.bio ?? '') : (profile?.bio ?? '');
  const specialization =
    draft.ownerId === ownerId
      ? (draft.specialization ?? profile?.specialization ?? '')
      : (profile?.specialization ?? '');
  const setBio = (value: string) =>
    setDraft((previous) => ({ ...(previous.ownerId === ownerId ? previous : {}), ownerId, bio: value }));
  const setSpecialization = (value: string) =>
    setDraft((previous) => ({ ...(previous.ownerId === ownerId ? previous : {}), ownerId, specialization: value }));
  const [savingOwner, setSavingOwner] = useState<string | null>(null);
  const saving = !!ownerId && savingOwner === ownerId;
  const [feedback, setFeedback] = useState<{ ownerId?: string; error?: string; success?: string }>({});
  const [copiedOwner, setCopiedOwner] = useState<string | null>(null);
  const [previewOwner, setPreviewOwner] = useState<string | null>(null);
  async function handleSave() {
    if (!ownerId || saving) return;
    setSavingOwner(ownerId);
    setFeedback({ ownerId });
    try {
      const response = await api.patch('/nutritionist/profile', { bio, specialization });
      if (currentOwner.current !== ownerId) return;
      query.setData(response.data.data);
      setFeedback({ ownerId, success: 'Professional profile updated successfully.' });
    } catch (cause) {
      if (currentOwner.current === ownerId)
        setFeedback({
          ownerId,
          error: getApiErrorMessage(cause, 'Your professional profile could not be saved. Please try again.'),
        });
    } finally {
      if (currentOwner.current === ownerId) setSavingOwner(null);
    }
  }
  function copyLicense() {
    if (!profile?.prcLicenseNumber || !ownerId) return;
    void navigator.clipboard.writeText(profile.prcLicenseNumber);
    setCopiedOwner(ownerId);
    setTimeout(() => setCopiedOwner(null), 2000);
  }
  if (!profile)
    return {
      kind: 'early' as const,
      view: query.isLoading ? (
        <NutritionistProfileSkeleton />
      ) : (
        <div className="portal-page space-y-4">
          <p role="alert">{query.error ?? 'Your professional profile is unavailable.'}</p>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Retry professional profile
          </Button>
        </div>
      ),
    };
  const formattedExpiry = new Date(profile.prcLicenseExpiry).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  return {
    kind: 'ready' as const,
    profile,
    user,
    formattedExpiry,
    copyLicense,
    copied: copiedOwner === ownerId,
    error: (feedback.ownerId === ownerId ? feedback.error : null) ?? query.error,
    success: feedback.ownerId === ownerId ? feedback.success : null,
    specialization,
    setSpecialization,
    bio,
    setBio,
    handleSave,
    saving,
    setShowModalPreview: (open: boolean) => setPreviewOwner(open ? (ownerId ?? null) : null),
    logout,
    showModalPreview: !!ownerId && previewOwner === ownerId,
  };
}

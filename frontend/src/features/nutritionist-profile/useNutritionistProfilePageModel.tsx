'use client';
import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import { useState, useEffect } from 'react';

import api from '@/lib/axios';
import NutritionistProfileSkeleton from '@/features/profile/NutritionistProfileSkeleton';

import { useAuth } from '@/hooks/useAuth';

import { readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';

import { NProfile } from './NutritionistProfilePage.shared';
export function useNutritionistProfilePageModel() {
  const { logout, user } = useAuth();
  const ownerId = user?.userId;
  const cached = readSessionResource<NProfile>(ownerId, 'nutritionist-profile');
  const [profile, setProfile] = useState<NProfile | null>(cached);
  const [isLoading, setIsLoading] = useState(!cached);
  const [bio, setBio] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showModalPreview, setShowModalPreview] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setError(null);
        const res = await api.get('/nutritionist/profile');
        if (res.data?.success && res.data.data) {
          setProfile(res.data.data);
          writeSessionResource(ownerId, 'nutritionist-profile', res.data.data);
          setBio(res.data.data.bio || '');
          setSpecialization(res.data.data.specialization || '');
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err);
        setError('Your professional profile could not be loaded. Please refresh and try again.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [ownerId]);

  useVisiblePolling(
    async (signal) => {
      const response = await api.get('/nutritionist/profile', { signal });
      if (!signal.aborted && response.data?.success) {
        setProfile(response.data.data);
        writeSessionResource(ownerId, 'nutritionist-profile', response.data.data);
      }
      // Biography and specialization drafts stay unchanged during background reads.
    },
    { enabled: Boolean(ownerId) && !saving, immediate: false, scopeKey: ownerId }
  );

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.patch('/nutritionist/profile', { bio, specialization });
      setProfile((current) => (current ? { ...current, bio, specialization } : current));
      if (profile) writeSessionResource(ownerId, 'nutritionist-profile', { ...profile, bio, specialization });
      setSuccess('Professional profile updated successfully.');
    } catch (err) {
      console.error('Save failed:', err);
      setError('Your professional profile could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const copyLicense = () => {
    const lic = profile?.prcLicenseNumber || 'PRC-RND-NM-0001';
    navigator.clipboard.writeText(lic);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return { kind: 'early' as const, view: <NutritionistProfileSkeleton /> };
  }

  const formattedExpiry = profile?.prcLicenseExpiry
    ? new Date(profile.prcLicenseExpiry).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Dec 31, 2028';

  return {
    kind: 'ready' as const,
    profile,
    user,
    formattedExpiry,
    copyLicense,
    copied,
    error,
    success,
    specialization,
    setSpecialization,
    bio,
    setBio,
    handleSave,
    saving,
    setShowModalPreview,
    logout,
    showModalPreview,
  };
}

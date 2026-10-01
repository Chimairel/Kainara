'use client';

import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/axios';
import NutritionistProfileSkeleton from '@/features/profile/NutritionistProfileSkeleton';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import { NutritionistCredentialCard } from '@/components/user/NutritionistCredentialCard';
import NutritionistCredentialModal from '@/components/user/NutritionistCredentialModal';
import { useAuth } from '@/hooks/useAuth';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import { readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';
import {
  Check,
  UserRound,
  ShieldCheck,
  Award,
  Calendar,
  GraduationCap,
  Stethoscope,
  Copy,
  FileCheck2,
  ArrowRight,
  LogOut,
  Building2,
  CheckCircle2,
  Maximize2,
} from 'lucide-react';

interface NProfile {
  id: string;
  prcLicenseNumber: string;
  prcLicenseExpiry: string;
  specialization?: string;
  yearsOfExperience?: number;
  university?: string;
  bio?: string;
  officialHeadshot?: string | null;
  isVerified: boolean;
  totalVerified: number;
  canLeadReview?: boolean;
  verifiedAt?: string | null;
}

const SPECIALIZATION_SUGGESTIONS = [
  'Clinical & Community Nutrition',
  'Diabetes Management (T2D)',
  'Renal & Kidney Dietetics',
  'Hypertension & Cardiovascular',
  'Sports & Metabolic Health',
  'Pediatric & Maternal Nutrition',
];

export default function NutritionistProfilePage() {
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
    return <NutritionistProfileSkeleton />;
  }

  const formattedExpiry = profile?.prcLicenseExpiry
    ? new Date(profile.prcLicenseExpiry).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Dec 31, 2028';

  return (
    <div className="portal-page max-w-5xl space-y-6 text-left">
      <PortalPageHeader
        icon={UserRound}
        eyebrow="Clinical Practitioner Registry"
        title="Nutritionist profile"
        description="Manage your PRC credentials, clinical practice focus, and patient-facing identity."
      />

      <div className="space-y-6">
        {/* 1. Clinical Credential Hero Card */}
        <div className="relative overflow-hidden rounded-3xl border border-[#dce4e0] dark:border-[#173e33] bg-[#faf8f5] dark:bg-[#0e271f] shadow-card">
          {/* Retro Wave Organic Corner Accent (Top Right) */}
          <div className="pointer-events-none absolute -top-0.5 -right-0.5 h-36 w-36 overflow-hidden rounded-tr-3xl z-0">
            <svg viewBox="0 0 160 160" className="h-full w-full" fill="none">
              <path d="M160,0 L0,0 C20,40 55,95 120,135 C140,147 160,155 160,155 Z" fill="#eb6a38" />
              <path d="M160,0 L40,0 C55,30 80,72 130,105 C145,115 160,120 160,120 Z" fill="#f09e6c" />
              <path
                d="M160,0 L82,0 C92,20 110,48 142,70 C152,76 160,80 160,80 Z"
                className="fill-[#1b4e41] dark:fill-[#164639]"
              />
            </svg>
          </div>

          {/* Official PRC regulatory ribbon */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#dce4e0] dark:border-[#173e33] bg-[#f0ebe1]/80 dark:bg-black/30 px-6 py-2.5 backdrop-blur-sm relative z-10">
            <div className="flex items-center gap-2">
              <span className="text-sm">🇵🇭</span>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#6b857c] dark:text-[#8ea99f]">
                Professional Regulation Commission · Republic of the Philippines
              </span>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/30 dark:border-emerald-500/30 bg-emerald-100/80 dark:bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active PRC Licensee
            </span>
          </div>

          {/* Main identity row */}
          <div className="relative p-6 sm:p-8 z-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start text-center sm:text-left">
                <div className="relative shrink-0">
                  {profile?.officialHeadshot ? (
                    <div className="relative h-24 w-24 rounded-full overflow-hidden border-2 border-emerald-600 dark:border-brand-green ring-4 ring-emerald-500/20 shadow-xl">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={profile.officialHeadshot}
                        alt={user?.name || 'Nutritionist'}
                        className="h-full w-full object-cover"
                      />
                      {profile?.isVerified && (
                        <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg ring-2 ring-[#faf8f5] dark:ring-[#0e271f]">
                          <Check className="h-4 w-4 stroke-[3]" />
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="relative">
                      <Avatar name={user?.name} seed={user?.image} size="xl" />
                      {profile?.isVerified && (
                        <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg ring-2 ring-[#faf8f5] dark:ring-[#0e271f]">
                          <Check className="h-4 w-4 stroke-[3]" />
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                    <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-[#0d2820] dark:text-white">
                      {user?.name}
                    </h1>
                    <Badge variant={profile?.isVerified ? 'verified' : 'pending'}>
                      {profile?.isVerified ? 'PRC Verified RND' : 'Verification Pending'}
                    </Badge>
                    {profile?.canLeadReview && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
                        <ShieldCheck className="h-3 w-3" /> Lead Reviewer
                      </span>
                    )}
                  </div>

                  <p className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <span>PRC Lic. No. {profile?.prcLicenseNumber || 'PRC-RND-NM-0001'}</span>
                    <span className="text-[#6b857c] dark:text-[#8ea99f]">·</span>
                    <span className="text-[#6b857c] dark:text-[#8ea99f] font-sans font-medium">
                      Valid thru {formattedExpiry}
                    </span>
                  </p>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-[#5a746a] dark:text-[#8ea99f]">
                    <span className="inline-flex items-center gap-1">
                      <GraduationCap className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                      {profile?.university || 'University of San Carlos'}
                    </span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1">
                      <Stethoscope className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                      {profile?.specialization || 'Clinical and Community Nutrition'}
                    </span>
                    {profile?.yearsOfExperience && (
                      <>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          <Award className="h-3.5 w-3.5 text-[#eb6a38]" />
                          {profile.yearsOfExperience} yrs practice
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Shortcuts */}
              <div className="flex flex-row sm:flex-col gap-2 shrink-0 justify-center">
                <Link
                  href="/nutritionist/reviews"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#eb6a38]/10 dark:bg-[#eb6a38]/20 border border-[#eb6a38]/30 px-3.5 py-2 text-xs font-bold text-[#c25426] dark:text-[#f09e6c] hover:bg-[#eb6a38]/25 transition-all shadow-xs"
                >
                  <FileCheck2 className="h-3.5 w-3.5" />
                  <span>Review Queue</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Clinical Credential KPI Stat Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Stat 1: PRC Registration */}
          <div className="rounded-2xl border border-[#dce4e0] dark:border-[#173e33] bg-[#faf8f5] dark:bg-[#0e271f] p-4 shadow-sm hover:border-[#eb6a38]/40 dark:hover:border-emerald-500/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#6b857c] dark:text-[#8ea99f]">
                PRC Registry
              </span>
              <div className="rounded-xl bg-emerald-600/15 p-2 text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline justify-between gap-1">
              <span className="font-mono text-sm font-extrabold text-[#0d2820] dark:text-white truncate">
                {profile?.prcLicenseNumber || 'PRC-RND-NM-0001'}
              </span>
              <button
                type="button"
                onClick={copyLicense}
                className="p-1 text-[#6b857c] hover:text-[#0d2820] dark:text-[#8ea99f] dark:hover:text-white rounded-md transition-colors"
                title="Copy license number"
              >
                {copied ? (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Copied!</span>
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <span className="mt-1 block text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              PRC Board Certified RND
            </span>
          </div>

          {/* Stat 2: Validity */}
          <div className="rounded-2xl border border-[#dce4e0] dark:border-[#173e33] bg-[#faf8f5] dark:bg-[#0e271f] p-4 shadow-sm hover:border-[#eb6a38]/40 dark:hover:border-emerald-500/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#6b857c] dark:text-[#8ea99f]">
                License Expiry
              </span>
              <div className="rounded-xl bg-cyan-600/15 p-2 text-cyan-700 dark:text-cyan-400">
                <Calendar className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 font-display text-sm font-extrabold text-[#0d2820] dark:text-white">{formattedExpiry}</p>
            <span className="mt-1 block text-[11px] font-semibold text-cyan-700 dark:text-cyan-400">
              Active &amp; Good Standing
            </span>
          </div>

          {/* Stat 3: Audits Completed */}
          <div className="rounded-2xl border border-[#dce4e0] dark:border-[#173e33] bg-[#faf8f5] dark:bg-[#0e271f] p-4 shadow-sm hover:border-[#eb6a38]/40 dark:hover:border-emerald-500/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#6b857c] dark:text-[#8ea99f]">
                Audits Approved
              </span>
              <div className="rounded-xl bg-[#eb6a38]/15 p-2 text-[#eb6a38]">
                <Award className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 font-display text-2xl font-black text-[#eb6a38] dark:text-[#f09e6c]">
              {profile?.totalVerified ?? 0}
            </p>
            <span className="mt-1 block text-[11px] font-semibold text-[#6b857c] dark:text-[#8ea99f]">
              Meal cases verified
            </span>
          </div>

          {/* Stat 4: Clinical Background */}
          <div className="rounded-2xl border border-[#dce4e0] dark:border-[#173e33] bg-[#faf8f5] dark:bg-[#0e271f] p-4 shadow-sm hover:border-[#eb6a38]/40 dark:hover:border-emerald-500/30 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#6b857c] dark:text-[#8ea99f]">
                Alma Mater
              </span>
              <div className="rounded-xl bg-violet-600/15 p-2 text-violet-700 dark:text-violet-400">
                <GraduationCap className="h-4 w-4" />
              </div>
            </div>
            <p className="mt-2 font-display text-xs font-bold text-[#0d2820] dark:text-white truncate">
              {profile?.university || 'University of San Carlos'}
            </p>
            <span className="mt-1 block text-[11px] font-semibold text-[#6b857c] dark:text-[#8ea99f]">
              BS Nutrition &amp; Dietetics
            </span>
          </div>
        </div>

        {/* 3. Two-Column Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Form & Clinical Practice Details (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-3xl border border-[#dce4e0] dark:border-[#173e33] bg-[#faf8f5] dark:bg-[#0e271f] space-y-5 p-6 shadow-card">
              <div className="flex items-center justify-between border-b border-[#dce4e0] dark:border-[#173e33] pb-3">
                <div>
                  <p className="portal-section-label !text-emerald-700 dark:!text-emerald-400">
                    Clinical Practice &amp; Bio
                  </p>
                  <h3 className="font-display text-sm font-bold text-[#0d2820] dark:text-white mt-0.5">
                    Edit Professional Details
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-[#6b857c] dark:text-[#8ea99f] uppercase">Editable</span>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400"
                >
                  {error}
                </p>
              )}
              {success && (
                <p
                  role="status"
                  className="rounded-xl border border-emerald-600/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{success}</span>
                </p>
              )}

              {/* Specialization */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="nutritionist-specialization"
                    className="text-xs font-bold text-[#0d2820] dark:text-white"
                  >
                    Clinical Specialization &amp; Focus
                  </label>
                  <span className="text-[10px] text-[#6b857c] dark:text-[#8ea99f]">Displayed to patients</span>
                </div>
                <input
                  id="nutritionist-specialization"
                  name="specialization"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  className="w-full rounded-2xl border border-[#d5dedb] dark:border-[#1a4438] bg-white/80 dark:bg-[#071914] px-4 py-3 text-sm text-[#0d2820] dark:text-white outline-none focus:border-[#eb6a38] focus:ring-4 focus:ring-[#eb6a38]/15"
                  placeholder="e.g. Clinical Nutrition, Diabetes &amp; Renal Dietetics"
                />

                {/* Suggestion chips */}
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-bold text-[#6b857c] dark:text-[#8ea99f] self-center mr-1">
                    Suggested:
                  </span>
                  {SPECIALIZATION_SUGGESTIONS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setSpecialization(chip)}
                      className={`rounded-lg border px-2.5 py-1 text-[10px] font-semibold transition-all ${
                        specialization === chip
                          ? 'border-[#eb6a38] bg-[#eb6a38]/15 text-[#c25426] dark:text-[#f09e6c]'
                          : 'border-[#dce4e0] dark:border-[#173e33] bg-white/60 dark:bg-[#071914] text-[#5a746a] dark:text-[#8ea99f] hover:text-[#0d2820] dark:hover:text-white hover:border-[#eb6a38]/40'
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bio */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="nutritionist-bio" className="text-xs font-bold text-[#0d2820] dark:text-white">
                    Professional Bio &amp; Introduction
                  </label>
                  <span className="font-mono text-[10px] text-[#6b857c] dark:text-[#8ea99f]">
                    {bio.length} characters
                  </span>
                </div>
                <textarea
                  id="nutritionist-bio"
                  name="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full resize-none rounded-2xl border border-[#d5dedb] dark:border-[#1a4438] bg-white/80 dark:bg-[#071914] px-4 py-3 text-sm text-[#0d2820] dark:text-white outline-none focus:border-[#eb6a38] focus:ring-4 focus:ring-[#eb6a38]/15 leading-relaxed"
                  rows={4}
                  placeholder="Summarize your clinical expertise, care approach, and dietary philosophy for patients..."
                />
                <p className="mt-1.5 text-[11px] text-[#6b857c] dark:text-[#8ea99f] leading-relaxed">
                  This summary is shown on approved meal plan cards and clinical audit certificates seen by patients.
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-xl border border-[#d95d2c] bg-gradient-to-r from-[#eb6a38] via-[#ed7847] to-[#f09e6c] text-white shadow-sm hover:brightness-105 active:scale-[0.98] text-xs font-bold px-6 py-2.5 transition-all flex items-center gap-2"
                >
                  {saving && (
                    <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>Save Changes</span>
                </button>
              </div>
            </div>

            {/* Official PRC Verification Card */}
            <div className="rounded-3xl border border-[#dce4e0] dark:border-[#173e33] bg-[#faf8f5] dark:bg-[#0e271f] space-y-4 p-6 shadow-card">
              <div className="flex items-center justify-between border-b border-[#dce4e0] dark:border-[#173e33] pb-3">
                <div>
                  <p className="portal-section-label !text-emerald-700 dark:!text-emerald-400">PRC Official Registry</p>
                  <h3 className="text-sm font-bold text-[#0d2820] dark:text-white mt-0.5">Licensing Compliance</h3>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-600/30 dark:border-emerald-500/30 bg-emerald-100/80 dark:bg-emerald-950/40 px-2.5 py-1 text-[10px] font-bold text-emerald-800 dark:text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5" /> PRC Verified
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                <div className="rounded-xl border border-[#dce4e0] dark:border-[#173e33] bg-white/60 dark:bg-[#071914] p-3.5 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-[#6b857c] dark:text-[#8ea99f]">
                    Licensing Body
                  </span>
                  <p className="font-bold text-[#0d2820] dark:text-white flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                    Professional Regulation Commission
                  </p>
                </div>
                <div className="rounded-xl border border-[#dce4e0] dark:border-[#173e33] bg-white/60 dark:bg-[#071914] p-3.5 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-[#6b857c] dark:text-[#8ea99f]">
                    Regulatory Framework
                  </span>
                  <p className="font-bold text-[#0d2820] dark:text-white">Philippine R.A. No. 10862 (2016)</p>
                </div>
                <div className="rounded-xl border border-[#dce4e0] dark:border-[#173e33] bg-white/60 dark:bg-[#071914] p-3.5 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-[#6b857c] dark:text-[#8ea99f]">
                    Verification Status
                  </span>
                  <p className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <Check className="h-3.5 w-3.5 stroke-[3]" /> Verified by Admin Registry Audit
                  </p>
                </div>
                <div className="rounded-xl border border-[#dce4e0] dark:border-[#173e33] bg-white/60 dark:bg-[#071914] p-3.5 space-y-1">
                  <span className="text-[10px] font-mono uppercase text-[#6b857c] dark:text-[#8ea99f]">
                    Audit Governance Tier
                  </span>
                  <p className="font-bold text-[#0d2820] dark:text-white">
                    {profile?.canLeadReview ? 'Lead Clinical Reviewer (Tier 2)' : 'Clinical Reviewer (Tier 1)'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Public Patient View & Hub (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Live Patient Attribution Preview Card */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div>
                  <span className="font-mono text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                    Patient Attribution Card
                  </span>
                  <p className="text-[11px] text-[#6b857c] dark:text-[#8ea99f]">
                    Official clinical credential card shown to patients
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-600/30 dark:border-emerald-500/30 bg-emerald-100/70 dark:bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-800 dark:text-emerald-400">
                    Live Preview
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowModalPreview(true)}
                    className="inline-flex items-center gap-1 rounded-xl border border-[#dce4e0] dark:border-[#173e33] bg-[#faf8f5] dark:bg-[#0e271f] px-2.5 py-1 text-[11px] font-bold text-[#0d2820] dark:text-white hover:border-[#eb6a38]/40 hover:text-[#eb6a38] transition shadow-xs"
                    title="Preview full interactive modal dialog"
                  >
                    <Maximize2 className="h-3 w-3" />
                    <span>Full Dialog</span>
                  </button>
                </div>
              </div>

              <NutritionistCredentialCard
                verifier={{
                  name: user?.name || 'Nutritionist',
                  image: user?.image,
                  officialHeadshot: profile?.officialHeadshot,
                  prcLicenseNumber: profile?.prcLicenseNumber || 'PRC-RND-NM-0001',
                  prcLicenseExpiry: profile?.prcLicenseExpiry || new Date().toISOString(),
                  specialization: specialization || profile?.specialization || 'Clinical and Community Nutrition',
                  yearsOfExperience: profile?.yearsOfExperience || 5,
                  university: profile?.university || 'University of San Carlos',
                  bio: bio || profile?.bio,
                }}
                nutritionistNote={bio || profile?.bio}
                onViewNotes={() => setShowModalPreview(true)}
                layout="vertical"
                className="shadow-card"
              />

              <p className="text-[11px] text-[#6b857c] dark:text-[#8ea99f] leading-relaxed text-center px-2">
                Patients view this official credential card on meal plan audits, recipes, and clinical disclaimers.
              </p>
            </div>

            {/* Account Session Card */}
            <div className="rounded-2xl border border-[#dce4e0] dark:border-[#173e33] bg-[#faf8f5] dark:bg-[#0e271f] p-5 space-y-3 shadow-card">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0d2820] dark:text-white">Account Session</span>
                <span className="font-mono text-[10px] text-[#6b857c] dark:text-[#8ea99f] truncate max-w-[180px]">
                  {user?.email}
                </span>
              </div>
              <button
                type="button"
                onClick={logout}
                className="w-full rounded-xl border border-[#dce4e0] dark:border-[#1a4438] bg-white/80 dark:bg-[#071914] text-[#0d2820] dark:text-white hover:bg-rose-500/10 hover:text-rose-600 hover:border-rose-500/30 text-xs font-bold py-2.5 transition-all flex items-center justify-center gap-2"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      {showModalPreview && (
        <NutritionistCredentialModal
          isOpen={showModalPreview}
          onClose={() => setShowModalPreview(false)}
          verifier={{
            name: user?.name || 'Nutritionist',
            image: user?.image,
            officialHeadshot: profile?.officialHeadshot,
            prcLicenseNumber: profile?.prcLicenseNumber || 'PRC-RND-NM-0001',
            prcLicenseExpiry: profile?.prcLicenseExpiry || new Date().toISOString(),
            specialization: specialization || profile?.specialization || 'Clinical and Community Nutrition',
            yearsOfExperience: profile?.yearsOfExperience || 5,
            university: profile?.university || 'University of San Carlos',
            bio: bio || profile?.bio,
          }}
          nutritionistNote={bio || profile?.bio || 'Clinical meal supervision and adherence monitoring.'}
        />
      )}
    </div>
  );
}

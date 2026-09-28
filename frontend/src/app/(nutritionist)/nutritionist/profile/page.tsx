'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/axios';
import NutritionistProfileSkeleton from '@/features/profile/NutritionistProfileSkeleton';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import AvatarSettings from '@/features/profile/AvatarSettings';
import { NutritionistCredentialCard } from '@/components/user/NutritionistCredentialCard';
import NutritionistCredentialModal from '@/components/user/NutritionistCredentialModal';
import { useAuth } from '@/hooks/useAuth';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import {
  Check,
  UserRound,
  Sparkles,
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
  const { logout, user, updateUserSession } = useAuth();
  const [profile, setProfile] = useState<NProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'credentials' | 'avatar'>('credentials');
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
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.patch('/nutritionist/profile', { bio, specialization });
      setProfile((current) => (current ? { ...current, bio, specialization } : current));
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

      {/* Tab Navigation */}
      <div className="flex flex-wrap sm:flex-nowrap gap-2 border-b border-brand-border/60 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('credentials')}
          className={`inline-flex flex-1 sm:flex-initial items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'credentials'
              ? 'bg-brand-accent text-[#07100d] shadow-sm'
              : 'border border-brand-border/70 bg-brand-surface/70 text-brand-muted hover:text-brand-text'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          <span>Clinical Credentials</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('avatar')}
          className={`inline-flex flex-1 sm:flex-initial items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
            activeTab === 'avatar'
              ? 'bg-brand-accent text-[#07100d] shadow-sm'
              : 'border border-brand-border/70 bg-brand-surface/70 text-brand-muted hover:text-brand-text'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>Avatar &amp; Appearance</span>
        </button>
      </div>

      {activeTab === 'credentials' ? (
        <div className="space-y-6">
          {/* 1. Clinical Credential Hero Card */}
          <div className="relative overflow-hidden rounded-3xl border border-brand-border/80 bg-brand-surface shadow-card">
            {/* Background subtle mesh glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.07] via-transparent to-brand-green/[0.04] pointer-events-none" />
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-green/10 blur-3xl pointer-events-none" />
            <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-emerald-500/[0.05] blur-3xl pointer-events-none" />

            {/* Official PRC regulatory ribbon */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-border/60 bg-black/20 px-6 py-2.5 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <span className="text-sm">🇵🇭</span>
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-brand-muted">
                  Professional Regulation Commission · Republic of the Philippines
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active PRC Licensee
              </span>
            </div>

            {/* Main identity row */}
            <div className="relative p-6 sm:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start text-center sm:text-left">
                  <div className="relative shrink-0">
                    {profile?.officialHeadshot ? (
                      <div className="relative h-24 w-24 rounded-full overflow-hidden border-2 border-brand-green ring-4 ring-brand-green/20 shadow-xl">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={profile.officialHeadshot}
                          alt={user?.name || 'Nutritionist'}
                          className="h-full w-full object-cover"
                        />
                        {profile?.isVerified && (
                          <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-brand-green text-white shadow-lg ring-2 ring-brand-surface">
                            <Check className="h-4 w-4 stroke-[3]" />
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="relative">
                        <Avatar name={user?.name} seed={user?.image} size="xl" />
                        {profile?.isVerified && (
                          <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-brand-green text-white shadow-lg ring-2 ring-brand-surface">
                            <Check className="h-4 w-4 stroke-[3]" />
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                      <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-brand-text">
                        {user?.name}
                      </h1>
                      <Badge variant={profile?.isVerified ? 'verified' : 'pending'}>
                        {profile?.isVerified ? 'PRC Verified RND' : 'Verification Pending'}
                      </Badge>
                      {profile?.canLeadReview && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-brand-cyan/30 bg-brand-cyan/10 px-2.5 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-brand-cyan">
                          <ShieldCheck className="h-3 w-3" /> Lead Reviewer
                        </span>
                      )}
                    </div>

                    <p className="font-mono text-xs font-bold text-brand-green flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <span>PRC Lic. No. {profile?.prcLicenseNumber || 'PRC-RND-NM-0001'}</span>
                      <span className="text-brand-muted">·</span>
                      <span className="text-brand-muted font-sans font-medium">Valid thru {formattedExpiry}</span>
                    </p>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-brand-muted">
                      <span className="inline-flex items-center gap-1">
                        <GraduationCap className="h-3.5 w-3.5 text-brand-green" />
                        {profile?.university || 'University of San Carlos'}
                      </span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1">
                        <Stethoscope className="h-3.5 w-3.5 text-brand-cyan" />
                        {profile?.specialization || 'Clinical and Community Nutrition'}
                      </span>
                      {profile?.yearsOfExperience && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-1">
                            <Award className="h-3.5 w-3.5 text-brand-accent" />
                            {profile.yearsOfExperience} yrs practice
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Shortcuts */}
                <div className="flex flex-row sm:flex-col gap-2 shrink-0 justify-center">
                  <button
                    type="button"
                    onClick={() => setActiveTab('avatar')}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-border/80 bg-brand-bgAlt/60 px-3.5 py-2 text-xs font-bold text-brand-text hover:bg-brand-bgAlt hover:border-brand-green/30 transition-all shadow-xs"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-brand-accent" />
                    <span>Customize Avatar</span>
                  </button>
                  <Link
                    href="/nutritionist/reviews"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-green/10 border border-brand-green/30 px-3.5 py-2 text-xs font-bold text-brand-green hover:bg-brand-green/20 transition-all shadow-xs"
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
            <div className="rounded-2xl border border-brand-border/70 bg-brand-surface p-4 shadow-sm hover:border-brand-green/30 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-muted">
                  PRC Registry
                </span>
                <div className="rounded-xl bg-brand-green/10 p-2 text-brand-green">
                  <ShieldCheck className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-1">
                <span className="font-mono text-sm font-extrabold text-brand-text truncate">
                  {profile?.prcLicenseNumber || 'PRC-RND-NM-0001'}
                </span>
                <button
                  type="button"
                  onClick={copyLicense}
                  className="p-1 text-brand-muted hover:text-brand-text rounded-md transition-colors"
                  title="Copy license number"
                >
                  {copied ? (
                    <span className="text-[10px] font-bold text-brand-green">Copied!</span>
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <span className="mt-1 block text-[11px] font-semibold text-brand-green">PRC Board Certified RND</span>
            </div>

            {/* Stat 2: Validity */}
            <div className="rounded-2xl border border-brand-border/70 bg-brand-surface p-4 shadow-sm hover:border-brand-green/30 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-muted">
                  License Expiry
                </span>
                <div className="rounded-xl bg-brand-cyan/10 p-2 text-brand-cyan">
                  <Calendar className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 font-display text-sm font-extrabold text-brand-text">
                {formattedExpiry}
              </p>
              <span className="mt-1 block text-[11px] font-semibold text-brand-cyan">Active &amp; Good Standing</span>
            </div>

            {/* Stat 3: Audits Completed */}
            <div className="rounded-2xl border border-brand-border/70 bg-brand-surface p-4 shadow-sm hover:border-brand-green/30 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-muted">
                  Audits Approved
                </span>
                <div className="rounded-xl bg-brand-accent/15 p-2 text-brand-accent">
                  <Award className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 font-display text-2xl font-black text-brand-accent">
                {profile?.totalVerified ?? 0}
              </p>
              <span className="mt-1 block text-[11px] font-semibold text-brand-muted">Meal cases verified</span>
            </div>

            {/* Stat 4: Clinical Background */}
            <div className="rounded-2xl border border-brand-border/70 bg-brand-surface p-4 shadow-sm hover:border-brand-green/30 transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-muted">
                  Alma Mater
                </span>
                <div className="rounded-xl bg-brand-violet/10 p-2 text-brand-violet">
                  <GraduationCap className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-2 font-display text-xs font-bold text-brand-text truncate">
                {profile?.university || 'University of San Carlos'}
              </p>
              <span className="mt-1 block text-[11px] font-semibold text-brand-muted">BS Nutrition &amp; Dietetics</span>
            </div>
          </div>

          {/* 3. Two-Column Workspace Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Form & Clinical Practice Details (7 cols) */}
            <div className="lg:col-span-7 space-y-6">
              <Card className="space-y-5 p-6">
                <div className="flex items-center justify-between border-b border-brand-border/60 pb-3">
                  <div>
                    <p className="portal-section-label">Clinical Practice &amp; Bio</p>
                    <h3 className="font-display text-sm font-bold text-brand-text mt-0.5">Edit Professional Details</h3>
                  </div>
                  <span className="text-[10px] font-mono text-brand-muted uppercase">Editable</span>
                </div>

                {error && (
                  <p
                    role="alert"
                    className="rounded-xl border border-status-error-text/25 bg-status-error-bg/10 p-3 text-xs font-semibold text-status-error-text"
                  >
                    {error}
                  </p>
                )}
                {success && (
                  <p
                    role="status"
                    className="rounded-xl border border-status-verified-text/25 bg-status-verified-bg/10 p-3 text-xs font-semibold text-status-verified-text flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-green" />
                    <span>{success}</span>
                  </p>
                )}

                {/* Specialization */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="nutritionist-specialization" className="text-xs font-bold text-brand-text">
                      Clinical Specialization &amp; Focus
                    </label>
                    <span className="text-[10px] text-brand-muted">Displayed to patients</span>
                  </div>
                  <input
                    id="nutritionist-specialization"
                    name="specialization"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    className="w-full rounded-2xl border border-brand-border/70 bg-brand-surface/75 px-4 py-3 text-sm text-brand-text outline-none focus:border-brand-green/50 focus:ring-4 focus:ring-brand-green/10"
                    placeholder="e.g. Clinical Nutrition, Diabetes &amp; Renal Dietetics"
                  />

                  {/* Suggestion chips */}
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <span className="text-[10px] font-bold text-brand-muted self-center mr-1">Suggested:</span>
                    {SPECIALIZATION_SUGGESTIONS.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setSpecialization(chip)}
                        className={`rounded-lg border px-2 py-0.5 text-[10px] font-semibold transition-all ${
                          specialization === chip
                            ? 'border-brand-green/40 bg-brand-green/10 text-brand-green'
                            : 'border-brand-border/60 bg-brand-bgAlt/50 text-brand-muted hover:text-brand-text hover:border-brand-border'
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
                    <label htmlFor="nutritionist-bio" className="text-xs font-bold text-brand-text">
                      Professional Bio &amp; Introduction
                    </label>
                    <span className="font-mono text-[10px] text-brand-muted">{bio.length} characters</span>
                  </div>
                  <textarea
                    id="nutritionist-bio"
                    name="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full resize-none rounded-2xl border border-brand-border/70 bg-brand-surface/75 px-4 py-3 text-sm text-brand-text outline-none focus:border-brand-green/50 focus:ring-4 focus:ring-brand-green/10 leading-relaxed"
                    rows={4}
                    placeholder="Summarize your clinical expertise, care approach, and dietary philosophy for patients..."
                  />
                  <p className="mt-1.5 text-[11px] text-brand-muted leading-relaxed">
                    This summary is shown on approved meal plan cards and clinical audit certificates seen by patients.
                  </p>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button variant="primary" onClick={handleSave} isLoading={saving} className="text-xs px-6 py-2.5">
                    Save Changes
                  </Button>
                </div>
              </Card>

              {/* Official PRC Verification Card */}
              <Card className="space-y-4 p-6 border-brand-green/30 bg-brand-green/[0.02]">
                <div className="flex items-center justify-between border-b border-brand-border/60 pb-3">
                  <div>
                    <p className="portal-section-label !text-brand-green">PRC Official Registry</p>
                    <h3 className="text-sm font-bold text-brand-text mt-0.5">Licensing Compliance</h3>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 text-[10px] font-bold text-emerald-400">
                    <ShieldCheck className="h-3.5 w-3.5" /> PRC Verified
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 text-xs">
                  <div className="rounded-xl border border-brand-border/60 bg-brand-surface/70 p-3.5 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-brand-muted">Licensing Body</span>
                    <p className="font-bold text-brand-text flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-brand-green" />
                      Professional Regulation Commission
                    </p>
                  </div>
                  <div className="rounded-xl border border-brand-border/60 bg-brand-surface/70 p-3.5 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-brand-muted">Regulatory Framework</span>
                    <p className="font-bold text-brand-text">Philippine R.A. No. 10862 (2016)</p>
                  </div>
                  <div className="rounded-xl border border-brand-border/60 bg-brand-surface/70 p-3.5 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-brand-muted">Verification Status</span>
                    <p className="font-bold text-brand-green flex items-center gap-1">
                      <Check className="h-3.5 w-3.5 stroke-[3]" /> Verified by Admin Registry Audit
                    </p>
                  </div>
                  <div className="rounded-xl border border-brand-border/60 bg-brand-surface/70 p-3.5 space-y-1">
                    <span className="text-[10px] font-mono uppercase text-brand-muted">Audit Governance Tier</span>
                    <p className="font-bold text-brand-text">
                      {profile?.canLeadReview ? 'Lead Clinical Reviewer (Tier 2)' : 'Clinical Reviewer (Tier 1)'}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Right Column: Public Patient View & Hub (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Live Patient Attribution Preview Card */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div>
                    <span className="font-mono text-[10px] font-extrabold uppercase tracking-widest text-brand-green">
                      Patient Attribution Card
                    </span>
                    <p className="text-[11px] text-brand-muted">Official clinical credential card shown to patients</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-brand-green/30 bg-brand-green/10 px-2 py-0.5 text-[9px] font-bold text-brand-green">
                      Live Preview
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowModalPreview(true)}
                      className="inline-flex items-center gap-1 rounded-xl border border-brand-border/70 bg-brand-surface px-2.5 py-1 text-[11px] font-bold text-brand-text hover:border-brand-green/40 hover:text-brand-green transition shadow-xs"
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

                <p className="text-[11px] text-brand-muted leading-relaxed text-center px-2">
                  Patients view this official credential card on meal plan audits, recipes, and clinical disclaimers.
                </p>
              </div>

              {/* Account Session Card */}
              <div className="rounded-2xl border border-brand-border/70 bg-brand-surface p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-brand-text">Account Session</span>
                  <span className="font-mono text-[10px] text-brand-muted truncate max-w-[180px]">{user?.email}</span>
                </div>
                <Button
                  variant="secondary"
                  onClick={logout}
                  className="w-full text-xs font-bold py-2.5 flex items-center justify-center gap-2"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {user && (
            <AvatarSettings visible={activeTab === 'avatar'} user={user} updateUserSession={updateUserSession} />
          )}
        </div>
      )}
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

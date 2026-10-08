'use client';

import ReviewQualificationsPanel from '@/features/nutritionist-profile/ReviewQualificationsPanel';
import NutritionistCredentialModal from '@/components/user/NutritionistCredentialModal';

import PortalPageHeader from '@/components/shared/PortalPageHeader';

import { Check, UserRound, ShieldCheck, Building2 } from 'lucide-react';

import { useNutritionistProfilePageModel } from '@/features/nutritionist-profile/useNutritionistProfilePageModel';
import NutritionistCredentialsSection from '@/features/nutritionist-profile/NutritionistCredentialsSection';
import NutritionistMetricsSection from '@/features/nutritionist-profile/NutritionistMetricsSection';
import NutritionistAccountSection from '@/features/nutritionist-profile/NutritionistAccountSection';
import NutritionistPracticeSection from '@/features/nutritionist-profile/NutritionistPracticeSection';
export default function NutritionistProfilePage() {
  const model = useNutritionistProfilePageModel();
  if (model.kind === 'early') return model.view;
  const { profile, user, specialization, bio, setShowModalPreview, showModalPreview } = model;
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
        <NutritionistCredentialsSection model={model} />

        {/* 2. Clinical Credential KPI Stat Strip */}
        <NutritionistMetricsSection model={model} />
        <ReviewQualificationsPanel
          verifiedExpertise={profile?.verifiedExpertise}
          verifiedExperienceYears={profile?.verifiedExperienceYears}
        />

        {/* 3. Two-Column Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Form & Clinical Practice Details (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <NutritionistAccountSection model={model} />

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
                    Review role
                  </span>
                  <p className="font-bold text-[#0d2820] dark:text-white">Registered Nutritionist-Dietitian</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Public Patient View & Hub (5 cols) */}
          <NutritionistPracticeSection model={model} />
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

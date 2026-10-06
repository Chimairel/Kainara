'use client';

import { NutritionistCredentialCard } from '@/components/user/NutritionistCredentialCard';

import { LogOut, Maximize2 } from 'lucide-react';

import type { useNutritionistProfilePageModel } from './useNutritionistProfilePageModel';
type Model = Extract<ReturnType<typeof useNutritionistProfilePageModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<Model, 'setShowModalPreview' | 'user' | 'profile' | 'specialization' | 'bio' | 'logout'>;
};
export default function NutritionistPracticeSection({ model }: SectionProps) {
  const { setShowModalPreview, user, profile, specialization, bio, logout } = model;

  return (
    <>
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
    </>
  );
}

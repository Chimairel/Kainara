'use client';

import { ShieldCheck, Award, Calendar, GraduationCap, Copy } from 'lucide-react';

import type { useNutritionistProfilePageModel } from './useNutritionistProfilePageModel';
type Model = Extract<ReturnType<typeof useNutritionistProfilePageModel>, { kind: 'ready' }>;
type SectionProps = { model: Pick<Model, 'profile' | 'copyLicense' | 'copied' | 'formattedExpiry'> };
export default function NutritionistMetricsSection({ model }: SectionProps) {
  const { profile, copyLicense, copied, formattedExpiry } = model;

  return (
    <>
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
    </>
  );
}

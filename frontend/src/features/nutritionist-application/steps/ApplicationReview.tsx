import { Award, ShieldCheck } from 'lucide-react';

import type { NutritionistApplicationForm } from '@/validation/nutritionist-application.schemas';

export function ApplicationReview({ form }: { form: NutritionistApplicationForm }) {
  const summary = [
    ['Full Professional Name', form.fullName || 'Not provided'],
    ['Contact Email', form.email || 'Not provided'],
    ['Mobile Number', form.phoneNumber || 'Not provided'],
    ['PRC Registration No.', form.prcLicenseNumber || 'Not provided'],
    ['License Expiration', form.prcLicenseExpiry || 'Not provided'],
    ['Primary Specialization', form.specialization || 'Clinical Nutrition'],
    ['Clinical Experience', `${form.yearsOfExperience || '0'} year(s)`],
    ['Degree Institution', form.university || 'Not provided'],
  ];

  return (
    <div className="space-y-6">
      {/* Digital RND Applicant Credential Card Preview */}
      <div className="relative overflow-hidden rounded-[26px] border border-[#1b4e41] bg-gradient-to-br from-[#0c2720] via-[#081f19] to-[#041511] p-6 text-white shadow-xl">
        {/* Subtle Watermark Corner Motif */}
        <div className="pointer-events-none absolute -right-6 -bottom-6 opacity-10">
          <Award className="h-44 w-44 text-emerald-300" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                KAINARA CLINICAL NETWORK
              </span>
            </div>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-950/60 px-2.5 py-0.5 font-mono text-[9px] font-bold text-emerald-200">
              PRC-RND CANDIDATE
            </span>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {form.officialHeadshot ? (
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-emerald-400/60 shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.officialHeadshot} alt={form.fullName} className="h-full w-full object-cover" />
                <span className="absolute bottom-0 inset-x-0 bg-emerald-950/90 py-0.5 text-center font-mono text-[8px] font-bold text-emerald-200 uppercase tracking-wider">
                  Applicant photo
                </span>
              </div>
            ) : (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-white/20 bg-white/5 text-xs text-white/50">
                No Photo
              </div>
            )}

            <div className="flex-1 text-center sm:text-left min-w-0">
              <h3 className="font-display text-xl font-black text-white truncate">
                {form.fullName || 'Applicant Name'}, RND
              </h3>
              <p className="mt-0.5 font-mono text-xs font-semibold text-[#f09e6c]">
                PRC REG: {form.prcLicenseNumber || 'PENDING'}
              </p>
              <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-1.5">
                <span className="rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {form.specialization || 'Clinical Nutrition'}
                </span>
                <span className="rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/80">
                  {form.yearsOfExperience ? `${form.yearsOfExperience} yrs experience` : 'Experience pending'}
                </span>
                <span className="rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/80">
                  {form.university || 'University'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Table */}
      <div className="rounded-2xl border border-brand-border bg-brand-surface/40 overflow-hidden divide-y divide-brand-border/60">
        {summary.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 px-4 py-3 text-xs">
            <span className="text-brand-muted font-medium">{label}</span>
            <strong className="text-brand-text text-right truncate max-w-[65%]">{value}</strong>
          </div>
        ))}
      </div>

      {/* Bio excerpt */}
      <div className="rounded-2xl border border-brand-border bg-brand-surface/40 p-4">
        <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-brand-muted">
          Professional Bio Statement
        </p>
        <p className="mt-2 text-xs leading-5 text-brand-text whitespace-pre-wrap">
          {form.professionalBio || 'No background statement provided.'}
        </p>
      </div>

      {/* Verification Notice */}
      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4 text-xs leading-5 text-brand-muted">
        <div className="flex items-center gap-2 font-bold text-emerald-400">
          <ShieldCheck className="h-4 w-4" />
          Submission Confirmation
        </div>
        <p className="mt-1">
          Submitting stores your application in the administrative queue and generates your tracking reference. Approval
          and a verification call are required before you receive workspace access. Save your reference code to track
          progress; submission does not create a privileged account.
        </p>
      </div>
    </div>
  );
}

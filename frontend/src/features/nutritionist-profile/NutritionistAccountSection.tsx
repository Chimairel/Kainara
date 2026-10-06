'use client';

import { CheckCircle2 } from 'lucide-react';
import { SPECIALIZATION_SUGGESTIONS } from './NutritionistProfilePage.shared';
import type { useNutritionistProfilePageModel } from './useNutritionistProfilePageModel';
type Model = Extract<ReturnType<typeof useNutritionistProfilePageModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<
    Model,
    'error' | 'success' | 'specialization' | 'setSpecialization' | 'bio' | 'setBio' | 'handleSave' | 'saving'
  >;
};
export default function NutritionistAccountSection({ model }: SectionProps) {
  const { error, success, specialization, setSpecialization, bio, setBio, handleSave, saving } = model;

  return (
    <>
      <div className="rounded-3xl border border-[#dce4e0] dark:border-[#173e33] bg-[#faf8f5] dark:bg-[#0e271f] space-y-5 p-6 shadow-card">
        <div className="flex items-center justify-between border-b border-[#dce4e0] dark:border-[#173e33] pb-3">
          <div>
            <p className="portal-section-label !text-emerald-700 dark:!text-emerald-400">Clinical Practice &amp; Bio</p>
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
            <label htmlFor="nutritionist-specialization" className="text-xs font-bold text-[#0d2820] dark:text-white">
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
            <span className="font-mono text-[10px] text-[#6b857c] dark:text-[#8ea99f]">{bio.length} characters</span>
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
    </>
  );
}

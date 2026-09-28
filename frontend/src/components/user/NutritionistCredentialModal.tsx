'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck, Clock, Quote, ArrowLeft, FileCheck } from 'lucide-react';

import {
  NutritionistCredentialCard,
  VerifierData,
  maskPrcLicenseNumber,
  DietitianAvatarIllustration,
} from '@/components/user/NutritionistCredentialCard';

export { maskPrcLicenseNumber, DietitianAvatarIllustration };
export type { VerifierData };

export interface NutritionistCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  verifier: VerifierData;
  nutritionistNote?: string | null;
  reviewedAt?: string | Date | null;
  mealName?: string;
  initialTab?: 'card' | 'notes';
}

export default function NutritionistCredentialModal({
  isOpen,
  onClose,
  verifier,
  nutritionistNote,
  reviewedAt,
  mealName,
  initialTab = 'card',
}: NutritionistCredentialModalProps) {
  const [activeTab, setActiveTab] = useState<'card' | 'notes'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const formattedReviewDate = reviewedAt
    ? new Date(reviewedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const displayName = verifier.name.endsWith('RND') ? verifier.name : `${verifier.name}, RND`;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Credentials of ${verifier.name}`}
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 md:p-8"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Main Outer Container */}
      <div className="relative z-10 w-full max-w-4xl flex flex-col items-center">
        {/* Optional Tab Switcher if Review Notes exist */}
        {Boolean(nutritionistNote) && (
          <div className="flex justify-center mb-3">
            <div className="inline-flex rounded-full bg-black/60 p-1 border border-emerald-900/60 backdrop-blur-md shadow-lg">
              <button
                type="button"
                onClick={() => setActiveTab('card')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'card' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" /> Nutritionist Profile
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('notes')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'notes' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Clock className="h-3.5 w-3.5" /> Clinical Review &amp; Notes
              </button>
            </div>
          </div>
        )}

        {/* Modal Card Box */}
        <div
          className="relative w-full overflow-hidden rounded-[28px] sm:rounded-[32px] border border-[#dce4e0] dark:border-[#173e33] bg-[#faf8f5] dark:bg-[#0e271f] text-[#0d2820] dark:text-slate-100 shadow-2xl transition-all animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top-Right Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 z-30 flex h-8 w-8 items-center justify-center text-slate-500 hover:text-[#0d2820] dark:text-slate-400/80 dark:hover:text-white transition focus:outline-none"
            aria-label="Close credential details"
          >
            <X className="h-5 w-5" />
          </button>

          {/* ════════ TAB 1: 100% REPLICA OF CHATGPT REFERENCE CARD ════════ */}
          {activeTab === 'card' ? (
            <NutritionistCredentialCard
              verifier={verifier}
              nutritionistNote={nutritionistNote}
              onViewNotes={() => setActiveTab('notes')}
              layout="horizontal"
              className="border-0 shadow-none rounded-none"
            />
          ) : (
            /* ════════ TAB 2: CLINICAL REVIEW & ADJUSTMENTS DETAILS ════════ */
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-[#dce4e0] dark:border-emerald-900/40 pb-4 pr-8">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                    <FileCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-[#0d2820] dark:text-white">
                      Clinical Meal Supervision &amp; Adjustments
                    </h3>
                    <p className="text-xs text-[#5a746a] dark:text-slate-400">Personalized audit by {displayName}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('card')}
                  className="px-3 py-1.5 rounded-xl border border-emerald-600/30 dark:border-emerald-500/30 bg-emerald-100/70 dark:bg-emerald-950/30 text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200/60 dark:hover:bg-emerald-900/40 transition flex items-center gap-1.5"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Card
                </button>
              </div>

              {/* Audit Metadata Banner */}
              <div className="rounded-2xl border border-emerald-600/25 dark:border-emerald-500/25 bg-emerald-50/60 dark:bg-emerald-950/25 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    <Clock className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                    {formattedReviewDate ? `Reviewed on ${formattedReviewDate}` : 'Reviewed & Certified'}
                  </span>
                  {mealName && (
                    <span className="rounded-lg bg-emerald-600/15 dark:bg-emerald-500/15 border border-emerald-600/30 dark:border-emerald-500/30 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      {mealName}
                    </span>
                  )}
                </div>

                {nutritionistNote && (
                  <div className="rounded-xl bg-white/70 dark:bg-black/40 border border-[#dce4e0] dark:border-emerald-900/40 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1.5">
                      Dietitian Clinical Notes:
                    </p>
                    <p className="text-sm text-[#0d2820] dark:text-slate-200 leading-relaxed italic flex items-start gap-2">
                      <Quote className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5 opacity-70" />
                      <span>{nutritionistNote}</span>
                    </p>
                  </div>
                )}

                <p className="text-xs text-[#5a746a] dark:text-slate-400 leading-relaxed pt-1">
                  Meal composition, macro distribution, and clinical contraindications were audited and approved to
                  ensure compliance with medical dietary guidelines.
                </p>
              </div>

              {/* Clinician Bio & Profile */}
              {verifier.bio && (
                <div className="rounded-2xl border border-[#dce4e0] dark:border-[#163f34] bg-white/50 dark:bg-black/20 p-4 space-y-1.5">
                  <p className="text-xs font-bold text-[#0d2820] dark:text-slate-300 uppercase tracking-wider">
                    About {verifier.name.replace(/,.*$/, '')}:
                  </p>
                  <p className="text-xs text-[#5a746a] dark:text-slate-300 leading-relaxed italic">&ldquo;{verifier.bio}&rdquo;</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

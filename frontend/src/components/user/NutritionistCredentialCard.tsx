'use client';

import React from 'react';
import { ShieldCheck, User, GraduationCap, Award, Calendar } from 'lucide-react';
import { KainaraLogo } from '@/components/shared/KainaraLogo';

export interface VerifierData {
  reviewScope?: 'RECIPE' | 'MEMBER' | 'RECORDED';
  name: string;
  image?: string | null;
  officialHeadshot?: string | null;
  prcLicenseNumber: string;
  prcLicenseExpiry: string | Date;
  specialization?: string | null;
  yearsOfExperience?: number | null;
  university?: string | null;
  bio?: string | null;
}

export function maskPrcLicenseNumber(prc?: string | null): string {
  if (!prc) return 'PRC license not recorded';
  const clean = prc.trim();
  if (!clean) return 'PRC license not recorded';
  if (clean.toLowerCase().startsWith('prc lic. no.')) {
    return clean;
  }
  const digits = clean.replace(/\D/g, '');
  const last4 = digits.length >= 4 ? digits.slice(-4) : clean.slice(-4);
  return `PRC Lic. No. ••••••${last4 || 'Not recorded'}`;
}

/**
 * High-fidelity vector illustration matching the ChatGPT reference dietitian portrait:
 * Cream circular background, warm friendly Filipina dietitian with black hair parted
 * behind ears, white doctor's coat with collar/lapels, dark green V-neck scrubs.
 */
export function DietitianAvatarIllustration() {
  return (
    <svg viewBox="0 0 140 140" className="w-full h-full" fill="none" aria-label="RND avatar">
      {/* Warm cream circle background */}
      <circle cx="70" cy="70" r="70" fill="#faeedd" />

      {/* Hair back layer behind shoulders */}
      <path
        d="M36 60 C32 82 36 102 44 112 C52 102 54 88 56 74 L84 74 C86 88 88 102 96 112 C104 102 108 82 104 60 C100 32 40 32 36 60 Z"
        fill="#1e2220"
      />

      {/* Neck */}
      <rect x="63" y="66" width="14" height="22" rx="3" fill="#fcd2b2" />
      <path d="M63 74 C67 80 73 80 77 74 L77 82 L63 82 Z" fill="#f1ba94" />

      {/* Face & Ears */}
      <ellipse cx="70" cy="58" rx="23" ry="24" fill="#fcd2b2" />
      <ellipse cx="47" cy="59" rx="4" ry="6" fill="#fcd2b2" />
      <ellipse cx="93" cy="59" rx="4" ry="6" fill="#fcd2b2" />

      {/* Cheeks rosy blush */}
      <ellipse cx="55" cy="63" rx="5" ry="3.5" fill="#f7a08b" opacity="0.4" />
      <ellipse cx="85" cy="63" rx="5" ry="3.5" fill="#f7a08b" opacity="0.4" />

      {/* Eyes with friendly catchlight */}
      <ellipse cx="58" cy="56" rx="3.5" ry="4.5" fill="#1e2220" />
      <circle cx="59.5" cy="54.5" r="1.5" fill="#ffffff" />

      <ellipse cx="82" cy="56" rx="3.5" ry="4.5" fill="#1e2220" />
      <circle cx="83.5" cy="54.5" r="1.5" fill="#ffffff" />

      {/* Soft arched eyebrows */}
      <path d="M52 48 C55 45.5 61 45.5 64 48" stroke="#3d332f" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M76 48 C79 45.5 85 45.5 88 48" stroke="#3d332f" strokeWidth="1.6" strokeLinecap="round" />

      {/* Cute nose & warm smile */}
      <path d="M69 60 Q70 63 71 60" stroke="#e09d7a" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M64 67 Q70 72 76 67" stroke="#9e4334" strokeWidth="2" strokeLinecap="round" />

      {/* Hair front: middle/side part curving behind ears down to shoulders */}
      <path
        d="M44 54 C44 32 58 26 70 26 C82 26 96 32 96 54 C96 64 93 76 90 82 C87 70 85 54 78 50 C71 46 62 48 56 52 C51 56 49 68 48 78 C46 72 44 63 44 54 Z"
        fill="#1e2220"
      />

      {/* Dark pine green scrub top V-neck */}
      <polygon points="58,82 82,82 70,104" fill="#0e382d" />

      {/* White Doctor Lab Coat */}
      <path d="M32 140 L36 100 C38 91 48 85 58 83 L70 102 L82 83 C92 85 102 91 104 100 L108 140 Z" fill="#ffffff" />
      {/* Crisp Coat Lapels */}
      <path d="M54 84 L65 108 L57 110 L44 94 Z" fill="#edf2f0" />
      <path d="M86 84 L75 108 L83 110 L96 94 Z" fill="#edf2f0" />
      {/* Center seam */}
      <line x1="70" y1="102" x2="70" y2="140" stroke="#d5dedb" strokeWidth="1.6" />
    </svg>
  );
}

export interface NutritionistCredentialCardProps {
  verifier: VerifierData;
  nutritionistNote?: string | null;
  onViewNotes?: () => void;
  layout?: 'horizontal' | 'vertical' | 'responsive';
  className?: string;
}

export function NutritionistCredentialCard({
  verifier,
  nutritionistNote,
  onViewNotes,
  layout = 'responsive',
  className = '',
}: NutritionistCredentialCardProps) {
  const maskedPrc = maskPrcLicenseNumber(verifier.prcLicenseNumber);
  const displayName = verifier.name?.endsWith('RND') ? verifier.name : `${verifier.name || 'Reviewer'}, RND`;

  if (layout === 'vertical') {
    return (
      <div
        className={`relative overflow-hidden rounded-[26px] border border-[#dce4e0] dark:border-[#173e33] bg-[#faf8f5] dark:bg-[#0e271f] text-[#0d2820] dark:text-slate-100 shadow-xl ${className}`}
      >
        {/* Retro Wave Organic Corner Accent (Top Left) */}
        <div className="pointer-events-none absolute -top-0.5 -left-0.5 h-32 w-32 overflow-hidden rounded-tl-[26px] z-0">
          <svg viewBox="0 0 160 160" className="h-full w-full" fill="none">
            <path d="M0,0 L160,0 C140,40 105,95 40,135 C20,147 0,155 0,155 Z" fill="#eb6a38" />
            <path d="M0,0 L120,0 C105,30 80,72 30,105 C15,115 0,120 0,120 Z" fill="#f09e6c" />
            <path d="M0,0 L78,0 C68,20 50,48 18,70 C8,76 0,80 0,80 Z" className="fill-[#1b4e41] dark:fill-[#164639]" />
          </svg>
        </div>

        {/* Top Header: Brand & Identity */}
        <div className="relative p-5 sm:p-6 text-center z-10 space-y-3">
          <div className="w-full flex items-center justify-start gap-2 pl-1">
            <KainaraLogo size={22} variant="multicolor" />
            <span className="font-display font-black text-sm tracking-tight text-[#0d2820] dark:text-white lowercase">
              kainara
            </span>
          </div>

          <div className="flex justify-center my-1">
            <div className="h-28 w-28 rounded-full shadow-lg overflow-hidden flex items-center justify-center border-2 border-[#1a5c48]/40 dark:border-[#1a5c48]/50 bg-[#faeedd]">
              {verifier.officialHeadshot || verifier.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={verifier.officialHeadshot || verifier.image!}
                  alt={verifier.name}
                  className="h-full w-full object-cover rounded-full"
                />
              ) : (
                <DietitianAvatarIllustration />
              )}
            </div>
          </div>

          <div className="space-y-1">
            <h3 className="font-display text-lg sm:text-xl font-bold text-[#0d2820] dark:text-white tracking-tight">
              {displayName}
            </h3>
            <p className="text-xs font-normal text-[#5a746a] dark:text-[#8ea79d]">RND</p>
            <div className="pt-1.5 flex justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/30 dark:border-[#1a5c48] bg-emerald-100/70 dark:bg-[#0e352b] px-3.5 py-1 text-xs font-semibold text-emerald-800 dark:text-[#38c172] shadow-sm">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-700 dark:text-[#38c172]" />
                Recorded RND review
              </span>
            </div>
          </div>

          <p className="pt-1 text-center text-xs text-[#5a746a] dark:text-[#8ea79d]">
            Review attributed to {displayName}
          </p>
        </div>

        {/* Dashed Horizontal Divider */}
        <div className="border-t border-dashed border-[#dce4e0] dark:border-[#1a4438] mx-5 sm:mx-6" />

        {/* 4 Credentials */}
        <div className="relative p-5 sm:p-6 space-y-4 z-10">
          {/* 1. Specialization */}
          <div className="flex items-start gap-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#114436] text-white shadow-sm mt-0.5">
              <User className="h-4.5 w-4.5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium text-[#6b857c] dark:text-[#8ea79d]">Specialization</p>
              <p className="text-xs sm:text-sm font-bold text-[#0d2820] dark:text-white leading-snug mt-0.5">
                {verifier.specialization || 'Not recorded'}
              </p>
            </div>
          </div>

          {/* 2. Education */}
          <div className="flex items-start gap-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#df952b] text-white shadow-sm mt-0.5">
              <GraduationCap className="h-4.5 w-4.5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium text-[#6b857c] dark:text-[#8ea79d]">Education</p>
              <p className="text-xs sm:text-sm font-bold text-[#0d2820] dark:text-white leading-snug mt-0.5">
                Recorded institution
              </p>
              <p className="text-xs text-[#5a746a] dark:text-[#8ea79d] font-normal mt-0.5">
                {verifier.university || 'Not recorded'}
              </p>
            </div>
          </div>

          {/* 3. Licensure */}
          <div className="flex items-start gap-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#df6338] text-white shadow-sm mt-0.5">
              <Award className="h-4.5 w-4.5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium text-[#6b857c] dark:text-[#8ea79d]">Licensure</p>
              <p className="text-xs sm:text-sm font-bold text-[#0d2820] dark:text-white leading-snug mt-0.5">RND</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                <span className="text-xs text-[#5a746a] dark:text-[#8ea79d] font-normal">{maskedPrc}</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-600/30 dark:border-emerald-500/30 bg-emerald-100/80 dark:bg-emerald-950/50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  <ShieldCheck className="h-2.5 w-2.5 text-emerald-700 dark:text-emerald-400" />
                  Recorded license
                </span>
              </div>
            </div>
          </div>

          {/* 4. Experience */}
          <div className="flex items-start gap-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1e888e] text-white shadow-sm mt-0.5">
              <Calendar className="h-4.5 w-4.5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium text-[#6b857c] dark:text-[#8ea79d]">Experience</p>
              <p className="text-xs sm:text-sm font-bold text-[#0d2820] dark:text-white leading-snug mt-0.5">
                {verifier.yearsOfExperience == null ? 'Not recorded' : `${verifier.yearsOfExperience} years`}
              </p>
              <p className="text-xs text-[#5a746a] dark:text-[#8ea79d] font-normal mt-0.5">
                Recorded professional experience
              </p>
            </div>
          </div>

          {/* Bottom Tagline & Maiden Corner */}
          <div className="relative pt-3 flex items-end justify-between pr-20 border-t border-[#dce4e0] dark:border-[#1a4438]/50">
            <div className="space-y-1">
              <p className="text-xs text-[#5a746a] dark:text-[#8ea79d] leading-relaxed">
                Supporting your health
                <br />
                with science-backed nutrition.
              </p>
              {nutritionistNote && onViewNotes && (
                <button
                  type="button"
                  onClick={onViewNotes}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 transition underline underline-offset-2 pt-0.5"
                >
                  <span>View Clinical Adjustments</span>
                  <span>↗</span>
                </button>
              )}
            </div>

            <div className="absolute -bottom-2 -right-2 flex items-center justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1a4e40] dark:bg-[#133a30] shadow-md border border-[#2a6857]/40 dark:border-[#1d5244]/40 overflow-hidden">
                <KainaraLogo size={52} variant="multicolor" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Horizontal / Responsive (2-column layout as in modal)
  return (
    <div
      className={`relative overflow-hidden rounded-[28px] sm:rounded-[32px] border border-[#dce4e0] dark:border-[#173e33] bg-[#faf8f5] dark:bg-[#0e271f] text-[#0d2820] dark:text-slate-100 shadow-2xl ${className}`}
    >
      {/* Retro Wave Organic Corner Accent (Top Left) */}
      <div className="pointer-events-none absolute -top-0.5 -left-0.5 h-36 w-36 sm:h-44 sm:w-44 overflow-hidden rounded-tl-[28px] sm:rounded-tl-[32px] z-0">
        <svg viewBox="0 0 160 160" className="h-full w-full" fill="none">
          <path d="M0,0 L160,0 C140,40 105,95 40,135 C20,147 0,155 0,155 Z" fill="#eb6a38" />
          <path d="M0,0 L120,0 C105,30 80,72 30,105 C15,115 0,120 0,120 Z" fill="#f09e6c" />
          <path d="M0,0 L78,0 C68,20 50,48 18,70 C8,76 0,80 0,80 Z" className="fill-[#1b4e41] dark:fill-[#164639]" />
        </svg>
      </div>

      {/* 2-Column Grid Layout with inset dashed divider */}
      <div className="grid grid-cols-1 md:grid-cols-[1.08fr_auto_1.52fr] items-stretch min-h-[470px]">
        {/* ──── LEFT PANEL: Identity & Avatar ──── */}
        <div className="relative flex flex-col items-center justify-between p-6 sm:p-8 text-center z-10">
          <div className="w-full flex items-center justify-start gap-2 pl-2 pt-1">
            <KainaraLogo size={24} variant="multicolor" />
            <span className="font-display font-black text-lg tracking-tight text-[#0d2820] dark:text-white lowercase">
              kainara
            </span>
          </div>

          <div className="my-3 sm:my-4 relative">
            <div className="h-32 w-32 sm:h-36 sm:w-36 rounded-full shadow-lg overflow-hidden flex items-center justify-center border-2 border-[#1a5c48]/40 dark:border-[#1a5c48]/50 bg-[#faeedd]">
              {verifier.officialHeadshot || verifier.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={verifier.officialHeadshot || verifier.image!}
                  alt={verifier.name}
                  className="h-full w-full object-cover rounded-full"
                />
              ) : (
                <DietitianAvatarIllustration />
              )}
            </div>
          </div>

          <div className="space-y-1 w-full">
            <h3 className="font-display text-xl sm:text-2xl font-bold text-[#0d2820] dark:text-white tracking-tight">
              {displayName}
            </h3>
            <p className="text-xs font-normal text-[#5a746a] dark:text-[#8ea79d]">RND</p>

            <div className="pt-2 flex justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/30 dark:border-[#1a5c48] bg-emerald-100/70 dark:bg-[#0e352b] px-3.5 py-1 text-xs font-semibold text-emerald-800 dark:text-[#38c172] shadow-sm">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-700 dark:text-[#38c172]" />
                Recorded RND review
              </span>
            </div>
          </div>

          <p className="pt-3 text-center text-xs text-[#5a746a] dark:text-[#8ea79d]">
            Review attributed to {displayName}
          </p>
        </div>

        {/* ──── MIDDLE: Inset Dashed Vertical Divider ──── */}
        <div className="hidden md:block w-px border-r border-dashed border-[#dce4e0] dark:border-[#1a4438] my-8" />

        {/* ──── RIGHT PANEL: 4 Credentials & Bottom Maiden ──── */}
        <div className="relative flex flex-col justify-between p-6 sm:p-8 space-y-6 z-10">
          <div className="space-y-5 pt-1 sm:pt-2">
            {/* 1. Specialization */}
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#114436] text-white shadow-sm">
                <User className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-[#6b857c] dark:text-[#8ea79d]">Specialization</p>
                <p className="text-sm sm:text-[15px] font-bold text-[#0d2820] dark:text-white leading-snug mt-0.5">
                  {verifier.specialization || 'Not recorded'}
                </p>
              </div>
            </div>

            {/* 2. Education */}
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#df952b] text-white shadow-sm">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-[#6b857c] dark:text-[#8ea79d]">Education</p>
                <p className="text-sm sm:text-[15px] font-bold text-[#0d2820] dark:text-white leading-snug mt-0.5">
                  Recorded institution
                </p>
                <p className="text-xs text-[#5a746a] dark:text-[#8ea79d] font-normal mt-0.5">
                  {verifier.university || 'Not recorded'}
                </p>
              </div>
            </div>

            {/* 3. Licensure */}
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#df6338] text-white shadow-sm">
                <Award className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-[#6b857c] dark:text-[#8ea79d]">Licensure</p>
                <p className="text-sm sm:text-[15px] font-bold text-[#0d2820] dark:text-white leading-snug mt-0.5">
                  RND
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-[#5a746a] dark:text-[#8ea79d] font-normal">{maskedPrc}</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-600/30 dark:border-emerald-500/30 bg-emerald-100/80 dark:bg-emerald-950/50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    <ShieldCheck className="h-2.5 w-2.5 text-emerald-700 dark:text-emerald-400" />
                    Recorded license
                  </span>
                </div>
              </div>
            </div>

            {/* 4. Experience */}
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1e888e] text-white shadow-sm">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium text-[#6b857c] dark:text-[#8ea79d]">Experience</p>
                <p className="text-sm sm:text-[15px] font-bold text-[#0d2820] dark:text-white leading-snug mt-0.5">
                  {verifier.yearsOfExperience == null ? 'Not recorded' : `${verifier.yearsOfExperience} years`}
                </p>
                <p className="text-xs text-[#5a746a] dark:text-[#8ea79d] font-normal mt-0.5">
                  Recorded professional experience
                </p>
              </div>
            </div>
          </div>

          <div className="relative pt-2 flex items-end justify-between pr-24">
            <div className="space-y-1">
              <p className="text-xs text-[#5a746a] dark:text-[#8ea79d] leading-relaxed">
                Supporting your health
                <br />
                with science-backed nutrition.
              </p>
              {nutritionistNote && onViewNotes && (
                <button
                  type="button"
                  onClick={onViewNotes}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 transition underline underline-offset-2 pt-0.5"
                >
                  <span>View Clinical Adjustments</span>
                  <span>↗</span>
                </button>
              )}
            </div>

            <div className="absolute -bottom-4 -right-4 flex items-center justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#1a4e40] dark:bg-[#133a30] shadow-md border border-[#2a6857]/40 dark:border-[#1d5244]/40 overflow-hidden">
                <KainaraLogo size={66} variant="multicolor" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

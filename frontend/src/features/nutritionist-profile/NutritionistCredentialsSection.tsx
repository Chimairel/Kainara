'use client';

import Link from 'next/link';

import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';

import { Check, Award, GraduationCap, Stethoscope, FileCheck2, ArrowRight } from 'lucide-react';

import type { useNutritionistProfilePageModel } from './useNutritionistProfilePageModel';
type Model = Extract<ReturnType<typeof useNutritionistProfilePageModel>, { kind: 'ready' }>;
type SectionProps = { model: Pick<Model, 'profile' | 'user' | 'formattedExpiry'> };
export default function NutritionistCredentialsSection({ model }: SectionProps) {
  const { profile, user, formattedExpiry } = model;

  return (
    <>
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
                      alt={user?.name || 'RND'}
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
    </>
  );
}

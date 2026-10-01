'use client';

import React from 'react';
import { ArrowUpRight, Check } from 'lucide-react';
import { motion } from 'motion/react';
import ProBadge from '@/components/ui/ProBadge';

import type { Variants } from 'motion/react';

export interface PricingProps {
  currentLevel?: 'FREE' | 'TRIAL_PENDING' | 'TRIAL' | 'MEMBER' | null;
  isEnhanced?: boolean;
  limits?: {
    freeSwaps: number;
    freeEstimates: number;
    memberSwaps: number;
    memberEstimates: number;
    memberReplans: number;
    memberPlanReviews: number;
    memberOutsideReviews: number;
  };
}

export default function Pricing({ currentLevel, isEnhanced, limits }: PricingProps) {
  const defaultLimits = {
    freeSwaps: 3,
    freeEstimates: 2,
    memberSwaps: 6,
    memberEstimates: 10,
    memberReplans: 2,
    memberPlanReviews: 1,
    memberOutsideReviews: 1,
  };

  const l = limits || defaultLimits;

  const cardVariants: Variants = {
    hidden: {
      opacity: 0,
      y: 30,
    },
    visible: (index: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: index * 0.15,
        duration: 0.5,
        ease: 'easeInOut',
      },
    }),
  };

  const basicFeatures = [
    'General weekly plans (no declared conditions or allergies)',
    `${l.freeSwaps} meal swaps per plan cycle`,
    `${l.freeEstimates} AI outside-meal estimate requests / week`,
    'Interactive grocery checklists & manual food logging',
    'Saved records & historical data export',
    'Always free health corrections & allergy declarations',
    'Follow-up and completion of admitted reviews',
  ];

  const proFeatures = [
    'Everything in Basic, plus:',
    `${l.memberSwaps} meal swaps per cycle (${Math.round(l.memberSwaps / l.freeSwaps)}x basic allowance)`,
    `${l.memberEstimates} AI estimate requests / week (${Math.round(l.memberEstimates / l.freeEstimates)}x allowance)`,
    `${l.memberReplans} optional AI replans per Manila week`,
    `${l.memberPlanReviews} case plan-review episode per target week`,
    `${l.memberOutsideReviews} requested outside-meal review episode / week`,
    'Progress trajectory, weight analytics & adaptive check-ins',
    'Discretionary goal, preference and shopping updates',
  ];

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-3 justify-center items-center text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-border bg-brand-bgAlt px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-brand-muted">
          Tiers & Capabilities
        </span>
        <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-brand-text max-w-3xl leading-tight">
          Included Baseline and Pro Capabilities
        </h2>
        <p className="max-w-xl text-xs sm:text-sm text-brand-muted leading-relaxed">
          Every account begins with our baseline Filipino meal planning. Pro unlocks weekly adaptive replanning,
          clinical case reviews, and expanded allowances.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row items-stretch justify-center gap-6 w-full">
        {/* CARD 1: BASIC (SLATE-BLUE TINT PER REFERENCE) */}
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          custom={0}
          className="w-full flex-1"
        >
          <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-[#1e2e48] bg-gradient-to-br from-[#0d1b2e] to-[#08111d] p-6 sm:p-8 text-white shadow-xl transition-shadow hover:shadow-2xl">
            {/* Top Slate-Blue Accent Ribbon */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-blue-500/40 rounded-t-3xl z-20" />

            <div className="relative z-10 flex flex-col sm:flex-row gap-6 md:gap-8 items-start self-stretch h-full w-full">
              {/* Left Column */}
              <div className="flex flex-col items-start justify-between self-stretch gap-6 w-full sm:w-[46%] shrink-0">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-lg bg-white/10 border border-white/15 px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-blue-200">
                      Basic
                    </span>
                    {currentLevel === 'FREE' && (
                      <span className="rounded-full bg-blue-500/25 border border-blue-400/30 px-2 py-0.5 text-[10px] font-bold text-blue-100">
                        Current Plan
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-normal text-slate-300/80 leading-relaxed">
                    General meal planning based on your starting intake, grocery checklists, and essential tracking.
                  </p>
                </div>

                <div className="flex flex-col gap-3 w-full">
                  <div>
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="font-display text-3xl sm:text-4xl font-extrabold text-white">Free</span>
                      <span className="text-xs font-normal text-slate-400">/ forever</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Included for every registered account</span>
                  </div>

                  <div className="relative inline-flex items-center justify-center rounded-full bg-white text-slate-900 text-xs font-semibold h-11 px-6 w-fit shadow-sm">
                    <span>{currentLevel === 'FREE' ? 'Current Active Tier' : 'Included Baseline'}</span>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="hidden sm:block w-[1px] self-stretch bg-white/10 shrink-0" />
              <div className="sm:hidden block h-[1px] w-full bg-white/10 shrink-0" />

              {/* Right Column: Features */}
              <div className="flex flex-col items-start gap-3 grow w-full sm:w-[54%]">
                <p className="font-display text-sm sm:text-base font-bold text-white">Features</p>
                <ul className="flex flex-col items-start self-stretch gap-2.5">
                  {basicFeatures.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-200 leading-snug">
                      <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 mt-0.5">
                        <Check size={11} strokeWidth={2.5} aria-hidden="true" />
                      </div>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </motion.div>

        {/* CARD 2: PRO (DEEP EMERALD PINE TINT WITH RADIANT GLOWING BORDER BEAM) */}
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          custom={1}
          className="w-full flex-1"
        >
          {/* Glowing Border Beam Container */}
          <div className="relative flex h-full flex-col justify-between rounded-3xl">
            {/* 1. Atmospheric Diffuse Glow (Highly Visible in Light Mode & Vibrant in Dark Mode) */}
            <div
              className="pointer-events-none absolute -inset-2 sm:-inset-3 overflow-hidden rounded-[36px] opacity-85 dark:opacity-70 blur-xl transition-opacity"
              aria-hidden="true"
            >
              <div
                className="absolute inset-[-150%] animate-[spin_5s_linear_infinite]"
                style={{
                  background:
                    'conic-gradient(from 0deg, transparent 0 240deg, #eb6a38 275deg, #f09e6c 310deg, #10b981 340deg, #34d399 360deg)',
                }}
              />
            </div>

            {/* 2. Secondary Intense Glow Layer */}
            <div
              className="pointer-events-none absolute -inset-1 overflow-hidden rounded-[28px] opacity-90 dark:opacity-80 blur-md transition-opacity"
              aria-hidden="true"
            >
              <div
                className="absolute inset-[-150%] animate-[spin_5s_linear_infinite]"
                style={{
                  background:
                    'conic-gradient(from 0deg, transparent 0 240deg, #eb6a38 275deg, #f09e6c 310deg, #10b981 340deg, #34d399 360deg)',
                }}
              />
            </div>

            {/* 3. Sharp 3px Border Beam Outer Frame */}
            <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-3xl p-[3px] bg-[#173e33]/90 shadow-2xl">
              {/* The Sharp Animated Border Beam */}
              <div
                className="pointer-events-none absolute inset-[-150%] animate-[spin_5s_linear_infinite]"
                style={{
                  background:
                    'conic-gradient(from 0deg, transparent 0 240deg, #eb6a38 275deg, #f09e6c 310deg, #10b981 340deg, #34d399 360deg)',
                }}
                aria-hidden="true"
              />

              {/* Inner Pro Card Container */}
              <div className="relative z-10 flex h-full flex-col justify-between overflow-hidden rounded-[21px] bg-gradient-to-br from-[#082e25] to-[#041914] p-6 sm:p-8 text-white">
              {/* Top 3-Tone Brand Stripe Header Ribbon */}
              <div className="absolute top-0 left-0 right-0 h-1.5 flex overflow-hidden rounded-t-[22px] z-20">
                <div className="flex-1 bg-[#1b4e41]" />
                <div className="flex-1 bg-[#f09e6c]" />
                <div className="flex-1 bg-[#eb6a38]" />
              </div>

              {/* Retro Wave Organic Corner Accent (Orange, Peach/Yellow, Green) */}
              <div className="pointer-events-none absolute -top-0.5 -right-0.5 h-36 w-36 sm:h-48 sm:w-48 overflow-hidden rounded-tr-[22px] z-0 opacity-85">
                <svg viewBox="0 0 160 160" className="h-full w-full" fill="none">
                  <path d="M160,0 L0,0 C20,40 55,95 120,135 C140,147 160,155 160,155 Z" fill="#eb6a38" />
                  <path d="M160,0 L40,0 C55,30 80,72 130,105 C145,115 160,120 160,120 Z" fill="#f09e6c" />
                  <path d="M160,0 L82,0 C92,20 110,48 142,70 C152,76 160,80 160,80 Z" fill="#1b4e41" />
                </svg>
              </div>

              <div className="relative z-10 flex flex-col sm:flex-row gap-6 md:gap-8 items-start self-stretch h-full w-full">
                {/* Left Column */}
                <div className="flex flex-col items-start justify-between self-stretch gap-6 w-full sm:w-[46%] shrink-0">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <ProBadge size="md" />
                      {isEnhanced && (
                        <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 px-2.5 py-0.5 text-[10px] font-bold">
                          {currentLevel === 'MEMBER' ? 'Active Member' : 'Pro Active'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-normal text-white/70 leading-relaxed">
                      2x the speed and capabilities. Adaptive weekly replanning, clinical case review, and weight
                      trajectory.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 w-full">
                    <div>
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <span className="font-display text-3xl sm:text-4xl font-extrabold text-white whitespace-nowrap">
                          999
                        </span>
                        <span className="text-xs font-normal text-white/60">/ month</span>
                      </div>
                      <span className="text-[10px] text-white/50">Full clinical & AI suite for your journey</span>
                    </div>

                    <div className="space-y-1.5">
                      {/* pricing-01 animated pill button (disabled for policy compliance) */}
                      <button
                        type="button"
                        disabled
                        aria-label="Purchases opening soon"
                        className="relative flex items-center justify-between rounded-full bg-[#eb6a38] text-white text-xs font-bold h-11 ps-5 pe-12 group transition-all duration-300 w-fit overflow-hidden cursor-not-allowed opacity-95 shadow-md shadow-orange-950/40"
                      >
                        <span className="relative z-10">Purchases opening soon</span>
                        <div className="absolute right-1 w-9 h-9 bg-white/20 text-white rounded-full flex items-center justify-center transition-all duration-300">
                          <ArrowUpRight size={15} />
                        </div>
                      </button>
                      <p className="text-[10px] text-white/50 leading-tight">
                        Pricing and payment setup are being finalized. No payment details are collected and no automatic
                        charges occur.
                      </p>
                    </div>
                  </div>
                </div>

              {/* Divider */}
              <div className="hidden sm:block w-[1px] self-stretch bg-white/10 shrink-0" />
              <div className="sm:hidden block h-[1px] w-full bg-white/10 shrink-0" />

              {/* Right Column: Features */}
              <div className="flex flex-col items-start gap-3 grow w-full sm:w-[54%]">
                <p className="font-display text-sm sm:text-base font-bold text-white">Features</p>
                <ul className="flex flex-col items-start self-stretch gap-2.5">
                  {proFeatures.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs leading-snug">
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full mt-0.5 ${
                          idx === 0
                            ? 'bg-transparent text-white/40'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        <Check size={11} strokeWidth={2.5} aria-hidden="true" />
                      </div>
                      <span
                        className={
                          idx === 0
                            ? 'font-bold text-[#f09e6c]'
                            : 'text-white/90 font-medium'
                        }
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
      </div>
    </div>
  );
}


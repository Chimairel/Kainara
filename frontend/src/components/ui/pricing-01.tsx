'use client';

import React from 'react';
import { ArrowUpRight, Check, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

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
      <div className="flex flex-col gap-2 justify-center items-center text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-border bg-brand-bgAlt px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-brand-muted">
          Plan Tiers
        </span>
        <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-brand-text">
          Pick the plan that fits your health journey
        </h2>
        <p className="max-w-lg text-xs text-brand-muted leading-relaxed">
          Transparent access designed for cultural Filipino meals, clinical precision, and everyday sustainability.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row items-stretch justify-center gap-6 w-full">
        {/* CARD 1: BASIC */}
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          custom={0}
          className="w-full flex-1"
        >
          <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-brand-border bg-brand-surface p-6 sm:p-8 shadow-xs transition-shadow hover:shadow-sm">
            <div className="flex flex-col sm:flex-row gap-6 md:gap-8 items-start self-stretch h-full w-full">
              {/* Left Column */}
              <div className="flex flex-col items-start justify-between self-stretch gap-6 w-full sm:w-[46%] shrink-0">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-brand-bgAlt border border-brand-border px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-brand-muted">
                      Basic
                    </span>
                    {currentLevel === 'FREE' && (
                      <span className="rounded-full bg-brand-bgAlt border border-brand-border px-2 py-0.5 text-[10px] font-bold text-brand-text">
                        Current Plan
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-normal text-brand-muted leading-relaxed">
                    General meal planning based on your starting intake, grocery checklists, and essential tracking.
                  </p>
                </div>

                <div className="flex flex-col gap-3 w-full">
                  <div>
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="font-display text-3xl sm:text-4xl font-extrabold text-brand-text">Free</span>
                      <span className="text-xs font-normal text-brand-muted">/ forever</span>
                    </div>
                    <span className="text-[10px] text-brand-muted">Included for every registered account</span>
                  </div>

                  <div className="relative inline-flex items-center justify-center rounded-full border border-brand-border bg-brand-bgAlt/80 text-brand-muted text-xs font-semibold h-11 px-5 w-fit">
                    <span>{currentLevel === 'FREE' ? 'Current Active Tier' : 'Included Baseline'}</span>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="hidden sm:block w-[1px] self-stretch bg-brand-border/70 shrink-0" />
              <div className="sm:hidden block h-[1px] w-full bg-brand-border/70 shrink-0" />

              {/* Right Column: Features */}
              <div className="flex flex-col items-start gap-3 grow w-full sm:w-[54%]">
                <p className="font-display text-sm sm:text-base font-bold text-brand-text">Features</p>
                <ul className="flex flex-col items-start self-stretch gap-2.5">
                  {basicFeatures.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-brand-text leading-snug">
                      <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-bgAlt border border-brand-border text-brand-muted mt-0.5">
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

        {/* CARD 2: PRO (WITH KAINARA 3-TONE STRIPES) */}
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          custom={1}
          className="w-full flex-1"
        >
          <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-[#173e33] bg-[#071914] p-6 sm:p-8 text-white shadow-xl transition-shadow hover:shadow-2xl">
            {/* Top 3-Tone Brand Stripe Header Ribbon */}
            <div className="absolute top-0 left-0 right-0 h-1.5 flex overflow-hidden rounded-t-3xl z-20">
              <div className="flex-1 bg-[#1b4e41]" />
              <div className="flex-1 bg-[#f09e6c]" />
              <div className="flex-1 bg-[#eb6a38]" />
            </div>

            {/* Retro Wave Organic Corner Accent (Orange, Peach/Yellow, Green) */}
            <div className="pointer-events-none absolute -top-0.5 -right-0.5 h-36 w-36 sm:h-48 sm:w-48 overflow-hidden rounded-tr-3xl z-0 opacity-85">
              <svg viewBox="0 0 160 160" className="h-full w-full" fill="none">
                <path d="M160,0 L0,0 C20,40 55,95 120,135 C140,147 160,155 160,155 Z" fill="#eb6a38" />
                <path d="M160,0 L40,0 C55,30 80,72 130,105 C145,115 160,120 160,120 Z" fill="#f09e6c" />
                <path d="M160,0 L82,0 C92,20 110,48 142,70 C152,76 160,80 160,80 Z" fill="#1b4e41" />
              </svg>
            </div>

            {/* Signature 3-Tone Diagonal Stripes Texture across Pro Card */}
            <div
              className="pointer-events-none absolute inset-0 rounded-3xl opacity-15"
              style={{
                backgroundImage: `repeating-linear-gradient(
                  -45deg,
                  #1b4e41 0px,
                  #1b4e41 7px,
                  #f09e6c 7px,
                  #f09e6c 14px,
                  #eb6a38 14px,
                  #eb6a38 21px,
                  transparent 21px,
                  transparent 50px
                )`,
              }}
              aria-hidden="true"
            />

            <div className="relative z-10 flex flex-col sm:flex-row gap-6 md:gap-8 items-start self-stretch h-full w-full">
              {/* Left Column */}
              <div className="flex flex-col items-start justify-between self-stretch gap-6 w-full sm:w-[46%] shrink-0">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#eb6a38] via-[#f09e6c] to-[#1b4e41] p-[1.5px] shadow-sm">
                      <span className="flex items-center gap-1 rounded-full bg-[#071914] px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-[#f09e6c]">
                        <Sparkles className="h-3 w-3 text-[#eb6a38]" />
                        <span>Pro</span>
                      </span>
                    </span>
                    {isEnhanced && (
                      <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 px-2.5 py-0.5 text-[10px] font-bold">
                        {currentLevel === 'MEMBER' ? 'Active Member' : 'Trial Active'}
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
                      <span className="font-display text-2xl sm:text-3xl font-extrabold text-white whitespace-nowrap">
                        14-Day Trial
                      </span>
                      <span className="text-xs font-normal text-white/60">/ included</span>
                    </div>
                    <span className="text-[10px] text-white/50">Full clinical & AI suite for every account</span>
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
        </motion.div>
      </div>
    </div>
  );
}

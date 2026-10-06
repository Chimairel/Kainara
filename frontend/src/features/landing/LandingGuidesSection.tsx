'use client';

import Link from 'next/link';

import { motion } from 'motion/react';
import { Database, ArrowUpRight, ShieldCheck, Sparkles } from 'lucide-react';

import KainaraLogo from '@/components/shared/KainaraLogo';

export default function LandingGuidesSection() {
  return (
    <>
      <section className="mx-auto max-w-[1440px] px-5 py-24 sm:px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.7 }}
          className="grid overflow-hidden rounded-[36px] border border-brand-border/70 bg-brand-surface/80 shadow-2xl backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]"
        >
          {/* Left Column: Documentation Overview */}
          <div className="flex flex-col justify-between p-8 sm:p-12 lg:p-14 xl:p-16">
            <div>
              <h2 className="max-w-xl font-display text-3xl font-black leading-[1.05] tracking-[-0.04em] sm:text-5xl">
                The comprehensive guide to <span className="text-gradient">KAINARA.</span>
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-brand-muted sm:text-base">
                Explore meal planning, energy estimates, food-composition references, nutritionist review, account
                controls and help for using KAINARA.
              </p>

              {/* Guide Pillar Tags */}
              <div className="mt-8 flex flex-wrap gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-brand-border/80 bg-brand-bg/60 px-3 py-1.5 text-xs font-semibold text-brand-text">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Clinical Safeguards
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-brand-border/80 bg-brand-bg/60 px-3 py-1.5 text-xs font-semibold text-brand-text">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-cyan" />
                  FNRI / USDA References
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-brand-border/80 bg-brand-bg/60 px-3 py-1.5 text-xs font-semibold text-brand-text">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#f09e6c]" />
                  Workflow Handbooks
                </span>
              </div>
            </div>

            <div className="mt-10">
              <Link
                href="/docs"
                className="group inline-flex min-h-12 items-center gap-2.5 rounded-2xl border border-emerald-500/20 bg-[#071914] px-7 text-sm font-bold text-white shadow-md transition duration-200 hover:-translate-y-0.5 hover:border-emerald-500/40 hover:bg-[#0e271f] hover:shadow-lg active:scale-[0.98]"
              >
                Explore Documentation
                <ArrowUpRight className="h-4 w-4 text-white transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </div>
          </div>

          {/* Right Column: Interactive Guides Cockpit */}
          <div className="relative min-h-[460px] overflow-hidden bg-[#071914] p-7 text-white sm:p-10 border-t lg:border-t-0 lg:border-l border-[#173e33]">
            {/* Watermark Logo */}
            <div className="pointer-events-none absolute -bottom-8 -right-8 hidden sm:flex items-center justify-center opacity-10">
              <KainaraLogo size={160} variant="multicolor" />
            </div>

            <div className="relative z-10 grid h-full grid-cols-1 gap-1.5 sm:grid-cols-2">
              {/* Restrictions & Review - Left Tall Card (Stripe 1: Pine Green #1b4e41) */}
              <Link
                href="/docs#clinical-guidelines"
                className="group relative flex flex-col justify-between overflow-hidden rounded-[22px] border border-[#276a5a] bg-[#1b4e41] p-6 text-white transition duration-200 hover:brightness-105 active:scale-[0.99]"
              >
                {/* Yellow Stripe Accent Curve in Corner (#f09e6c) */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-1 -right-1 z-10 h-24 w-24 select-none"
                >
                  <svg viewBox="0 0 96 96" fill="none" className="h-full w-full block">
                    <path d="M 8 104 C 16 52 52 16 104 8" stroke="#f09e6c" strokeWidth="12" strokeLinecap="round" />
                  </svg>
                </div>

                <div className="relative z-20 flex items-center justify-between">
                  <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-200">
                    Clinical Scope
                  </span>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </div>
                </div>

                <div className="relative z-20 my-auto py-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-white/10 text-white transition-transform duration-300 group-hover:scale-105">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 font-display text-base font-bold text-white">Restrictions & Review</h3>
                  <p className="mt-2 text-xs leading-5 text-emerald-100/80">
                    Declared restrictions, profile checks and scoped nutritionist decisions.
                  </p>
                </div>

                <div className="relative z-20 flex flex-wrap gap-1.5 border-t border-white/15 pt-3 max-w-[calc(100%-60px)]">
                  <span className="rounded-md border border-white/15 bg-black/20 px-2 py-0.5 font-mono text-[9px] text-emerald-100">
                    Allergies
                  </span>
                  <span className="rounded-md border border-white/15 bg-black/20 px-2 py-0.5 font-mono text-[9px] text-emerald-100">
                    Conditions
                  </span>
                  <span className="rounded-md border border-white/15 bg-black/20 px-2 py-0.5 font-mono text-[9px] text-emerald-100">
                    RND Audit
                  </span>
                </div>
              </Link>

              {/* Right Stacked Cards */}
              <div className="grid gap-1.5">
                {/* Energy & Food References (Stripe 2: Warm Peach #f09e6c) */}
                <Link
                  href="/docs#meal-planning"
                  className="group relative flex flex-col justify-between overflow-hidden rounded-[22px] border border-[#d88959] bg-[#f09e6c] p-5 text-[#071914] transition duration-200 hover:brightness-105 active:scale-[0.99]"
                >
                  {/* Orange Stripe Accent Curve in Corner (#eb6a38) */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-1 -right-1 z-10 h-20 w-20 select-none"
                  >
                    <svg viewBox="0 0 80 80" fill="none" className="h-full w-full block">
                      <path d="M 6 86 C 12 42 42 12 86 6" stroke="#eb6a38" strokeWidth="11" strokeLinecap="round" />
                    </svg>
                  </div>

                  <div className="relative z-20">
                    <div className="flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#071914]/20 bg-[#071914]/10 text-[#071914] transition-transform duration-300 group-hover:scale-105">
                        <Database className="h-5 w-5" />
                      </div>
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#071914]/20 bg-[#071914]/10 text-[#071914] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <h3 className="mt-3.5 text-sm font-bold text-[#071914]">Energy & Food References</h3>
                    <p className="mt-1 text-[11px] leading-4 text-[#071914]/80">
                      Resting-energy estimates, activity adjustments and ingredient nutrition.
                    </p>
                  </div>
                  <div className="relative z-20 mt-3 flex flex-wrap gap-1.5 border-t border-[#071914]/15 pt-2.5 max-w-[calc(100%-48px)]">
                    <span className="rounded-md border border-[#071914]/15 bg-[#071914]/10 px-1.5 py-0.5 font-mono text-[9px] text-[#071914] font-semibold">
                      FNRI FCT
                    </span>
                    <span className="rounded-md border border-[#071914]/15 bg-[#071914]/10 px-1.5 py-0.5 font-mono text-[9px] text-[#071914] font-semibold">
                      Mifflin-St Jeor
                    </span>
                  </div>
                </Link>

                {/* Guides & FAQs (Stripe 3: Vibrant Coral Orange #eb6a38) */}
                <Link
                  href="/docs#help"
                  className="group relative flex flex-col justify-between overflow-hidden rounded-[22px] border border-[#cf5626] bg-[#eb6a38] p-5 text-white transition duration-200 hover:brightness-105 active:scale-[0.99]"
                >
                  {/* Green Stripe Accent Curve in Corner (#1b4e41) */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -bottom-1 -right-1 z-10 h-20 w-20 select-none"
                  >
                    <svg viewBox="0 0 80 80" fill="none" className="h-full w-full block">
                      <path d="M 6 86 C 12 42 42 12 86 6" stroke="#1b4e41" strokeWidth="11" strokeLinecap="round" />
                    </svg>
                  </div>

                  <div className="relative z-20">
                    <div className="flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/25 bg-white/15 text-white transition-transform duration-300 group-hover:scale-105">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/25 bg-white/15 text-white transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <h3 className="mt-3.5 text-sm font-bold text-white">Guides & FAQs</h3>
                    <p className="mt-1 text-[11px] leading-4 text-white/85">
                      Starter bridge plans, meal swaps, and grocery lists.
                    </p>
                  </div>
                  <div className="relative z-20 mt-3 flex flex-wrap gap-1.5 border-t border-white/20 pt-2.5 max-w-[calc(100%-48px)]">
                    <span className="rounded-md border border-white/20 bg-black/15 px-1.5 py-0.5 font-mono text-[9px] text-white">
                      Bridge Plans
                    </span>
                    <span className="rounded-md border border-white/20 bg-black/15 px-1.5 py-0.5 font-mono text-[9px] text-white">
                      Meal Swaps
                    </span>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </motion.div>
      </section>
    </>
  );
}

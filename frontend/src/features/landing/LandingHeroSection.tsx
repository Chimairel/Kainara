'use client';
import React from 'react';
import Link from 'next/link';

import { ArrowRight, ArrowUpRight, Activity, Flame, CheckCircle2 } from 'lucide-react';

import LandingHeroMedia from '@/components/landing/LandingHeroMedia';

import NaraPresenter from '@/components/landing/NaraPresenter';
import LandingMealGallery from '@/components/landing/LandingMealGallery';

import { ContainerScroll } from '@/components/ui/container-scroll-animation';

import type { useLandingHomeModel } from './useLandingHomeModel';
type Model = Extract<ReturnType<typeof useLandingHomeModel>, { kind: 'ready' }>;
type SectionProps = { model: Pick<Model, 'workspaceHref' | 'workspaceLabel' | 'initialMedia'> };
export default function LandingHeroSection({ model }: SectionProps) {
  const { workspaceHref, workspaceLabel, initialMedia } = model;

  return (
    <>
      <section className="relative overflow-hidden pt-6 pb-16 md:pt-10 md:pb-24">
        {/* Ambient glow mesh background */}
        <div className="pointer-events-none absolute left-[5%] top-16 h-96 w-96 rounded-full bg-emerald-500/15 blur-[120px] dark:bg-emerald-500/10" />
        <div className="pointer-events-none absolute right-[5%] top-24 h-[420px] w-[420px] rounded-full bg-brand-cyan/15 blur-[140px] dark:bg-brand-cyan/10" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[600px] rounded-full bg-brand-accent/10 blur-[160px] dark:bg-brand-accent/5" />

        <ContainerScroll
          backdrop={<NaraPresenter layer="body" />}
          foreground={<NaraPresenter layer="hands" />}
          className="!h-auto !p-4 md:!px-20 md:!py-8"
          contentClassName="!py-8 md:!py-12"
          presentationClassName="!mt-[clamp(11rem,44vw,34rem)] !w-[88%] md:!w-full !h-auto aspect-[16/10]"
          offset={['start start', 'end end']}
          cardClassName="max-w-5xl border-[#173e33] bg-[#071914]"
          innerClassName="p-0 bg-[#071914]"
          titleComponent={
            <div className="grid items-center gap-8 lg:grid-cols-2 lg:items-start lg:gap-12">
              <div
                data-hero-copy
                className="relative z-20 flex min-w-0 flex-col items-center text-center px-4 lg:w-[calc(100%+10rem)] lg:max-w-[40rem] lg:items-start lg:px-0 lg:text-left"
              >
                <h1 className="font-display text-[clamp(2.5rem,5.5vw,5.5rem)] font-black leading-[0.95] tracking-[-0.05em] text-brand-text">
                  Eat with <span className="text-gradient inline-block pb-1">intention.</span>
                </h1>

                <p className="mt-5 max-w-2xl text-base leading-7 text-brand-muted sm:text-lg sm:leading-8">
                  KAINARA brings familiar recipes, calculated nutrition targets and daily tracking into one workspace,
                  with AI-assisted planning and nutritionist review for applicable cases.
                </p>

                <div className="mt-8 flex flex-col justify-center gap-3.5 sm:flex-row sm:items-center sm:flex-wrap lg:justify-start">
                  <Link
                    href={workspaceHref}
                    className="group flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-brand-accent px-8 text-sm font-extrabold text-white shadow-neon transition duration-200 hover:-translate-y-1 hover:brightness-110 active:scale-[0.98]"
                  >
                    {workspaceLabel}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                  <Link
                    href="/docs"
                    className="group flex min-h-14 items-center justify-center gap-2.5 rounded-2xl border border-emerald-500/20 bg-[#071914] px-8 text-sm font-bold text-white shadow-md transition duration-200 hover:-translate-y-1 hover:border-emerald-400/50 hover:bg-[#0e271f] hover:shadow-lg active:scale-[0.98]"
                  >
                    Documentation
                    <ArrowUpRight className="h-4 w-4 text-white transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                </div>

                {/* Trust Indicators */}
                <div className="mt-10 flex flex-wrap items-center justify-center gap-6 sm:gap-8 border-t border-brand-border/70 pt-6 lg:justify-start">
                  {[
                    ['7 Days', 'Personalized Cycle', Flame, 'text-brand-accent dark:text-[#f09e6c]'],
                    ['3 Roles', 'Patient, RND & Admin', Activity, 'text-sky-600 dark:text-cyan-400'],
                    ['Visible', 'Meal Review Status', CheckCircle2, 'text-emerald-600 dark:text-emerald-400'],
                  ].map(([value, label, Icon, colorClass]) => {
                    const StatIcon = Icon as React.ComponentType<{ className?: string }>;
                    return (
                      <div key={label as string} className="flex flex-col items-center">
                        <div className="flex items-center gap-1.5">
                          <StatIcon className={`h-4 w-4 ${colorClass as string}`} />
                          <p className="font-display text-lg font-black tracking-tight text-brand-text sm:text-xl">
                            {value as string}
                          </p>
                        </div>
                        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-muted">
                          {label as string}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
              <LandingMealGallery />
            </div>
          }
        >
          {/* Published media inside the presentation frame */}
          <div className="flex h-full w-full flex-col overflow-hidden bg-[#071914]">
            {/* Browser Chrome Header */}
            <div className="flex shrink-0 items-center border-b border-[#173e33] bg-[#0a1b16] px-4 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]/90 shadow-sm" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]/90 shadow-sm" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#27c93f]/90 shadow-sm" />
                <span className="ml-2 font-mono text-[10px] text-white/50">KAINARA spotlight</span>
              </div>
            </div>

            {/* Published image or video */}
            <div className="relative flex-1 overflow-hidden bg-[#071914]">
              <LandingHeroMedia media={initialMedia} />
            </div>
          </div>
        </ContainerScroll>
      </section>
    </>
  );
}

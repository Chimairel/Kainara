'use client';

import Link from 'next/link';

import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';

import Image from 'next/image';

import { SectionWaveBorderLeft, SectionWaveBorderRight } from '@/components/landing/LandingWaveRiver';
import { InfiniteSlider } from '@/components/core/infinite-slider';

import { evidenceSliderSources, leftTrackMaskSvg, rightTrackMaskSvg } from '@/components/landing/landing-content';

export default function LandingSourcesSection() {
  return (
    <>
      <section id="sources" className="border-y border-brand-border/60 bg-brand-surface/30 py-24">
        <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.6 }}
            className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-end"
          >
            <div>
              <h2 className="max-w-xl font-display text-3xl font-black leading-[1.05] tracking-[-0.04em] text-brand-text sm:text-5xl">
                Food data, calculation methods and recipe sources.
              </h2>
            </div>
            <div className="max-w-2xl lg:ml-auto">
              <p className="text-sm leading-7 text-brand-muted sm:text-base">
                Food-composition records support ingredient matching, published methods support energy estimates, and
                recipe links identify the original dish. Available data varies by ingredient and configured source; a
                source citation does not approve a meal for a health condition.
              </p>
              <Link
                href="/docs#data-sources"
                className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Read the complete evidence register <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </motion.div>

          {/* Dark Pine Showcase Track Bounded Organically by Wave Stripes */}
          <div className="relative mt-10 sm:mt-14 [--wave-l:38px] [--wave-r:44px] [--wave-tot:82px] sm:[--wave-l:140px] sm:[--wave-r:160px] sm:[--wave-tot:300px]">
            {/* Left and Right Vertical Wave Borders (z-20) forming the organic left and right ends of the card */}
            <SectionWaveBorderLeft />
            <SectionWaveBorderRight />

            {/* Masked Card Track Body - Terminated precisely at the wave stripes */}
            <div
              className="relative overflow-hidden border-y border-[#173e33] bg-[#071914] dark:bg-[#faf8f5] dark:border-[#dfd7cc] py-4 sm:py-12"
              style={{
                maskImage: `${leftTrackMaskSvg}, linear-gradient(#000, #000), ${rightTrackMaskSvg}`,
                WebkitMaskImage: `${leftTrackMaskSvg}, linear-gradient(#000, #000), ${rightTrackMaskSvg}`,
                maskPosition: 'left top, var(--wave-l) top, right top',
                WebkitMaskPosition: 'left top, var(--wave-l) top, right top',
                maskSize: 'var(--wave-l) 100%, calc(100% - var(--wave-tot)) 100%, var(--wave-r) 100%',
                WebkitMaskSize: 'var(--wave-l) 100%, calc(100% - var(--wave-tot)) 100%, var(--wave-r) 100%',
                maskRepeat: 'no-repeat',
                WebkitMaskRepeat: 'no-repeat',
              }}
            >
              {/* Ambient Glows */}
              <div className="pointer-events-none absolute left-1/4 top-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-emerald-500/10 blur-[100px] dark:opacity-0" />
              <div className="pointer-events-none absolute right-1/4 top-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-brand-cyan/10 blur-[100px] dark:opacity-0" />

              {/* Infinite Looping Slider for Evidence & Recipe Sources */}
              <div className="relative py-1 sm:py-3">
                <InfiniteSlider gap={20} speed={42} speedOnHover={0} reverse>
                  {evidenceSliderSources.map((source, index) => (
                    <a
                      key={`${source.id}-${index}`}
                      href={source.href}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex h-14 sm:h-[136px] items-center gap-2.5 sm:gap-6 rounded-2xl sm:rounded-[28px] border border-[#173e33] bg-[#0e271f]/95 px-3 sm:px-7 py-2 sm:py-4 shadow-md sm:shadow-[0_16px_36px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:border-emerald-500/50 hover:bg-[#0c241d] hover:shadow-[0_24px_50px_rgba(0,0,0,0.6)]"
                      aria-label={`Open citation for ${source.name}`}
                    >
                      <div className="flex h-9 w-9 sm:h-24 sm:w-24 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-white p-1 sm:p-2.5 overflow-hidden transition-transform duration-300 group-hover:scale-105">
                        <Image
                          src={source.logo}
                          alt={source.alt}
                          width={96}
                          height={96}
                          unoptimized
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <div className="flex flex-col pr-1 sm:pr-3">
                        <div className="flex items-center gap-1 sm:gap-1.5">
                          <span className="text-xs sm:text-lg font-bold sm:font-black tracking-tight text-white group-hover:text-emerald-400 transition-colors whitespace-nowrap">
                            {source.name}
                          </span>
                          <ArrowUpRight className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-400/60 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-emerald-400 transition-all" />
                        </div>
                        <span className="mt-0.5 sm:mt-1 font-mono text-[9px] sm:text-[11px] font-medium sm:font-bold uppercase tracking-tight sm:tracking-wider text-white/50 whitespace-nowrap">
                          {source.sub}
                        </span>
                      </div>
                    </a>
                  ))}
                </InfiniteSlider>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

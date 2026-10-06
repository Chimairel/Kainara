'use client';

import Link from 'next/link';

import { motion } from 'motion/react';
import { ArrowDown, ArrowRight, Search } from 'lucide-react';

import KainaraLogo from '@/components/shared/KainaraLogo';

import { rndStages } from '@/components/landing/landing-content';

export default function LandingNutritionistsSection() {
  return (
    <>
      <section
        id="nutritionists"
        className="relative z-20 mx-auto max-w-[1440px] scroll-mt-24 px-5 py-24 sm:px-8 lg:px-12"
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.7 }}
          className="relative overflow-hidden rounded-[36px] bg-[#071914] p-8 text-white shadow-2xl sm:p-12 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:p-16 border border-[#173e33]"
        >
          {/* Retro Wave Organic Corner Accent (Hint of stripe inside card) */}
          <div className="pointer-events-none absolute -top-0.5 -right-0.5 h-48 w-48 sm:h-64 sm:w-64 overflow-hidden rounded-tr-[36px] z-0 opacity-85">
            <svg viewBox="0 0 160 160" className="h-full w-full" fill="none">
              <path d="M160,0 L0,0 C20,40 55,95 120,135 C140,147 160,155 160,155 Z" fill="#eb6a38" />
              <path d="M160,0 L40,0 C55,30 80,72 130,105 C145,115 160,120 160,120 Z" fill="#f09e6c" />
              <path d="M160,0 L82,0 C92,20 110,48 142,70 C152,76 160,80 160,80 Z" className="fill-[#1b4e41]" />
            </svg>
          </div>

          <div className="pointer-events-none absolute left-0 bottom-0 h-80 w-80 rounded-full bg-brand-cyan/10 blur-[120px]" />

          {/* Subtle Watermarked Logo Seal */}
          <div className="pointer-events-none absolute -bottom-6 -right-6 hidden lg:flex items-center justify-center opacity-25">
            <div className="flex h-36 w-36 items-center justify-center rounded-full bg-[#0a201a] border border-[#173e33]/80">
              <KainaraLogo size={90} variant="multicolor" />
            </div>
          </div>

          <div className="relative z-10">
            <h2 className="max-w-2xl font-display text-3xl font-black leading-[1.05] tracking-[-0.04em] sm:text-5xl">
              Review recipes and meal suitability.
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/60 sm:text-base">
              Apply online from anywhere in the Philippines to join KAINARA&apos;s accredited RND review council. Every
              application undergoes license credential screening and direct verification before audit access is granted.
            </p>
            <div className="mt-8 flex flex-col gap-3.5 sm:flex-row">
              <Link
                href="/nutritionist-apply"
                className="inline-flex min-h-[52px] items-center justify-center gap-3 rounded-2xl bg-brand-accent px-7 text-sm font-extrabold text-white shadow-lg transition duration-200 hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98]"
              >
                Apply as an RND <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/nutritionist-apply#track"
                className="group inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-2xl border border-emerald-500/35 bg-emerald-500/15 px-6 text-sm font-bold text-white shadow-md transition duration-200 hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-500/25 active:scale-[0.98]"
              >
                <Search className="h-4 w-4 text-emerald-400 transition-transform group-hover:scale-110" />
                Track Application Status
                <ArrowRight className="h-4 w-4 text-emerald-400/70 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-400" />
              </Link>
            </div>
          </div>

          <div className="relative z-10 mt-10 grid gap-px overflow-hidden rounded-[28px] border border-[#173e33] bg-[#173e33]/60 lg:mt-0">
            {rndStages.map(({ icon: Icon, title, text, bg, stepColor, accentDot }, index) => (
              <div
                key={title}
                className="group relative bg-[#091b15] p-5 sm:p-6 transition duration-300 hover:bg-[#0c241d]"
              >
                <div className="flex items-start gap-4 sm:gap-5">
                  <span
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-transform duration-300 group-hover:scale-110 ${bg}`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`font-mono text-[10px] font-bold uppercase tracking-[0.2em] ${stepColor}`}>
                        Step 0{index + 1}
                      </span>
                      <span className={`h-2 w-2 rounded-full ${accentDot}`} />
                    </div>
                    <h3 className="mt-1.5 font-display text-base font-bold text-white">{title}</h3>
                    <p className="mt-1 text-xs leading-5 text-white/55">{text}</p>
                  </div>
                </div>
                {index < 2 && (
                  <ArrowDown className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-20 h-5 w-5 text-white/30 transition-colors group-hover:text-white/70" />
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </section>
    </>
  );
}

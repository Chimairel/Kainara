'use client';

import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';

import { SectionWaveBorderTop, SectionWaveBorderBottom } from '@/components/landing/LandingWaveRiver';

import { loopSteps } from '@/components/landing/landing-content';

export default function LandingProcessSection() {
  return (
    <>
      <div id="process" className="relative z-10 scroll-mt-20">
        {/* Upper Wave Border: Replaces straight horizontal border */}
        <SectionWaveBorderTop />

        {/* Dark Pine Section Body */}
        <section className="relative bg-[#071914] py-14 sm:py-20 text-white">
          <div className="pointer-events-none absolute -left-20 top-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-emerald-500/10 blur-[120px]" />
          <div className="pointer-events-none absolute -right-20 top-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-brand-cyan/10 blur-[120px]" />

          <div className="relative z-10 mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.6 }}
              className="mx-auto max-w-2xl text-center"
            >
              <h2 className="font-display text-3xl font-black tracking-[-0.04em] sm:text-5xl">
                From your profile to a meal plan.
              </h2>
              <p className="mt-4 text-sm sm:text-base text-white/60">
                Profile context, recorded recipes, AI assistance and applicable review requirements guide meal
                selection.
              </p>
            </motion.div>

            <div className="mt-16 grid gap-px overflow-hidden rounded-[28px] border border-[#173e33] bg-[#173e33]/60 md:grid-cols-4">
              {loopSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <motion.article
                    key={step.title}
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ duration: 0.5, delay: index * 0.12 }}
                    className="group relative bg-[#091b15] p-7 md:min-h-[300px] hover:bg-[#0c241d] transition duration-300"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-mono text-[10px] font-bold uppercase tracking-[0.2em] ${step.phaseLabel}`}>
                        Phase 0{index + 1}
                      </span>
                      <span className={`h-2 w-2 rounded-full ${step.accentDot}`} />
                    </div>
                    <div
                      className={`mt-7 flex h-12 w-12 items-center justify-center rounded-2xl border transition-transform duration-300 group-hover:scale-110 ${step.bg}`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-6 font-display text-lg font-bold text-white">{step.title}</h3>
                    <p className="mt-2.5 text-xs leading-5 text-white/55">{step.text}</p>
                    {index < 3 && (
                      <ArrowRight className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 hidden h-5 w-5 text-white/30 md:block transition-colors group-hover:text-white/70" />
                    )}
                  </motion.article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Lower Wave Border: Replaces straight bottom border */}
        <SectionWaveBorderBottom />
      </div>
    </>
  );
}

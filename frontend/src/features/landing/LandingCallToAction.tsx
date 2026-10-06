'use client';

import Link from 'next/link';

import { motion } from 'motion/react';
import { ArrowRight } from 'lucide-react';

import type { useLandingHomeModel } from './useLandingHomeModel';
type Model = Extract<ReturnType<typeof useLandingHomeModel>, { kind: 'ready' }>;
type SectionProps = { model: Pick<Model, 'workspaceHref'> };
export default function LandingCallToAction({ model }: SectionProps) {
  const { workspaceHref } = model;

  return (
    <>
      <section className="relative z-20 px-5 pb-24 sm:px-8 lg:px-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 30 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.7 }}
          className="relative mx-auto max-w-[1344px] overflow-hidden rounded-[36px] bg-gradient-to-r from-brand-accent via-[#ed7847] to-[#eb6a38] px-7 py-14 text-white shadow-2xl sm:px-12 lg:flex lg:items-center lg:justify-between lg:px-16"
        >
          <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full border-[50px] border-white/10" />
          <div className="pointer-events-none absolute left-1/3 -bottom-16 h-60 w-60 rounded-full bg-white/5 blur-2xl" />
          <div className="relative">
            <h2 className="max-w-2xl font-display text-3xl font-black tracking-[-0.04em] sm:text-4xl text-white">
              A smarter weekly plan starts with understanding you.
            </h2>
            <p className="mt-2 text-sm text-white/80 max-w-xl">
              Join KAINARA for personalized Filipino meal planning, with nutritionist review for applicable cases.
            </p>
          </div>
          <Link
            href={workspaceHref}
            className="relative mt-8 inline-flex min-h-[54px] items-center gap-3 rounded-2xl bg-[#071914] px-8 text-sm font-black text-white shadow-xl transition hover:-translate-y-1 hover:brightness-110 active:scale-[0.98] lg:mt-0"
          >
            Start Onboarding
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </section>
    </>
  );
}

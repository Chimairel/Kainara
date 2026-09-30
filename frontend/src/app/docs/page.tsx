import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import PublicHeader from '@/components/shared/PublicHeader';
import PublicFooter from '@/components/shared/PublicFooter';
import { DocsWaveHero } from '@/components/landing/LandingWaveRiver';
import DocsWorkspace from './DocsWorkspace';

export const metadata: Metadata = {
  title: 'Documentation & User Guide | KAINARA',
  description: 'How KAINARA works, clinical guidelines, terms of service, and privacy information.',
};

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-brand-bg text-brand-text selection:bg-brand-accent selection:text-white">
      <PublicHeader />

      <main className="overflow-x-clip">
        {/* HERO SECTION WITH FLUID SIGNATURE WAVE STRIPE */}
        <section className="relative overflow-hidden pt-8 pb-16 md:pt-12 md:pb-24 border-b border-brand-border/60">
          <DocsWaveHero />

          {/* Ambient Glow Mesh */}
          <div className="pointer-events-none absolute left-[5%] top-10 h-96 w-96 rounded-full bg-emerald-500/15 blur-[130px] dark:bg-emerald-500/10" />
          <div className="pointer-events-none absolute right-[5%] top-16 h-96 w-96 rounded-full bg-brand-cyan/15 blur-[140px] dark:bg-brand-cyan/10" />
          <div className="pointer-events-none absolute left-1/3 top-1/2 -translate-x-1/2 h-80 w-80 rounded-full bg-brand-accent/10 blur-[150px] dark:bg-brand-accent/5" />

          <div className="relative mx-auto max-w-[1344px] px-5 sm:px-8 lg:px-12">
            {/* Back to Home Link */}
            <Link
              href="/"
              className="group mb-8 inline-flex items-center gap-2 rounded-xl border border-brand-border/80 bg-brand-surface/70 px-4 py-2 text-xs font-bold text-brand-muted backdrop-blur-md transition-all hover:border-emerald-500/40 hover:bg-brand-surface hover:text-emerald-600 dark:hover:text-emerald-400 hover:shadow-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1 text-emerald-500" />
              Back to Home
            </Link>

            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.55fr] lg:items-end">
              <div>
                <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-400 backdrop-blur-md mb-6">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  <span className="tracking-wide">Official Documentation & User Guide</span>
                </div>

                <h1 className="font-display text-[clamp(2.8rem,5.5vw,5.5rem)] font-black leading-[0.95] tracking-[-0.05em] text-brand-text">
                  The complete guide to <span className="text-gradient block pb-1 sm:inline sm:pb-0">KAINARA.</span>
                </h1>
              </div>

              <div className="relative z-10 rounded-[28px] border border-brand-border/80 bg-brand-surface/90 p-6 sm:p-7 shadow-xl shadow-emerald-950/5 backdrop-blur-xl lg:mb-2">
                <p className="text-sm leading-7 text-brand-muted">
                  Learn how meals are planned and reviewed, what clinical safeguards are enforced, and how evidence-backed calculations power every recommendation.
                </p>
                <div className="mt-5 inline-flex items-center gap-2.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-800 dark:text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Updated September 30, 2026
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* WORKSPACE CONTENT */}
        <DocsWorkspace />
      </main>

      {/* SIGNATURE 3-TONE WAVE FOOTER */}
      <PublicFooter />
    </div>
  );
}

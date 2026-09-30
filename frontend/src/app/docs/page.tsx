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
        <section className="relative overflow-hidden pt-8 pb-14 md:pt-12 md:pb-20 border-b border-brand-border/60">
          <DocsWaveHero />

          {/* Ambient Glow Mesh */}
          <div className="pointer-events-none absolute left-[5%] top-10 h-96 w-96 rounded-full bg-emerald-500/15 blur-[130px] dark:bg-emerald-500/10" />
          <div className="pointer-events-none absolute right-[5%] top-16 h-96 w-96 rounded-full bg-brand-cyan/15 blur-[140px] dark:bg-brand-cyan/10" />
          <div className="pointer-events-none absolute left-1/3 top-1/2 -translate-x-1/2 h-80 w-80 rounded-full bg-brand-accent/10 blur-[150px] dark:bg-brand-accent/5" />

          <div className="relative mx-auto max-w-[1344px] px-5 sm:px-8 lg:px-12">
            {/* Back to Home floating text link (not a capsule) */}
            <Link
              href="/"
              className="group mb-8 inline-flex items-center gap-2 text-xs font-bold text-brand-muted transition-colors hover:text-emerald-600 dark:hover:text-emerald-400"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1 text-emerald-500" />
              Back to Home
            </Link>

            {/* Clean headline without pill or right-side summary card */}
            <div className="max-w-4xl">
              <h1 className="font-display text-[clamp(2.8rem,5.8vw,6.5rem)] font-black leading-[0.95] tracking-[-0.05em] text-brand-text">
                The complete guide to <span className="text-gradient block pb-1 sm:inline sm:pb-0">KAINARA.</span>
              </h1>
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

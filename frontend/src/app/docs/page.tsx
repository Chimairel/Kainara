import { publicPageMetadata } from '@/lib/seo';
import Link from 'next/link';
import { ArrowLeft } from '@/components/ui/icons';
import PublicHeader from '@/components/shared/PublicHeader';
import PublicFooter from '@/components/shared/PublicFooter';
import { DocsWaveHero } from '@/components/landing/LandingWaveRiver';
import DocsWorkspace from './DocsWorkspace';
import DocsSearch, { DocsSearchProvider } from './DocsSearch';

export const metadata = publicPageMetadata('/docs');

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-brand-bg text-brand-text selection:bg-brand-accent selection:text-white">
      <PublicHeader />

      <DocsSearchProvider><main className="overflow-x-clip">
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
              <h1 className="font-display text-4xl font-black leading-[1.05] tracking-tight text-brand-text sm:text-6xl">Your Kainara guide.</h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-brand-muted">Learn how your meals, food records, and review steps work. Search the guide, browse FAQs, or ask for support.</p>
              <DocsSearch />
            </div>
          </div>
        </section>

        {/* WORKSPACE CONTENT */}
        <DocsWorkspace />
      </main></DocsSearchProvider>

      {/* SIGNATURE 3-TONE WAVE FOOTER */}
      <PublicFooter />
    </div>
  );
}

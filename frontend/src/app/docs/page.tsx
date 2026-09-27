import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, BookOpen } from 'lucide-react';
import PublicHeader from '@/components/shared/PublicHeader';
import DocsWorkspace from './DocsWorkspace';

export const metadata: Metadata = {
  title: 'Documentation & User Guide | KAINARA',
  description: 'How KAINARA works, clinical guidelines, terms of service, and privacy information.',
};

export default function DocsPage() {
  return (
    <div className="min-h-screen text-brand-text">
      <PublicHeader />

      <main>
        <section className="relative overflow-hidden border-b border-brand-border/60">
          <div className="pointer-events-none absolute inset-0 futuristic-grid opacity-50" />
          <div className="pointer-events-none absolute left-[12%] top-10 h-72 w-72 rounded-full bg-brand-accent/10 blur-[110px]" />
          <div className="pointer-events-none absolute right-[8%] top-20 h-72 w-72 rounded-full bg-brand-cyan/10 blur-[110px]" />
          <div className="relative mx-auto max-w-[1320px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
            <Link href="/" className="mb-10 inline-flex items-center gap-2 text-xs font-bold text-brand-muted transition hover:text-brand-green">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to experience
            </Link>
            <div className="grid gap-12 lg:grid-cols-[1fr_0.55fr] lg:items-end">
              <div>
                <div className="eyebrow inline-flex items-center gap-2">
                  <BookOpen className="h-3.5 w-3.5 text-brand-accent" />
                  Official Product Documentation & User Guide
                </div>
                <h1 className="mt-6 max-w-4xl font-display text-[clamp(3.2rem,7vw,7rem)] font-black leading-[0.9] tracking-[-0.065em]">
                  The complete guide to <span className="text-gradient">KAINARA.</span>
                </h1>
              </div>
              <div className="border-l border-brand-border/70 pl-6">
                <p className="text-sm leading-7 text-brand-muted">
                  Learn how meals are prepared and reviewed, what the service can and cannot do, and how your information is handled.
                </p>
                <div className="mt-5 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.15em] text-brand-muted">
                  <span className="h-2 w-2 rounded-full bg-brand-green" />
                  Updated September 27, 2026
                </div>
              </div>
            </div>
          </div>
        </section>

        <DocsWorkspace />
      </main>

      <footer className="border-t border-brand-border/70">
        <div className="mx-auto flex max-w-[1320px] flex-col gap-3 px-5 py-8 text-xs text-brand-muted sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <p className="font-display font-bold text-brand-text">KAINARA documentation & help center</p>
          <p>Planning guidance with clear evidence and review limits.</p>
        </div>
      </footer>
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import PublicHeader from '@/components/shared/PublicHeader';
import PublicFooter from '@/components/shared/PublicFooter';
import SupportContact from '@/components/shared/SupportContact';
import { DocsWaveHero } from '@/components/landing/LandingWaveRiver';
import { ArrowLeft } from '@/components/ui/icons';

export const metadata: Metadata = { title: 'Contact Support | Kainara', robots: { index: false, follow: true } };

export default function HelpPage() {
  return <div className="min-h-screen bg-brand-bg text-brand-text">
    <PublicHeader />
    <main>
      <section className="relative overflow-hidden border-b border-brand-border/60 pb-14 pt-8 md:pb-20 md:pt-12">
        <div className="pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent_85%,black_100%)] sm:[mask-image:none]">
          <DocsWaveHero />
        </div>
        <div className="relative mx-auto max-w-[1344px] px-5 sm:px-8 lg:px-12">
          <Link href="/docs" className="mb-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-muted hover:text-brand-green">
            <ArrowLeft className="h-4 w-4" /> Back to the guide
          </Link>
          <h1 className="font-display text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">Contact Support</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-brand-muted">Questions, feedback, or something not working? Tell us what happened so we can help you find the next step.</p>
        </div>
      </section>
      <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
        <SupportContact />
      </div>
    </main>
    <PublicFooter />
  </div>;
}

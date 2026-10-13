import type { Metadata } from 'next';
import Link from 'next/link';
import PublicHeader from '@/components/shared/PublicHeader';
import PublicFooter from '@/components/shared/PublicFooter';
import SupportContact from '@/components/shared/SupportContact';

export const metadata: Metadata = { title: 'Contact Support | Kainara', robots: { index: false, follow: true } };

export default function HelpPage() {
  return <div className="min-h-screen bg-brand-bg text-brand-text">
    <PublicHeader />
    <main className="mx-auto max-w-[1344px] px-5 pb-16 pt-32 sm:px-8 lg:px-12 lg:pb-24">
      <Link href="/docs" className="inline-flex min-h-11 items-center font-semibold text-brand-green underline underline-offset-4">Back to the guide</Link>
      <h1 className="mb-10 mt-5 font-display text-4xl font-black tracking-tight sm:text-6xl">Contact Support</h1>
      <SupportContact />
    </main>
    <PublicFooter />
  </div>;
}

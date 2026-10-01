'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useMembership } from './MembershipProvider';
import { TrendingUp, Sparkles, ArrowRight, FileText } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function MembershipGate({ children, benefit }: { children: ReactNode; benefit: string }) {
  const { data, isLoading, error, refresh } = useMembership();

  if (isLoading && !data)
    return (
      <p role="status" className="portal-page max-w-4xl mx-auto py-12 text-center text-sm text-brand-muted">
        Checking membership…
      </p>
    );

  if (error && !data)
    return (
      <div className="portal-page max-w-4xl mx-auto py-8">
        <div className="rounded-2xl border border-status-error-text/30 bg-status-error-bg/20 p-5 text-status-error-text">
          <p role="alert" className="text-sm font-semibold">{error}</p>
          <Button onClick={refresh} variant="secondary" className="mt-4 text-xs">
            Retry
          </Button>
        </div>
      </div>
    );

  if (data?.enabled && !data.enhanced) {
    const isProgress = benefit.toLowerCase().includes('progress');
    const title = isProgress ? 'Follow your progress with membership' : `${benefit} is a membership benefit`;
    const description = isProgress
      ? 'Membership includes progress insights, weight tracking and adaptive check-ins.'
      : 'Membership adds optional planning changes, progress insights and case review when required.';

    return (
      <section className="portal-page max-w-3xl mx-auto py-8">
        <div className="rounded-3xl border border-brand-border/80 bg-brand-surface p-6 sm:p-8 shadow-sm text-center sm:text-left">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green mb-4">
            {isProgress ? <TrendingUp className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-brand-text">{title}</h1>
          <p className="mt-2 text-sm text-brand-muted">{description}</p>
          <p className="mt-3 text-xs leading-relaxed text-brand-muted/90 rounded-2xl bg-brand-bgAlt/50 border border-brand-border/60 p-3.5">
            {data.requiresCaseReview
              ? 'Existing eligible active meals, saved records, manual logging and health safety updates remain available. New case plans require membership.'
              : 'Your free general meal plans, saved records, manual meal logging and health safety updates remain available.'}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center sm:justify-start gap-4">
            <Link
              href="/membership"
              className="inline-flex items-center gap-1.5 rounded-2xl bg-brand-green px-5 py-2.5 text-xs font-bold text-white shadow-neon transition hover:bg-brand-green/90 dark:bg-brand-accent dark:text-[#07100d]"
            >
              <span>View membership</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/export"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-green hover:underline"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Access your saved records</span>
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return <>{children}</>;
}

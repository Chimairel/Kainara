'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useMembership } from './MembershipProvider';

export default function MembershipGate({ children, benefit }: { children: ReactNode; benefit: string }) {
  const { data, isLoading, error, refresh } = useMembership();
  if (isLoading && !data)
    return (
      <p role="status" className="portal-page">
        Checking membership…
      </p>
    );
  if (error && !data)
    return (
      <div className="portal-page">
        <p role="alert">{error}</p>
        <button onClick={refresh} className="mt-3 font-bold text-brand-green">
          Retry
        </button>
      </div>
    );
  if (data?.enabled && !data.enhanced)
    return (
      <section className="portal-page">
        <div className="rounded-2xl border border-brand-border bg-brand-surface p-6">
          <h1 className="font-display text-2xl font-bold">{benefit} is a membership benefit</h1>
          <p className="mt-3 text-sm text-brand-muted">
            {data.requiresCaseReview
              ? 'Existing eligible active meals, saved records, manual logging and health safety updates remain available. New case plans require membership.'
              : 'Your free general meal plans, saved records, manual meal logging and health safety updates remain available.'}
          </p>
          <Link href="/membership" className="mt-4 inline-block font-bold text-brand-green">
            View membership →
          </Link>
          <Link href="/export" className="ml-5 inline-block text-sm text-brand-green">
            Access your saved records
          </Link>
        </div>
      </section>
    );
  return children;
}

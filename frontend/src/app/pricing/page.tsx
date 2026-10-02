'use client';

import React from 'react';
import PublicHeader from '@/components/shared/PublicHeader';
import PublicFooter from '@/components/shared/PublicFooter';
import Pricing from '@/components/ui/pricing';
import { MembershipProvider, useMembership } from '@/features/membership/MembershipProvider';

function PricingContent() {
  const { data } = useMembership();
  const currentTier = data?.enabled ? (data.tier ?? (data.enhanced ? 'HEALTH' : 'FREE')) : undefined;
  const currentLevel = data?.enabled ? data.level : null;
  const limits = data?.enabled ? data.limits : undefined;

  return (
    <div className="relative min-h-screen bg-brand-bg text-brand-text selection:bg-brand-accent selection:text-white flex flex-col justify-between">
      <PublicHeader />
      <main className="flex-1 py-8 sm:py-12">
        <Pricing currentTier={currentTier} currentLevel={currentLevel} limits={limits} isFullScreenModal={false} />
      </main>
      <PublicFooter />
    </div>
  );
}

export default function PricingPage() {
  return (
    <MembershipProvider>
      <PricingContent />
    </MembershipProvider>
  );
}

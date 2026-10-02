'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import Button from '@/components/ui/Button';
import { useMembership } from '@/features/membership/MembershipProvider';
import Pricing from '@/components/ui/pricing';
import MembershipPlanHeader from '@/features/membership/MembershipPlanHeader';
import PlanStatisticsCard from '@/features/membership/PlanStatisticsCard';
import PlanCalendarCard from '@/features/membership/PlanCalendarCard';
import { RefreshCw, AlertTriangle, Layers, CreditCard, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { isCheckoutUrl } from '@/features/membership/checkout';
import api from '@/lib/axios';

function MembershipContent() {
  const { data, isLoading, error, refresh } = useMembership();
  const [isPlansModalOpen, setIsPlansModalOpen] = useState(false);
  const [closingCheckout, setClosingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const router = useRouter();
  const plansRequested = searchParams.get('tab') === 'plans' || searchParams.get('plans') === 'true';

  useEffect(() => {
    if (plansRequested) setIsPlansModalOpen(true);
  }, [plansRequested]);

  if (isLoading && !data)
    return (
      <div className="portal-page max-w-6xl mx-auto py-16 text-center" role="status">
        <div className="inline-flex flex-col items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-brand-green/10 text-brand-green flex items-center justify-center animate-spin">
            <RefreshCw className="h-4 w-4" />
          </div>
          <span className="text-xs text-brand-muted">Loading membership…</span>
        </div>
      </div>
    );

  if (error && !data)
    return (
      <div className="portal-page max-w-6xl mx-auto py-8">
        <div className="rounded-2xl border border-status-error-text/30 bg-status-error-bg/20 p-5 text-status-error-text shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <h3 className="font-display text-sm font-bold">Could not load membership</h3>
          </div>
          <p role="alert" className="mt-1 text-xs text-status-error-text/90">
            {error}
          </p>
          <Button onClick={refresh} variant="secondary" className="mt-3 text-xs font-semibold px-3 py-1.5">
            Retry
          </Button>
        </div>
      </div>
    );

  const fallbackLimits = {
    freeSwaps: 3,
    freeEstimates: 2,
    memberSwaps: 6,
    memberEstimates: 10,
    memberReplans: 2,
    memberPlanReviews: 1,
    memberOutsideReviews: 1,
  };

  const limits = data?.enabled && data.limits ? data.limits : fallbackLimits;
  const currentLevel = data?.enabled ? data.level : null;

  // Open checkout handling
  const openCheckout = data?.enabled ? data.transitions?.openCheckout : null;
  const isQuoteExpired = Boolean(openCheckout?.quoteExpiresAt && new Date(openCheckout.quoteExpiresAt) <= new Date());

  const handleCloseCheckout = async () => {
    if (!openCheckout || closingCheckout) return;
    setClosingCheckout(true);
    setCheckoutError(null);
    try {
      await api.post(`/user/membership/checkout/${encodeURIComponent(openCheckout.id)}/close`, {});
      refresh();
    } catch (err) {
      setCheckoutError(
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
          'Checkout could not be closed. Please try again.'
      );
    } finally {
      setClosingCheckout(false);
    }
  };

  return (
    <div className="portal-page mx-auto max-w-6xl space-y-6 pb-28">
      {/* 1. PORTAL PAGE HEADER */}
      <PortalPageHeader
        title="KAINARA membership"
        description="Keep your weekly meals practical. Membership adds adaptation, progress insights and professional review when required."
        actions={
          <Button
            onClick={() => setIsPlansModalOpen(true)}
            variant="secondary"
            className="inline-flex items-center gap-2 text-xs font-bold px-3.5 py-2 border-brand-border bg-brand-surface hover:bg-brand-bg-alt text-brand-text shadow-xs"
          >
            <Layers className="h-4 w-4 text-brand-green" />
            <span>View plans</span>
          </Button>
        }
      />

      {/* 2. ROLLOUT NOTICE (if membership is disabled) */}
      {!data?.enabled && (
        <section className="rounded-2xl border border-brand-border bg-brand-surface p-5 sm:p-6 shadow-xs space-y-2">
          <h2 className="font-display text-base font-bold text-brand-text">
            Membership is being prepared. Your current access has not changed.
          </h2>
          <p className="text-xs leading-relaxed text-brand-muted max-w-2xl">
            Membership restrictions are currently disabled. Normal clinical clearance and safety requirements still
            apply. Purchases remain unavailable.
          </p>
        </section>
      )}

      {/* 3. OPEN CHECKOUT BANNER (if an unpaid checkout is in progress) */}
      {openCheckout && (
        <section
          aria-label="Pending checkout reminder"
          className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5 text-amber-900 dark:text-amber-200 shadow-xs space-y-2.5"
        >
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-brand-accent shrink-0" />
            <h3 className="font-display text-sm font-bold">
              A {openCheckout.tier === 'HEALTH' ? 'Health' : 'Lifestyle'} checkout is currently open
            </h3>
          </div>
          {isQuoteExpired && (
            <p className="text-xs text-status-pending-text">
              The payment summary expired. Close the unpaid checkout and review a fresh summary before paying.
            </p>
          )}
          <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
            Finish or close this unpaid session before starting another plan upgrade.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {!isQuoteExpired && openCheckout.checkoutUrl && isCheckoutUrl(openCheckout.checkoutUrl) && (
              <a
                href={openCheckout.checkoutUrl}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-green hover:underline"
              >
                <span>Resume checkout</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <Button
              variant="secondary"
              onClick={handleCloseCheckout}
              isLoading={closingCheckout}
              className="text-xs px-3 py-1.5"
            >
              Close unpaid checkout
            </Button>
            <Link
              href={`/membership/checkout?purchase=${encodeURIComponent(openCheckout.id)}`}
              className="text-xs text-brand-muted hover:text-brand-text underline"
            >
              Check payment status
            </Link>
          </div>
          {checkoutError && (
            <p role="alert" className="text-xs text-status-error-text">
              {checkoutError}
            </p>
          )}
        </section>
      )}

      {/* 4. CURRENT PLAN HEADER (Header at top telling user's current plan) */}
      {data?.enabled && (
        <MembershipPlanHeader
          data={data}
          onOpenPlans={() => setIsPlansModalOpen(true)}
          onRefresh={refresh}
        />
      )}

      {/* 5. TWO SECTIONS: PLAN STATISTICS (IMG 3-5) & PLAN CALENDAR (IMG 2) */}
      {data?.enabled && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* Left section: Allowances & Usage Statistics with peeking max numbers and pill bars */}
          <PlanStatisticsCard
            data={data}
            onOpenPlans={() => setIsPlansModalOpen(true)}
          />

          {/* Right section: Plan Schedule Calendar adapted from meeting-scheduler */}
          <PlanCalendarCard data={data} />
        </div>
      )}

      {/* 6. FULL-SCREEN PRICING MODAL (ChatGPT style with 'X' button on upper right) */}
      {isPlansModalOpen ? (
        <Pricing
          currentTier={data?.enabled ? (data.tier ?? (data.enhanced ? 'HEALTH' : 'FREE')) : 'FREE'}
          currentLevel={currentLevel}
          limits={limits}
          isFullScreenModal={true}
          isOpen={isPlansModalOpen}
          onClose={() => {
            setIsPlansModalOpen(false);
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href);
              url.searchParams.delete('tab');
              url.searchParams.delete('plans');
              router.replace(url.pathname + url.search, { scroll: false });
            }
          }}
        />
      ) : null}
    </div>
  );
}

export default function MembershipPage() {
  return (
    <Suspense
      fallback={
        <p className="portal-page" role="status">
          Loading membership…
        </p>
      }
    >
      <MembershipContent />
    </Suspense>
  );
}

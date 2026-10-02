'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { TimelineContent } from '@/components/ui/timeline-animation';
import { VerticalCutReveal } from '@/components/ui/vertical-cut-reveal';
import { cn } from '@/lib/utils';
import NumberFlow from '@number-flow/react';
import { CheckCheck, X } from 'lucide-react';
import { motion, type Variants } from 'motion/react';
import type { MembershipView } from '@/features/membership/MembershipProvider';
import { useMembershipCheckout } from '@/features/membership/useMembershipCheckout';
import { checkoutSelectionKey, displayPrices, pendingMembershipSelection } from '@/features/membership/checkout';
import api from '@/lib/axios';
import MembershipTimeline, { membershipDate, membershipMoney } from '@/features/membership/MembershipTimeline';
import Button from '@/components/ui/Button';

export interface PricingProps {
  currentLevel?: 'FREE' | 'TRIAL_PENDING' | 'TRIAL' | 'MEMBER' | null;
  currentTier?: 'FREE' | 'LIFESTYLE' | 'HEALTH';
  limits?: Extract<MembershipView, { enabled: true }>['limits'];
  onClose?: () => void;
  isFullScreenModal?: boolean;
  isOpen?: boolean;
}

const PricingSwitch = ({
  onSwitch,
  className,
  selected,
}: {
  onSwitch: (value: string) => void;
  className?: string;
  selected: string;
}) => {
  const switchId = useId();

  return (
    <div className={cn('flex justify-center', className)}>
      <div className="relative z-10 flex w-fit rounded-xl p-1 bg-brand-bg-alt border border-brand-border shadow-xs">
        <button
          type="button"
          onClick={() => onSwitch('0')}
          aria-pressed={selected === '0'}
          className={cn(
            'relative z-10 w-fit cursor-pointer h-11 rounded-xl sm:px-6 px-3.5 sm:py-2 py-1 font-semibold transition-colors sm:text-sm text-xs',
            selected === '0' ? 'text-white' : 'text-brand-muted hover:text-brand-text'
          )}
        >
          {selected === '0' && (
            <motion.span
              layoutId={switchId}
              className="absolute top-0 left-0 h-11 w-full rounded-xl border border-brand-accent-soft/40 bg-brand-accent shadow-neon"
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative">Monthly Billing</span>
        </button>

        <button
          type="button"
          onClick={() => onSwitch('1')}
          aria-pressed={selected === '1'}
          className={cn(
            'relative z-10 w-fit cursor-pointer h-11 flex-shrink-0 rounded-xl sm:px-6 px-3.5 sm:py-2 py-1 font-semibold transition-colors sm:text-sm text-xs',
            selected === '1' ? 'text-white' : 'text-brand-muted hover:text-brand-text'
          )}
        >
          {selected === '1' && (
            <motion.span
              layoutId={switchId}
              className="absolute top-0 left-0 h-11 w-full rounded-xl border border-brand-accent-soft/40 bg-brand-accent shadow-neon"
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative flex items-center gap-1.5 sm:gap-2">
            <span>Yearly Billing</span>
            <span className="rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-bold bg-brand-accent/15 border border-brand-accent/30 text-brand-accent dark:text-brand-accent-soft">
              Save 20%
            </span>
          </span>
        </button>
      </div>
    </div>
  );
};

export default function Pricing({
  currentLevel,
  currentTier,
  limits,
  onClose,
  isFullScreenModal = false,
  isOpen = true,
}: PricingProps) {
  const [isYearly, setIsYearly] = useState(false);
  const [prices, setPrices] = useState(displayPrices);
  const [returnFocus] = useState(() =>
    typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null)
  );
  const checkout = useMembershipCheckout();
  const summaryRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (checkout.quote) summaryRef.current?.focus();
  }, [checkout.quote]);
  const transitions = checkout.membership?.enabled ? checkout.membership.transitions : null;
  const purchaseBlocked = Boolean(transitions?.blockedReason || transitions?.openCheckout);
  const buttonLabel = (tier: 'LIFESTYLE' | 'HEALTH') => {
    if (transitions?.scheduled.length)
      return transitions.scheduled.some((p) => p.tier === tier) ? 'Next plan scheduled' : 'Next plan already scheduled';
    if (transitions?.blockedReason) return 'Checkout unavailable';
    if (transitions?.openCheckout) return 'Finish existing checkout';
    if (currentLevel === 'MEMBER' && currentTier === tier) return `Renew ${tier === 'HEALTH' ? 'Health' : 'Lifestyle'}`;
    if (currentLevel === 'MEMBER' && currentTier === 'HEALTH') return 'Switch to Lifestyle';
    if (currentLevel === 'MEMBER' && currentTier === 'LIFESTYLE') return 'Upgrade to Health';
    return `Get ${tier === 'HEALTH' ? 'Health' : 'Lifestyle'}`;
  };
  const pricingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const selected = pendingMembershipSelection();
    const period = new URLSearchParams(window.location.search).get('period');
    setIsYearly((period ?? selected?.period) === 'YEARLY');
    if (selected && isFullScreenModal) {
      try {
        sessionStorage.removeItem(checkoutSelectionKey);
      } catch {
        /* Storage is optional. */
      }
    }
    const controller = new AbortController();
    void api
      .get('/membership/plans', { signal: controller.signal })
      .then((response) => {
        const p = response.data.data?.prices;
        if (
          p &&
          ['LIFESTYLE', 'HEALTH'].every((tier) =>
            ['MONTHLY', 'YEARLY'].every((period) => Number.isSafeInteger(p[tier]?.[period]) && p[tier][period] > 0)
          )
        )
          setPrices(p);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [isFullScreenModal]);

  const l = limits ?? {
    freeSwaps: 3,
    freeEstimates: 2,
    memberSwaps: 6,
    memberEstimates: 10,
    memberReplans: 2,
    memberPlanReviews: 1,
    memberOutsideReviews: 1,
  };

  const plans = [
    {
      tier: 'FREE' as const,
      name: 'Free',
      description: 'General meal planning with your saved planning context.',
      price: 0,
      yearlyPrice: 0,
      popular: false,
      buttonText: currentTier === 'FREE' ? 'Current plan' : checkout.user ? 'Free access continues' : 'Get Free',
      featuresHeading: 'Free includes:',
      features: [
        'General plans without declared conditions or allergies',
        'Save profile updates and correct mistakes',
        'Free first report and unchanged weekly report activation',
        `${l.freeSwaps} meal swaps per cycle`,
        `${l.freeEstimates} AI estimates per Manila week`,
        'Groceries, manual food logging and saved records',
      ],
    },
    {
      tier: 'LIFESTYLE' as const,
      name: 'Lifestyle',
      description: 'Adapt your everyday planning as your goals and routine change.',
      price: prices.LIFESTYLE.MONTHLY / 100,
      yearlyPrice: prices.LIFESTYLE.YEARLY / 100,
      popular: true,
      buttonText: buttonLabel('LIFESTYLE'),
      featuresHeading: 'Everything in Free, plus:',
      features: [
        'Apply changes to biometrics, activity, goals and food preferences',
        'Apply shopping-day changes through your nutrition report',
        'Progress insights and adaptive weekly check-ins',
        `${l.memberSwaps} meal swaps per cycle`,
        `${l.memberEstimates} AI estimates per Manila week`,
        `${l.memberReplans} optional replans per Manila week`,
      ],
    },
    {
      tier: 'HEALTH' as const,
      name: 'Health',
      description: 'Case planning and bounded nutritionist review for declared health needs.',
      price: prices.HEALTH.MONTHLY / 100,
      yearlyPrice: prices.HEALTH.YEARLY / 100,
      popular: false,
      buttonText: buttonLabel('HEALTH'),
      featuresHeading: 'Everything in Lifestyle, plus:',
      features: [
        'Apply changes to conditions, allergies and health restrictions',
        'New case plans subject to required clearance',
        `${l.memberPlanReviews} case plan-review episode per target week`,
        `${l.memberOutsideReviews} requested outside-meal review episode per Manila week`,
        'Follow-up on an existing admitted review',
      ],
    },
  ];

  const revealVariants: Variants = {
    visible: (i: number) => ({
      y: 0,
      opacity: 1,
      transition: {
        delay: i * 0.08,
        duration: 0.35,
        ease: 'easeOut' as const,
      },
    }),
    hidden: {
      y: 16,
      opacity: 0,
    },
  };

  const togglePricingPeriod = (value: string) => setIsYearly(Number.parseInt(value, 10) === 1);

  const modalBody = (
    <div
      className={cn(
        isFullScreenModal
          ? 'fixed inset-0 z-[100] overflow-y-auto bg-brand-bg/95 text-brand-text backdrop-blur-2xl p-4 sm:p-6 md:p-10 flex flex-col items-center justify-start pb-24'
          : 'px-4 pt-4 pb-12 max-w-7xl mx-auto relative text-brand-text',
        !isOpen && isFullScreenModal && 'hidden'
      )}
      ref={pricingRef}
      role={isFullScreenModal ? 'dialog' : 'region'}
      aria-label={isFullScreenModal ? undefined : 'Membership plans'}
    >
      {isFullScreenModal && (
        <>
          <Dialog.Title className="sr-only">Membership plans</Dialog.Title>
          <Dialog.Description className="sr-only">
            Compare Free, Lifestyle and Health. Choose a billing period to open PayMongo demo checkout.
          </Dialog.Description>
        </>
      )}
      {/* ChatGPT-style Upper Right "X" Button */}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[110] flex h-10 w-10 items-center justify-center rounded-full bg-brand-surface/90 hover:bg-brand-surface text-brand-text border border-brand-border/80 transition-all shadow-lg backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-brand-accent cursor-pointer"
        >
          <X className="h-5 w-5 stroke-[2.5]" />
        </button>
      )}

      <div className="w-full max-w-7xl mx-auto pt-2 sm:pt-4">
        {/* Header Section */}
        <article className="text-center sm:text-left mb-8 space-y-3 max-w-3xl">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-display font-extrabold tracking-tight text-brand-text">
            <VerticalCutReveal
              splitBy="words"
              staggerDuration={0.08}
              staggerFrom="first"
              reverse={true}
              containerClassName="justify-center sm:justify-start"
              transition={{
                type: 'spring',
                stiffness: 250,
                damping: 35,
              }}
            >
              We&apos;ve got a plan that&apos;s perfect for you
            </VerticalCutReveal>
          </h2>

          <TimelineContent
            as="p"
            animationNum={0}
            timelineRef={pricingRef}
            customVariants={revealVariants}
            className="text-sm sm:text-base leading-relaxed max-w-2xl text-brand-muted"
          >
            Your first 14 days include the Health plan. Free general planning continues with your saved report. Choose
            Lifestyle for changing goals or Health for case planning and nutritionist review.
          </TimelineContent>

          <TimelineContent
            as="div"
            animationNum={1}
            timelineRef={pricingRef}
            customVariants={revealVariants}
            className="pt-2"
          >
            <PricingSwitch
              onSwitch={(value) => {
                if (!checkout.pendingTier) {
                  checkout.dismissQuote();
                  togglePricingPeriod(value);
                }
              }}
              selected={isYearly ? '1' : '0'}
              className="sm:justify-start justify-center"
            />
          </TimelineContent>
        </article>

        <p className="mb-3 text-xs text-brand-muted">
          Demo checkout uses PayMongo test mode. No real charges or automatic renewal.
        </p>
        {checkout.professional && (
          <p className="mb-3 text-xs text-brand-muted">Membership plans are for personal accounts.</p>
        )}
        {checkout.error && (
          <p
            role="alert"
            className="mb-3 rounded-xl border border-status-error-text/30 bg-status-error-bg p-3 text-sm text-status-error-text"
          >
            {checkout.error}
          </p>
        )}
        <MembershipTimeline />
        {checkout.quote && (
          <section
            ref={summaryRef}
            tabIndex={-1}
            aria-label="Payment summary"
            className="max-w-2xl rounded-2xl border border-brand-border bg-brand-surface p-5 sm:p-7 space-y-4 focus:outline-none focus:ring-2 focus:ring-brand-green"
          >
            <h3 className="font-display text-2xl font-bold">Review your payment</h3>
            <p className="font-bold">
              {checkout.quote.tier === 'HEALTH' ? 'Health' : 'Lifestyle'} · {checkout.quote.period.toLowerCase()}
            </p>
            <p className="text-sm">
              {checkout.quote.action === 'AFTER_TRIAL'
                ? 'Your current Health plan continues. The purchased plan starts after these 14 days end.'
                : checkout.quote.action === 'DOWNGRADE'
                  ? 'Your Health benefits continue until your current paid period ends. Lifestyle starts afterwards.'
                  : checkout.quote.action === 'RENEW'
                    ? 'This renewal starts after your current paid period ends.'
                    : checkout.quote.action === 'UPGRADE'
                      ? 'Health starts once payment is verified. Unused Lifestyle value is credited to this purchase.'
                      : 'Your plan starts once payment is verified.'}
            </p>
            <p className="text-sm">
              {['START', 'UPGRADE'].includes(checkout.quote.action) ? 'Estimated period' : 'Scheduled period'}:{' '}
              {membershipDate(checkout.quote.startsAt)} – {membershipDate(checkout.quote.endsAt)} Philippine time.
            </p>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <dt>Plan price</dt>
              <dd className="text-right">{membershipMoney(checkout.quote.listPriceCentavos)}</dd>
              <dt>Membership credit applied</dt>
              <dd className="text-right">−{membershipMoney(checkout.quote.creditCentavos)}</dd>
              <dt className="font-bold">Due now</dt>
              <dd className="text-right font-bold">{membershipMoney(checkout.quote.amountCentavos)}</dd>
              <dt>Credit remaining after purchase</dt>
              <dd className="text-right">{membershipMoney(checkout.quote.carryoverCentavos)}</dd>
            </dl>
            <p className="text-xs text-brand-muted">
              Credit is kept for later membership purchases, not refunded as cash. PayMongo requires at least ₱1 when a
              payment remains; smaller remaining credit is kept in your balance. This summary expires{' '}
              {membershipDate(checkout.quote.expiresAt)}. Immediate activation dates adjust to the verified payment
              time.
            </p>
            <p className="text-xs text-brand-muted">
              Test mode. No real charge or automatic renewal. Changing plans does not reset weekly allowances. Health
              review and clearance requirements still apply.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void checkout.confirm()} isLoading={Boolean(checkout.pendingTier)}>
                {checkout.quote.amountCentavos === 0 ? 'Use membership credit' : 'Continue to PayMongo'}
              </Button>
              <Button variant="secondary" disabled={Boolean(checkout.pendingTier)} onClick={checkout.dismissQuote}>
                Back to plans
              </Button>
            </div>
          </section>
        )}

        {/* 3 Plans Grid */}
        {!checkout.quote && (
          <div className="grid md:grid-cols-3 gap-5 py-4">
            {plans.map((plan, index) => {
              const isCurrent = currentTier === plan.tier;
              return (
                <TimelineContent
                  key={plan.tier}
                  as="div"
                  animationNum={2 + index}
                  timelineRef={pricingRef}
                  customVariants={revealVariants}
                >
                  <Card
                    className={cn(
                      'relative h-full flex flex-col justify-between rounded-3xl transition-all duration-200 overflow-hidden',
                      plan.popular
                        ? 'border-2 border-brand-accent bg-brand-surface text-brand-text shadow-xl ring-1 ring-brand-accent/25'
                        : 'border border-brand-border bg-brand-surface text-brand-text shadow-sm hover:border-brand-green/30'
                    )}
                  >
                    <CardHeader className="text-left p-6 sm:p-7">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-baseline gap-1.5">
                            <h3 className="text-2xl sm:text-3xl font-display font-bold text-brand-text">{plan.name}</h3>
                            <span className="text-xs font-semibold uppercase tracking-wider text-brand-muted font-mono">
                              Plan
                            </span>
                          </div>
                          {isCurrent && (
                            <span className="mt-1 inline-block text-xs font-bold text-brand-green">
                              {currentLevel === 'TRIAL'
                                ? 'Current plan'
                                : currentLevel === 'TRIAL_PENDING'
                                  ? 'Health starts with first usable plan'
                                  : 'Current plan'}
                            </span>
                          )}
                        </div>
                        {plan.popular && (
                          <span className="rounded-full bg-brand-accent text-white px-3 py-1 text-xs font-extrabold uppercase tracking-wider shadow-neon">
                            Recommended
                          </span>
                        )}
                      </div>

                      <p className="mt-3 text-xs sm:text-sm min-h-[40px] text-brand-muted">{plan.description}</p>

                      <div className="mt-5 flex items-baseline">
                        <span className="text-3xl sm:text-4xl font-extrabold font-display text-brand-text">
                          <NumberFlow
                            locales="en-PH"
                            format={{
                              style: 'currency',
                              currency: 'PHP',
                              maximumFractionDigits: 0,
                              trailingZeroDisplay: 'stripIfInteger',
                            }}
                            value={isYearly ? plan.yearlyPrice : plan.price}
                            className="font-extrabold"
                          />
                        </span>
                        <span className="ml-1.5 text-xs sm:text-sm font-medium text-brand-muted">
                          /{isYearly ? 'year' : 'month'}
                        </span>
                      </div>
                    </CardHeader>

                    <CardContent className="p-6 sm:p-7 pt-0 flex-1 flex flex-col justify-between">
                      <div>
                        {plan.tier === 'FREE' ? (
                          <button
                            type="button"
                            disabled={Boolean(checkout.user)}
                            onClick={() => checkout.router.push('/register')}
                            className="w-full mb-6 py-3 px-4 rounded-xl text-sm font-bold bg-brand-bg-alt text-brand-text border border-brand-border cursor-pointer disabled:opacity-85 disabled:cursor-default"
                          >
                            {plan.buttonText}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={
                              Boolean(checkout.pendingTier) ||
                              checkout.professional ||
                              purchaseBlocked ||
                              Boolean(checkout.user && checkout.membershipLoading)
                            }
                            aria-busy={checkout.pendingTier === plan.tier}
                            onClick={() => void checkout.start(plan.tier, isYearly ? 'YEARLY' : 'MONTHLY')}
                            className={cn(
                              'w-full mb-6 py-3 px-4 rounded-xl text-sm font-bold shadow-sm transition-all disabled:opacity-85 disabled:cursor-not-allowed',
                              plan.popular
                                ? 'bg-brand-accent hover:bg-brand-accent-hover text-white shadow-neon border border-brand-accent-soft/30'
                                : 'bg-brand-dark hover:bg-black text-white dark:bg-brand-bg-alt dark:hover:bg-brand-surface dark:text-brand-text border border-brand-border'
                            )}
                          >
                            {checkout.pendingTier === plan.tier ? 'Preparing payment summary…' : plan.buttonText}
                          </button>
                        )}

                        <div className="space-y-3 pt-4 border-t border-brand-border/70">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-brand-text">Features</h4>
                          <p className="text-xs font-semibold mb-2 text-brand-muted">{plan.featuresHeading}</p>
                          <ul className="space-y-2.5">
                            {plan.features.map((feature, idx) => (
                              <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-brand-text/90">
                                <span className="h-4 w-4 shrink-0 rounded-full border border-brand-accent/40 bg-brand-accent/15 text-brand-accent flex items-center justify-center mt-0.5">
                                  <CheckCheck className="h-2.5 w-2.5 stroke-[3]" />
                                </span>
                                <span className="leading-snug">{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TimelineContent>
              );
            })}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-brand-muted max-w-2xl mx-auto">
          A report confirmation is not nutritionist approval. Case clearance and safety requirements still apply. Test
          payment access is only available in the development payment sandbox.
        </p>
      </div>
    </div>
  );

  if (isFullScreenModal)
    return (
      <Dialog.Root
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) onClose?.();
        }}
      >
        <Dialog.Portal>
          <Dialog.Content
            asChild
            onCloseAutoFocus={(event) => {
              if (returnFocus?.isConnected) {
                event.preventDefault();
                returnFocus.focus();
              }
            }}
          >
            {modalBody}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );

  return modalBody;
}

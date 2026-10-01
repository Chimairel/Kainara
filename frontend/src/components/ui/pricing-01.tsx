'use client';

import { Check } from 'lucide-react';
import type { MembershipView } from '@/features/membership/MembershipProvider';

export interface PricingProps {
  currentLevel?: 'FREE' | 'TRIAL_PENDING' | 'TRIAL' | 'MEMBER' | null;
  currentTier?: 'FREE' | 'LIFESTYLE' | 'HEALTH';
  isEnhanced?: boolean;
  limits?: Extract<MembershipView, { enabled: true }>['limits'];
}

export default function Pricing({ currentLevel, currentTier, limits }: PricingProps) {
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
      tier: 'FREE',
      name: 'Free',
      description: 'General meal planning with your saved planning context.',
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
      tier: 'LIFESTYLE',
      name: 'Lifestyle',
      description: 'Adapt your everyday planning as your goals and routine change.',
      features: [
        'Everything in Free',
        'Apply changes to biometrics, activity, goals and food preferences',
        'Apply shopping-day changes through your nutrition report',
        'Progress insights and adaptive weekly check-ins',
        `${l.memberSwaps} meal swaps per cycle`,
        `${l.memberEstimates} AI estimates per Manila week`,
        `${l.memberReplans} optional replans per Manila week`,
      ],
    },
    {
      tier: 'HEALTH',
      name: 'Health',
      description: 'Case planning and bounded nutritionist review for declared health needs.',
      features: [
        'Everything in Lifestyle',
        'Apply changes to conditions, allergies and health restrictions',
        'New case plans subject to required clearance',
        `${l.memberPlanReviews} case plan-review episode per target week`,
        `${l.memberOutsideReviews} requested outside-meal review episode per Manila week`,
        'Follow-up on an existing admitted review',
      ],
    },
  ];
  return (
    <section className="space-y-5" aria-label="Membership plans">
      <div className="text-center">
        <h2 className="font-display text-3xl font-bold text-brand-text">Choose your planning support</h2>
        <p className="mt-2 text-sm text-brand-muted">
          The 14-day trial includes Health benefits. A starter plan counts. Pricing and purchases are not available yet.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => {
          const active = currentTier === plan.tier;
          return (
            <article
              key={plan.tier}
              className="flex flex-col rounded-3xl border border-brand-border bg-brand-surface p-6 shadow-card"
            >
              <h3 className="font-display text-2xl font-bold text-brand-text">{plan.name}</h3>
              {active && (
                <p className="mt-1 text-xs font-semibold text-brand-green">
                  {currentLevel === 'TRIAL'
                    ? 'Current trial'
                    : currentLevel === 'TRIAL_PENDING'
                      ? 'Trial starts with your first usable plan'
                      : 'Current plan'}
                </p>
              )}
              <p className="mt-3 text-sm text-brand-muted">{plan.description}</p>
              <ul className="my-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2 text-sm text-brand-text">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              {plan.tier === 'FREE' ? (
                <p className="text-sm font-semibold text-brand-green">
                  Free access continues for eligible general plans
                </p>
              ) : (
                <button
                  type="button"
                  disabled
                  className="rounded-xl border border-brand-border px-4 py-3 text-sm font-semibold text-brand-muted opacity-70"
                >
                  Purchases opening soon
                </button>
              )}
            </article>
          );
        })}
      </div>
      <p className="text-xs leading-relaxed text-brand-muted">
        A report confirmation is not nutritionist approval. Case clearance and safety requirements still apply. Report
        versions and check-ins do not restart the trial or reset allowances.
      </p>
    </section>
  );
}

import { z } from 'zod';
import { AppError } from '@/errors/AppError';
import { MEMBERSHIP_PRICES, membershipPeriodEnd } from './membership-checkout.policy';

export type PaidPeriod = {
  id: string;
  tier: 'LIFESTYLE' | 'HEALTH';
  period: 'MONTHLY' | 'YEARLY';
  amountCentavos: number;
  effectiveFrom: Date;
  effectiveUntil: Date;
};
export const transitionQuoteSchema = z.object({
  action: z.enum(['START', 'AFTER_TRIAL', 'RENEW', 'DOWNGRADE', 'UPGRADE']),
  listPriceCentavos: z.number().int().positive(),
  creditCentavos: z.number().int().nonnegative(),
  sourceCreditCentavos: z.number().int().nonnegative(),
  balanceCreditCentavos: z.number().int().nonnegative(),
  carryoverCentavos: z.number().int().nonnegative(),
  amountCentavos: z.number().int().nonnegative(),
  sourceId: z.string().nullable(),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  contextHash: z.string(),
});
export type TransitionQuote = z.infer<typeof transitionQuoteSchema>;

export function transitionTimeline(periods: PaidPeriod[], at: Date) {
  const live = periods.filter((p) => p.effectiveUntil > at).sort((a, b) => +a.effectiveFrom - +b.effectiveFrom);
  const conflict = live.some((p, index) =>
    live.slice(0, index).some((prior) => prior.effectiveUntil > p.effectiveFrom)
  );
  return {
    conflict,
    current: live.find((p) => p.effectiveFrom <= at) ?? null,
    scheduled: live.filter((p) => p.effectiveFrom > at),
  };
}

export function quoteTransition(input: {
  tier: 'LIFESTYLE' | 'HEALTH';
  period: 'MONTHLY' | 'YEARLY';
  periods: PaidPeriod[];
  trialEndsAt: Date | null;
  trialPending: boolean;
  balanceCentavos: number;
  contextHash: string;
  at: Date;
}): TransitionQuote {
  const { current, scheduled, conflict } = transitionTimeline(input.periods, input.at);
  if (conflict || scheduled.length > 1)
    throw new AppError(
      'Your existing payments need reconciliation. Contact support before another purchase.',
      409,
      'MEMBERSHIP_RECONCILIATION_REQUIRED'
    );
  if (scheduled.length)
    throw new AppError(
      'Your next membership is already paid and scheduled. Another overlapping purchase is unavailable.',
      409,
      'MEMBERSHIP_ALREADY_SCHEDULED'
    );
  if (input.trialPending)
    throw new AppError(
      'Your Health trial starts with your first usable plan. Checkout will be available once its end date is known.',
      409,
      'MEMBERSHIP_TRIAL_PENDING'
    );
  let startsAt = input.at;
  let action: TransitionQuote['action'] = 'START';
  let sourceCreditCentavos = 0;
  let sourceId: string | null = null;
  if (input.trialEndsAt && input.trialEndsAt > input.at) {
    if (current)
      throw new AppError(
        'Your trial and paid dates need reconciliation. Contact support.',
        409,
        'MEMBERSHIP_RECONCILIATION_REQUIRED'
      );
    startsAt = input.trialEndsAt;
    action = 'AFTER_TRIAL';
  } else if (current) {
    if (current.tier === 'LIFESTYLE' && input.tier === 'HEALTH') {
      action = 'UPGRADE';
      sourceId = current.id;
      const remaining = (+current.effectiveUntil - +input.at) / (+current.effectiveUntil - +current.effectiveFrom);
      sourceCreditCentavos = Math.floor(current.amountCentavos * Math.min(1, Math.max(0, remaining)));
    } else {
      startsAt = current.effectiveUntil;
      action = current.tier === input.tier ? 'RENEW' : 'DOWNGRADE';
    }
  }
  const listPriceCentavos = MEMBERSHIP_PRICES[input.tier][input.period];
  let creditCentavos = Math.min(listPriceCentavos, input.balanceCentavos + sourceCreditCentavos);
  // Provider minimum is PHP 1. Preserve a fractional final credit for a later purchase.
  const due = listPriceCentavos - creditCentavos;
  if (due > 0 && due < 100) creditCentavos = listPriceCentavos - 100;
  const balanceCreditCentavos = Math.min(input.balanceCentavos, creditCentavos);
  return {
    action,
    listPriceCentavos,
    creditCentavos,
    sourceCreditCentavos,
    balanceCreditCentavos,
    carryoverCentavos: input.balanceCentavos + sourceCreditCentavos - creditCentavos,
    amountCentavos: listPriceCentavos - creditCentavos,
    sourceId,
    startsAt: startsAt.toISOString(),
    endsAt: membershipPeriodEnd(startsAt, input.period).toISOString(),
    expiresAt: new Date(+input.at + 10 * 60000).toISOString(),
    contextHash: input.contextHash,
  };
}

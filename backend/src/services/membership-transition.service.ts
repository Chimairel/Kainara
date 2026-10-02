import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { testCheckoutConfig } from '@/domain/membership-checkout.policy';
import { resolveMembershipLevel } from '@/domain/membership.policy';
import { transitionTimeline, transitionQuoteSchema, type PaidPeriod } from '@/domain/membership-transition.policy';

export async function membershipTransitionContext(
  userId: string,
  accountHash: string,
  tx: Prisma.TransactionClient = prisma,
  at = new Date()
) {
  const [account, rows, grants, balance] = await Promise.all([
    tx.membershipAccount.findUnique({ where: { userId } }),
    tx.membershipTestCheckout.findMany({
      where: { userId, accountHash, revokedAt: null, status: { in: ['PAID', 'REVIEW', 'CREATING', 'OPEN'] } },
      orderBy: { createdAt: 'asc' },
    }),
    tx.membershipGrant.findMany({
      where: {
        userId,
        revokedAt: null,
        verifiedAt: { lte: at },
        effectiveUntil: { gt: at },
        source: { in: ['PAID_INVOICE', 'ADMIN_ADJUSTMENT'] },
      },
    }),
    tx.membershipTestBalance.findUnique({ where: { userId_accountHash: { userId, accountHash } } }),
  ]);
  const periods: PaidPeriod[] = rows.flatMap((r) => {
    if (r.status !== 'PAID' || !r.verifiedAt || !r.effectiveFrom || !r.effectiveUntil) return [];
    const end = r.supersededAt && r.supersededAt < r.effectiveUntil ? r.supersededAt : r.effectiveUntil;
    if (end <= at) return [];
    const q = r.quote ? transitionQuoteSchema.parse(r.quote) : null;
    return [
      {
        id: r.id,
        tier: r.tier,
        period: r.period,
        amountCentavos: q?.listPriceCentavos ?? r.amountCentavos,
        effectiveFrom: r.effectiveFrom,
        effectiveUntil: end,
      },
    ];
  });
  const timeline = transitionTimeline(periods, at);
  const trial = resolveMembershipLevel({ at, trialStartedAt: account?.trialStartedAt ?? null, paidUntil: null });
  const open = rows.find((r) => r.status === 'CREATING' || r.status === 'OPEN') ?? null;
  const needsReconciliation =
    timeline.conflict ||
    timeline.scheduled.length > 1 ||
    rows.some((r) => r.status === 'REVIEW') ||
    grants.length > 0 ||
    Boolean(timeline.current && trial.trialEndsAt && trial.trialEndsAt > at);
  const fingerprint = JSON.stringify({
    periods,
    trialStartedAt: account?.trialStartedAt ?? null,
    balance: balance?.amountCentavos ?? 0,
    grants: grants.map((g) => g.id),
    review: rows.filter((r) => r.status === 'REVIEW').map((r) => r.id),
  });
  return {
    ...timeline,
    periods,
    trial,
    open,
    needsReconciliation,
    balanceCentavos: balance?.amountCentavos ?? 0,
    contextHash: createHash('sha256').update(fingerprint).digest('hex'),
  };
}

export async function membershipTransitionView(userId: string, at = new Date()) {
  const c = testCheckoutConfig();
  if (!c) return null;
  const context = await membershipTransitionContext(userId, c.accountHash, prisma, at);
  const blockedReason = context.needsReconciliation
    ? 'Existing payments need reconciliation. Contact support before another purchase.'
    : context.scheduled.length
      ? 'Your next membership is already paid and scheduled.'
      : context.trial.level === 'TRIAL_PENDING'
        ? 'Your trial starts with your first usable plan. Its end date must be known before checkout.'
        : null;
  return {
    current: context.current,
    scheduled: context.scheduled,
    creditBalanceCentavos: context.balanceCentavos,
    blockedReason,
    openCheckout: context.open
      ? {
          id: context.open.id,
          tier: context.open.tier,
          period: context.open.period,
          status: context.open.status,
          checkoutUrl: context.open.checkoutUrl,
          quoteExpiresAt: context.open.quote ? transitionQuoteSchema.parse(context.open.quote).expiresAt : null,
        }
      : null,
  };
}

export function assertTransitionAvailable(context: Awaited<ReturnType<typeof membershipTransitionContext>>) {
  if (context.needsReconciliation)
    throw new AppError(
      'Existing payments need reconciliation. Contact support before another purchase.',
      409,
      'MEMBERSHIP_RECONCILIATION_REQUIRED'
    );
  if (context.open)
    throw new AppError(
      'A checkout is already open. Resume or close it before choosing another plan.',
      409,
      'CHECKOUT_IN_PROGRESS'
    );
}

import { z } from 'zod';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { publishLiveUpdate } from '@/lib/live-updates';
import { lockUserProfile } from './profile-revision.service';
import {
  membershipPeriodEnd,
  testCheckoutConfig,
  verifiedTestPayment,
  isPaymongoCheckoutUrl,
  type CheckoutSelection,
} from '@/domain/membership-checkout.policy';
import { Prisma } from '@prisma/client';
import { quoteTransition, transitionQuoteSchema } from '@/domain/membership-transition.policy';
import { membershipTransitionContext, assertTransitionAvailable } from './membership-transition.service';
import { randomUUID } from 'node:crypto';

function config() {
  const value = testCheckoutConfig();
  if (!value)
    throw new AppError(
      'Demo checkout is not configured for this environment. Please try again later.',
      503,
      'MEMBERSHIP_PURCHASES_UNAVAILABLE'
    );
  return value;
}

/** Reuses the archived PayMongo transport boundaries, without the retired subscription schema. */
export async function paymongoRequest(path: string, method: 'GET' | 'POST', secret: string, body?: unknown) {
  try {
    const response = await fetch(`https://api.paymongo.com${path}`, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      headers: {
        Authorization: `Basic ${Buffer.from(`${secret}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('application/json') || !response.body)
      throw new Error('Provider unavailable.');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.byteLength;
      if (length > 65536) {
        await reader.cancel();
        throw new Error('Provider response too large.');
      }
      chunks.push(result.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new AppError(
      'PayMongo could not complete this request. Please retry in a moment.',
      502,
      'PAYMONGO_UNAVAILABLE'
    );
  }
}

const sessionCreated = z.object({
  data: z.object({
    id: z.string().regex(/^cs_[A-Za-z0-9_-]+$/),
    type: z.literal('checkout_session'),
    attributes: z.object({
      livemode: z.literal(false),
      checkout_url: z.string().refine(isPaymongoCheckoutUrl),
      reference_number: z.string().optional(),
    }),
  }),
});

export class MembershipCheckoutService {
  static async create(userId: string, selection: CheckoutSelection) {
    const c = config();
    if (!selection.quoteId) throw new AppError('Review the payment summary before checkout.', 428, 'QUOTE_REQUIRED');
    const result = await prisma.$transaction(
      async (tx) => {
        await lockUserProfile(tx, userId);
        const prior = await tx.membershipTestCheckout.findUnique({
          where: { userId_requestKey: { userId, requestKey: selection.requestKey } },
        });
        if (prior) {
          if (
            prior.tier !== selection.tier ||
            prior.period !== selection.period ||
            prior.accountHash !== c.accountHash ||
            prior.id !== selection.quoteId
          )
            throw new AppError('This request belongs to a different checkout.', 409, 'REQUEST_KEY_COLLISION');
          return { row: prior, created: false };
        }
        const row = await tx.membershipTestCheckout.findFirst({
          where: {
            id: selection.quoteId,
            userId,
            accountHash: c.accountHash,
            tier: selection.tier,
            period: selection.period,
          },
        });
        if (!row || row.status !== 'QUOTED') throw new AppError('Review a new payment summary.', 409, 'QUOTE_CHANGED');
        const quote = transitionQuoteSchema.parse(row.quote);
        await this.assertAccount(tx, userId);
        const context = await membershipTransitionContext(userId, c.accountHash, tx);
        assertTransitionAvailable(context);
        if (new Date(quote.expiresAt) <= new Date() || context.contextHash !== quote.contextHash)
          throw new AppError(
            'Your membership or quote changed. Review the updated payment summary.',
            409,
            'QUOTE_CHANGED'
          );
        return {
          row: await tx.membershipTestCheckout.update({
            where: { id: row.id },
            data: { requestKey: selection.requestKey, status: 'CREATING' },
          }),
          created: true,
        };
      },
      { maxWait: 10000, timeout: 30000 }
    );
    if (!result.created) {
      if (result.row.status === 'PAID' || result.row.status === 'REVIEW') return this.view(result.row);
      if (result.row.status === 'OPEN' && result.row.checkoutUrl) return this.view(result.row);
      if (result.row.status === 'CREATING' && result.row.amountCentavos === 0) return this.settle(result.row.id, null);
      throw new AppError(
        'This checkout is already being prepared or completed. Check your membership before trying again.',
        409,
        'CHECKOUT_IN_PROGRESS'
      );
    }
    const row = result.row;
    if (row.amountCentavos === 0) {
      try {
        return await this.settle(row.id, null);
      } catch (error) {
        await prisma.membershipTestCheckout.updateMany({
          where: { id: row.id, status: 'CREATING' },
          data: { status: 'FAILED' },
        });
        throw error;
      }
    }
    try {
      const returnUrl = new URL('/membership/checkout', c.frontendOrigin);
      returnUrl.searchParams.set('purchase', row.id);
      const cancelUrl = new URL(returnUrl);
      cancelUrl.searchParams.set('cancelled', '1');
      const response = sessionCreated.parse(
        await paymongoRequest('/v2/checkout_sessions', 'POST', c.secret, {
          data: {
            attributes: {
              line_items: [
                {
                  amount: row.amountCentavos,
                  currency: 'PHP',
                  quantity: 1,
                  name: `Kainara ${selection.tier === 'HEALTH' ? 'Health' : 'Lifestyle'} — ${selection.period === 'YEARLY' ? 'yearly' : 'monthly'} (test)`,
                },
              ],
              payment_method_types: ['card', 'paymaya'],
              reference_number: row.id,
              description: 'Kainara membership test payment. No automatic renewal.',
              success_url: returnUrl.toString(),
              cancel_url: cancelUrl.toString(),
              send_email_receipt: false,
              show_line_items: true,
            },
          },
        })
      );
      if (response.data.attributes.reference_number && response.data.attributes.reference_number !== row.id)
        throw new Error('Mismatched checkout.');
      const opened = this.view(
        await prisma.membershipTestCheckout.update({
          where: { id: row.id },
          data: {
            providerSessionId: response.data.id,
            checkoutUrl: response.data.attributes.checkout_url,
            status: 'OPEN',
          },
        })
      );
      publishLiveUpdate({ userId });
      return opened;
    } catch (error) {
      await prisma.membershipTestCheckout.update({ where: { id: row.id }, data: { status: 'FAILED' } });
      publishLiveUpdate({ userId });
      if (error instanceof AppError) throw error;
      throw new AppError('PayMongo returned an invalid demo checkout. Please retry.', 502, 'PAYMONGO_INVALID_CHECKOUT');
    }
  }

  static async status(userId: string, id: string) {
    const c = config();
    const row = await prisma.membershipTestCheckout.findFirst({ where: { id, userId, accountHash: c.accountHash } });
    if (!row) throw new AppError('Checkout not found.', 404, 'CHECKOUT_NOT_FOUND');
    if (!row.providerSessionId || row.status === 'FAILED' || row.status === 'PAID' || row.status === 'REVIEW')
      return this.view(row);
    if (row.status === 'OPEN' && row.quote && new Date(transitionQuoteSchema.parse(row.quote).expiresAt) <= new Date())
      return this.close(userId, id);
    return this.reconcile(row.id);
  }

  static async reconcile(id: string) {
    const c = config();
    const row = await prisma.membershipTestCheckout.findFirst({ where: { id, accountHash: c.accountHash } });
    if (!row?.providerSessionId) throw new AppError('Checkout not found.', 404, 'CHECKOUT_NOT_FOUND');
    let payment;
    try {
      const evidence = await paymongoRequest(`/v1/checkout_sessions/${row.providerSessionId}`, 'GET', c.secret);
      payment = verifiedTestPayment(evidence, { ...row, providerSessionId: row.providerSessionId });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        'Payment could not be verified. No membership changes were made.',
        502,
        'PAYMENT_NOT_VERIFIED'
      );
    }
    if (!payment) return this.view(row);
    return this.settle(row.id, payment);
  }

  private static async assertAccount(tx: Prisma.TransactionClient, userId: string) {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (
      !user ||
      user.role !== 'USER' ||
      user.isSuspended ||
      !user.emailVerified ||
      !user.onboardingDone ||
      !user.tosAccepted
    )
      throw new AppError('Complete your account setup before checkout.', 403, 'MEMBERSHIP_ACCOUNT_INELIGIBLE');
  }

  static async quote(userId: string, selection: Pick<CheckoutSelection, 'tier' | 'period'>) {
    const c = config();
    return prisma.$transaction(
      async (tx) => {
        await lockUserProfile(tx, userId);
        await this.assertAccount(tx, userId);
        const context = await membershipTransitionContext(userId, c.accountHash, tx);
        assertTransitionAvailable(context);
        const quote = quoteTransition({
          ...selection,
          periods: context.periods,
          trialEndsAt: context.trial.trialEndsAt,
          trialPending: context.trial.level === 'TRIAL_PENDING',
          balanceCentavos: context.balanceCentavos,
          contextHash: context.contextHash,
          at: new Date(),
        });
        const row = await tx.membershipTestCheckout.create({
          data: {
            userId,
            ...selection,
            accountHash: c.accountHash,
            requestKey: randomUUID(),
            amountCentavos: quote.amountCentavos,
            status: 'QUOTED',
            quote: quote as Prisma.InputJsonObject,
          },
        });
        return { ...this.view(row), ...quote };
      },
      { maxWait: 10000, timeout: 30000 }
    );
  }

  private static async settle(id: string, payment: { id: string; paidAt: Date } | null) {
    const c = config();
    const owner = await prisma.membershipTestCheckout.findUniqueOrThrow({ where: { id } });
    let changed = false;
    const result = await prisma.$transaction(
      async (tx) => {
        await lockUserProfile(tx, owner.userId);
        const row = await tx.membershipTestCheckout.findUniqueOrThrow({ where: { id } });
        if (row.accountHash !== c.accountHash) throw new AppError('Checkout not found.', 404, 'CHECKOUT_NOT_FOUND');
        if (row.status === 'PAID' || row.status === 'REVIEW') return row;
        // Legacy paid checkouts retain the old date/value evidence and require explicit reconciliation.
        const quote = row.quote ? transitionQuoteSchema.parse(row.quote) : null;
        const at = new Date();
        const context = await membershipTransitionContext(row.userId, c.accountHash, tx, at);
        const invalid =
          !quote ||
          context.needsReconciliation ||
          context.scheduled.length > 0 ||
          context.contextHash !== quote.contextHash ||
          (payment ? payment.paidAt > new Date(quote.expiresAt) : at > new Date(quote.expiresAt)) ||
          (row.status !== 'OPEN' && row.status !== 'CREATING');
        if (!payment && (invalid || row.amountCentavos !== 0))
          throw new AppError('Review a new payment summary.', 409, 'QUOTE_CHANGED');
        if (invalid) {
          changed = true;
          await tx.notification.create({
            data: {
              userId: row.userId,
              type: 'MEMBERSHIP_UPDATED',
              title: 'Payment needs review',
              message:
                'Your payment was received, but the membership dates or quote changed. Contact support; your existing access and payment record are preserved.',
            },
          });
          return tx.membershipTestCheckout.update({
            where: { id },
            data: { status: 'REVIEW', providerPaymentId: payment!.id, paidAt: payment!.paidAt, verifiedAt: at },
          });
        }
        const valid = quote!;
        if (valid.sourceId) {
          const source = await tx.membershipTestCheckout.findFirst({
            where: {
              id: valid.sourceId,
              userId: row.userId,
              accountHash: c.accountHash,
              status: 'PAID',
              supersededAt: null,
              revokedAt: null,
            },
          });
          if (!source) throw new AppError('The previous membership changed.', 409, 'QUOTE_CHANGED');
          await tx.membershipTestCheckout.update({ where: { id: source.id }, data: { supersededAt: at } });
        }
        const start = new Date(Math.max(+at, +new Date(valid.startsAt)));
        await tx.membershipTestBalance.upsert({
          where: { userId_accountHash: { userId: row.userId, accountHash: c.accountHash } },
          create: { userId: row.userId, accountHash: c.accountHash, amountCentavos: valid.carryoverCentavos },
          update: { amountCentavos: valid.carryoverCentavos },
        });
        await tx.notification.create({
          data: {
            userId: row.userId,
            type: 'MEMBERSHIP_UPDATED',
            title: 'Payment successful',
            message: `${row.tier === 'HEALTH' ? 'Health' : 'Lifestyle'} membership ${start > at ? 'scheduled' : 'active'} from ${start.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} Philippine time. Test mode; no real charge or automatic renewal.`,
          },
        });
        changed = true;
        return tx.membershipTestCheckout.update({
          where: { id },
          data: {
            status: 'PAID',
            providerPaymentId: payment?.id ?? null,
            paidAt: payment?.paidAt ?? at,
            verifiedAt: at,
            effectiveFrom: start,
            effectiveUntil: membershipPeriodEnd(start, row.period),
          },
        });
      },
      { maxWait: 10000, timeout: 30000 }
    );
    if (changed) publishLiveUpdate({ userId: owner.userId });
    return this.view(result);
  }

  static async close(userId: string, id: string) {
    const c = config();
    const row = await prisma.membershipTestCheckout.findFirst({ where: { id, userId, accountHash: c.accountHash } });
    if (!row) throw new AppError('Checkout not found.', 404, 'CHECKOUT_NOT_FOUND');
    if (row.status === 'PAID' || row.status === 'REVIEW' || row.status === 'CLOSED') return this.view(row);
    if (row.providerSessionId) {
      try {
        await paymongoRequest(`/v1/checkout_sessions/${row.providerSessionId}/expire`, 'POST', c.secret);
      } catch (error) {
        const receipt = await this.reconcile(row.id);
        if (receipt.status === 'PAID' || receipt.status === 'REVIEW') return receipt;
        // An earlier close may have expired the session before this request retried.
        const evidence = await paymongoRequest(`/v1/checkout_sessions/${row.providerSessionId}`, 'GET', c.secret);
        const expired = z
          .object({
            data: z.object({
              id: z.literal(row.providerSessionId),
              attributes: z.object({
                livemode: z.literal(false),
                reference_number: z.literal(row.id),
                status: z.literal('expired'),
              }),
            }),
          })
          .safeParse(evidence);
        if (!expired.success) throw error;
      }
      const latest = await this.reconcile(row.id);
      if (latest.status === 'PAID' || latest.status === 'REVIEW') return latest;
      const evidence = await paymongoRequest(`/v1/checkout_sessions/${row.providerSessionId}`, 'GET', c.secret);
      const checked = z
        .object({
          data: z.object({
            id: z.literal(row.providerSessionId),
            attributes: z.object({
              livemode: z.literal(false),
              reference_number: z.literal(row.id),
              status: z.literal('expired'),
            }),
          }),
        })
        .safeParse(evidence);
      if (!checked.success)
        throw new AppError('Checkout closure could not be confirmed. Try again.', 502, 'CHECKOUT_CLOSE_UNCONFIRMED');
    } else if (row.status === 'CREATING')
      throw new AppError('Checkout is being prepared. Try again shortly.', 409, 'CHECKOUT_IN_PROGRESS');
    const closed = await prisma.$transaction(async (tx) => {
      await lockUserProfile(tx, userId);
      const latest = await tx.membershipTestCheckout.findUniqueOrThrow({ where: { id } });
      if (latest.status === 'PAID' || latest.status === 'REVIEW') return latest;
      return tx.membershipTestCheckout.update({ where: { id }, data: { status: 'CLOSED' } });
    });
    publishLiveUpdate({ userId });
    return this.view(closed);
  }

  static view(row: {
    id: string;
    tier: string;
    period: string;
    amountCentavos: number;
    status: string;
    checkoutUrl: string | null;
    effectiveFrom: Date | null;
    effectiveUntil: Date | null;
    quote?: Prisma.JsonValue | null;
  }) {
    return {
      id: row.id,
      tier: row.tier,
      period: row.period,
      amountCentavos: row.amountCentavos,
      currency: 'PHP',
      mode: 'TEST',
      status: row.status,
      checkoutUrl: row.status === 'OPEN' ? row.checkoutUrl : null,
      effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
      effectiveUntil: row.effectiveUntil?.toISOString() ?? null,
      autoRenews: false,
      transition: row.quote ? transitionQuoteSchema.parse(row.quote) : null,
    };
  }
}

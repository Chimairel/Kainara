import { z } from 'zod';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { publishLiveUpdate } from '@/lib/live-updates';
import { lockUserProfile } from './profile-revision.service';
import {
  MEMBERSHIP_PRICES,
  membershipPeriodEnd,
  testCheckoutConfig,
  verifiedTestPayment,
  isPaymongoCheckoutUrl,
  type CheckoutSelection,
} from '@/domain/membership-checkout.policy';
import { resolveMembershipLevel } from '@/domain/membership.policy';

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
    const result = await prisma.$transaction(async (tx) => {
      await lockUserProfile(tx, userId);
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (
        !user ||
        user.role !== 'USER' ||
        user.isSuspended ||
        !user.emailVerified ||
        !user.onboardingDone ||
        !user.tosAccepted
      )
        throw new AppError(
          'Complete your account setup before choosing a membership.',
          403,
          'MEMBERSHIP_ACCOUNT_INELIGIBLE'
        );
      const prior = await tx.membershipTestCheckout.findUnique({
        where: { userId_requestKey: { userId, requestKey: selection.requestKey } },
      });
      if (prior) {
        if (prior.tier !== selection.tier || prior.period !== selection.period || prior.accountHash !== c.accountHash)
          throw new AppError('This checkout request belongs to a different selection.', 409, 'REQUEST_KEY_COLLISION');
        return { row: prior, created: false };
      }
      // Repeated clicks/reloads reuse a recent session for this selection.
      const open = await tx.membershipTestCheckout.findFirst({
        where: {
          userId,
          tier: selection.tier,
          period: selection.period,
          accountHash: c.accountHash,
          status: { in: ['CREATING', 'OPEN'] },
          createdAt: { gt: new Date(Date.now() - 15 * 60000) },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (open) return { row: open, created: false };
      return {
        row: await tx.membershipTestCheckout.create({
          data: {
            userId,
            ...selection,
            amountCentavos: MEMBERSHIP_PRICES[selection.tier][selection.period],
            accountHash: c.accountHash,
          },
        }),
        created: true,
      };
    });
    if (!result.created) {
      if (result.row.status === 'OPEN' && result.row.checkoutUrl) return this.view(result.row);
      throw new AppError(
        'This checkout is already being prepared or completed. Check your membership before trying again.',
        409,
        'CHECKOUT_IN_PROGRESS'
      );
    }
    const row = result.row;
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
      return this.view(
        await prisma.membershipTestCheckout.update({
          where: { id: row.id },
          data: {
            providerSessionId: response.data.id,
            checkoutUrl: response.data.attributes.checkout_url,
            status: 'OPEN',
          },
        })
      );
    } catch (error) {
      await prisma.membershipTestCheckout.update({ where: { id: row.id }, data: { status: 'FAILED' } });
      if (error instanceof AppError) throw error;
      throw new AppError('PayMongo returned an invalid demo checkout. Please retry.', 502, 'PAYMONGO_INVALID_CHECKOUT');
    }
  }

  static async status(userId: string, id: string) {
    const c = config();
    const row = await prisma.membershipTestCheckout.findFirst({ where: { id, userId, accountHash: c.accountHash } });
    if (!row) throw new AppError('Checkout not found.', 404, 'CHECKOUT_NOT_FOUND');
    if (!row.providerSessionId || row.status === 'FAILED') return this.view(row);
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
    let changed = false;
    const paid = await prisma.$transaction(async (tx) => {
      await lockUserProfile(tx, row.userId);
      const current = await tx.membershipTestCheckout.findUniqueOrThrow({ where: { id } });
      if (current.status === 'PAID') return current;
      const account = await tx.membershipAccount.findUnique({ where: { userId: row.userId } });
      const trial = resolveMembershipLevel({
        at: new Date(),
        trialStartedAt: account?.trialStartedAt ?? null,
        paidUntil: null,
      });
      const existing = await tx.membershipTestCheckout.findMany({
        where: {
          userId: row.userId,
          accountHash: c.accountHash,
          status: 'PAID',
          revokedAt: null,
          ...(row.tier === 'HEALTH' ? { tier: 'HEALTH' as const } : {}),
        },
      });
      const grants = await tx.membershipGrant.findMany({
        where: {
          userId: row.userId,
          revokedAt: null,
          verifiedAt: { lte: new Date() },
          source: { in: ['PAID_INVOICE', 'ADMIN_ADJUSTMENT'] },
          ...(row.tier === 'HEALTH' ? { tier: 'HEALTH' as const } : {}),
        },
      });
      const start = new Date(
        Math.max(
          Date.now(),
          trial.trialEndsAt?.getTime() ?? 0,
          ...existing.map((r) => r.effectiveUntil?.getTime() ?? 0),
          ...grants.map((r) => r.effectiveUntil.getTime())
        )
      );
      await tx.notification.create({
        data: {
          userId: row.userId,
          type: 'MEMBERSHIP_UPDATED',
          title: 'Payment successful',
          message: `${row.tier === 'HEALTH' ? 'Health' : 'Lifestyle'} test payment verified. Your test period starts ${start.toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} Philippine time. No real charge or automatic renewal.`,
        },
      });
      changed = true;
      return tx.membershipTestCheckout.update({
        where: { id },
        data: {
          status: 'PAID',
          providerPaymentId: payment.id,
          paidAt: payment.paidAt,
          verifiedAt: new Date(),
          effectiveFrom: start,
          effectiveUntil: membershipPeriodEnd(start, row.period),
        },
      });
    });
    if (changed) publishLiveUpdate({ userId: row.userId });
    return this.view(paid);
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
    };
  }
}

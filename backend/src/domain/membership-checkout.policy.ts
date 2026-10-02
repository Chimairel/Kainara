import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

export const membershipCheckoutInput = z
  .object({
    tier: z.enum(['LIFESTYLE', 'HEALTH']),
    period: z.enum(['MONTHLY', 'YEARLY']),
    requestKey: z.uuid(),
  })
  .strict();
export type CheckoutSelection = z.infer<typeof membershipCheckoutInput>;
export const MEMBERSHIP_PRICES = {
  LIFESTYLE: { MONTHLY: 24900, YEARLY: 239000 },
  HEALTH: { MONTHLY: 149900, YEARLY: 1439000 },
} as const;

/** Test access is confined to the disposable database; it never creates a paid MembershipGrant. */
export function testCheckoutConfig(source: NodeJS.ProcessEnv = process.env) {
  if (source.PAYMONGO_INTEGRATION_ENABLED !== 'true' || source.MEMBERSHIP_ENABLED !== 'true') return null;
  try {
    const database = new URL(source.DATABASE_URL ?? '');
    const frontend = new URL(source.FRONTEND_URL ?? '');
    const secret = source.PAYMONGO_SECRET_KEY ?? '';
    if (
      !['development', 'test'].includes(source.NODE_ENV ?? 'development') ||
      source.PAYMONGO_ENVIRONMENT !== 'TEST' ||
      !/^sk_test_[A-Za-z0-9_-]{24,247}$/.test(secret) ||
      !['localhost', '127.0.0.1'].includes(database.hostname) ||
      database.pathname !== '/membership_acceptance' ||
      !['localhost', '127.0.0.1'].includes(frontend.hostname) ||
      !['http:', 'https:'].includes(frontend.protocol) ||
      frontend.username ||
      frontend.password
    )
      return null;
    return {
      secret,
      accountHash: createHash('sha256').update(secret).digest('hex'),
      frontendOrigin: frontend.origin,
      webhookSecret: source.PAYMONGO_WEBHOOK_SECRET ?? '',
    };
  } catch {
    return null;
  }
}

export function isPaymongoCheckoutUrl(value: string) {
  try {
    const url = new URL(value);
    return url.origin === 'https://checkout.paymongo.com' && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Philippine calendar months, clamped to the last day of the destination month. */
export function membershipPeriodEnd(start: Date, period: CheckoutSelection['period']) {
  const manilaOffset = 8 * 60 * 60 * 1000;
  const end = new Date(start.getTime() + manilaOffset);
  const day = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + (period === 'YEARLY' ? 12 : 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(day, last));
  return new Date(end.getTime() - manilaOffset);
}

/** PayMongo signs timestamp + the original bytes, using te for a test event. */
export function verifyTestWebhook(raw: Buffer, header: string, secret: string, at = new Date()) {
  if (!secret || raw.length > 65536) return false;
  const entries = header.split(',').map((part) => part.trim().split('='));
  if (entries.some((entry) => entry.length !== 2)) return false;
  const values = new Map(entries.map(([key, value]) => [key, value] as const));
  if (values.size !== entries.length || !/^\d+$/.test(values.get('t') ?? '')) return false;
  const timestamp = Number(values.get('t'));
  if (!Number.isSafeInteger(timestamp) || Math.abs(at.getTime() / 1000 - timestamp) > 300) return false;
  const signature = values.get('te') ?? '';
  if (!/^[a-fA-F0-9]{64}$/.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(raw).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

const paymentSchema = z.object({
  id: z.string().regex(/^pay_[A-Za-z0-9_-]+$/),
  type: z.literal('payment'),
  attributes: z.object({
    livemode: z.literal(false),
    status: z.literal('paid'),
    amount: z.number().int().positive(),
    currency: z.literal('PHP'),
    paid_at: z.number().int().positive(),
    payment_intent_id: z.string(),
    refunds: z.array(z.unknown()).length(0),
    disputed: z.literal(false),
  }),
});
const sessionSchema = z.object({
  data: z.object({
    id: z.string().regex(/^cs_[A-Za-z0-9_-]+$/),
    type: z.literal('checkout_session'),
    attributes: z.object({
      livemode: z.literal(false),
      reference_number: z.string(),
      payments: z.array(z.unknown()),
      payment_intent: z
        .object({
          id: z.string().regex(/^pi_[A-Za-z0-9_-]+$/),
          type: z.literal('payment_intent'),
          attributes: z.object({
            livemode: z.literal(false),
            status: z.string(),
            amount: z.number().int(),
            currency: z.literal('PHP'),
          }),
        })
        .nullable(),
    }),
  }),
});

export function verifiedTestPayment(
  body: unknown,
  expected: { id: string; providerSessionId: string; amountCentavos: number },
  at = new Date()
) {
  const session = sessionSchema.parse(body).data;
  const a = session.attributes;
  if (
    session.id !== expected.providerSessionId ||
    a.reference_number !== expected.id ||
    (a.payment_intent && a.payment_intent.attributes.amount !== expected.amountCentavos)
  )
    throw new Error('Checkout evidence does not match.');
  const paid = a.payments.filter(
    (value) => z.object({ attributes: z.object({ status: z.literal('paid') }) }).safeParse(value).success
  );
  if (!paid.length && a.payment_intent?.attributes.status !== 'succeeded') return null;
  if (paid.length !== 1 || !a.payment_intent || a.payment_intent.attributes.status !== 'succeeded')
    throw new Error('Incomplete payment evidence.');
  const payment = paymentSchema.parse(paid[0]);
  if (
    payment.attributes.amount !== expected.amountCentavos ||
    payment.attributes.payment_intent_id !== a.payment_intent.id ||
    payment.attributes.paid_at * 1000 > at.getTime() + 60000
  )
    throw new Error('Payment evidence does not match.');
  return { id: payment.id, paidAt: new Date(payment.attributes.paid_at * 1000) };
}

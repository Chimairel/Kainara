import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  MEMBERSHIP_PRICES,
  membershipCheckoutInput,
  testCheckoutConfig,
  membershipPeriodEnd,
  verifyTestWebhook,
  verifiedTestPayment,
  isPaymongoCheckoutUrl,
} from '../src/domain/membership-checkout.policy';

const at = new Date('2026-10-02T00:00:00Z');
const configuration = {
  NODE_ENV: 'development',
  MEMBERSHIP_ENABLED: 'true',
  PAYMONGO_INTEGRATION_ENABLED: 'true',
  PAYMONGO_ENVIRONMENT: 'TEST',
  PAYMONGO_SECRET_KEY: `sk_test_${'a'.repeat(32)}`,
  FRONTEND_URL: 'http://localhost:3108',
  DATABASE_URL: 'postgresql://preview:fixture@127.0.0.1:55472/membership_acceptance',
};
test('test checkout supports regular development databases only with explicit sandbox settings', () => {
  assert.ok(testCheckoutConfig(configuration));
  assert.ok(testCheckoutConfig({ ...configuration, DATABASE_URL: 'postgresql://fixture@db.example.com/app' }));
  assert.ok(testCheckoutConfig({ ...configuration, FRONTEND_URL: 'https://development.example.com' }));
  for (const change of [
    { PAYMONGO_SECRET_KEY: `sk_live_${'a'.repeat(32)}` },
    { NODE_ENV: 'production' },
    { PAYMONGO_ENVIRONMENT: 'LIVE' },
    { DATABASE_URL: 'https://db.example.com/app' },
    { DATABASE_URL: 'postgresql://fixture@db.example.com/' },
    { PAYMONGO_INTEGRATION_ENABLED: 'false' },
    { FRONTEND_URL: 'http://development.example.com' },
    { FRONTEND_URL: 'https://user:password@development.example.com' },
    { FRONTEND_URL: 'https://development.example.com/path' },
    { FRONTEND_URL: 'https://development.example.com?redirect=other' },
    { MEMBERSHIP_ENABLED: 'false' },
  ])
    assert.equal(testCheckoutConfig({ ...configuration, ...change }), null);
});
test('hosted sandbox checkout requires demo deployment mode, HTTPS, and test credentials', () => {
  const hosted = {
    ...configuration,
    NODE_ENV: 'production',
    NUTRIMIND_DEPLOYMENT_MODE: 'capstone-demo',
    DATABASE_URL: 'postgresql://fixture@db.example.com/app',
    FRONTEND_URL: 'https://kainara.vercel.app',
  };
  assert.ok(testCheckoutConfig(hosted));
  for (const change of [
    { NUTRIMIND_DEPLOYMENT_MODE: 'public' },
    { FRONTEND_URL: 'http://localhost:3000' },
    { PAYMONGO_ENVIRONMENT: 'LIVE' },
    { PAYMONGO_SECRET_KEY: `sk_live_${'a'.repeat(32)}` },
    { PAYMONGO_INTEGRATION_ENABLED: 'false' },
  ])
    assert.equal(testCheckoutConfig({ ...hosted, ...change }), null);
});
test('server prices are centavos; requests cannot supply their own price or customer', () => {
  assert.deepEqual(MEMBERSHIP_PRICES, {
    LIFESTYLE: { MONTHLY: 24900, YEARLY: 239000 },
    HEALTH: { MONTHLY: 99900, YEARLY: 959000 },
  });
  const input = { tier: 'LIFESTYLE', period: 'YEARLY', requestKey: '384b85e0-a48d-41b8-bdcf-e7a737de8fd7' };
  assert.ok(membershipCheckoutInput.safeParse(input).success);
  assert.equal(membershipCheckoutInput.safeParse({ ...input, amount: 1 }).success, false);
  assert.equal(membershipCheckoutInput.safeParse({ ...input, userId: 'other' }).success, false);
  assert.equal(membershipCheckoutInput.safeParse({ ...input, tier: 'FREE' }).success, false);
});
test('membership periods preserve end-of-month and leap year boundaries', () => {
  assert.equal(
    membershipPeriodEnd(new Date('2026-02-28T16:30:00Z'), 'MONTHLY').toISOString(),
    '2026-03-31T16:30:00.000Z'
  );
  assert.equal(
    membershipPeriodEnd(new Date('2026-01-31T12:30:00Z'), 'MONTHLY').toISOString(),
    '2026-02-28T12:30:00.000Z'
  );
  assert.equal(
    membershipPeriodEnd(new Date('2028-02-29T12:30:00Z'), 'YEARLY').toISOString(),
    '2029-02-28T12:30:00.000Z'
  );
});
test('webhook verification uses test signature, exact bytes, freshness and unique fields', () => {
  const raw = Buffer.from('{"paid":true}');
  const timestamp = at.getTime() / 1000;
  const signature = createHmac('sha256', 'fixture').update(`${timestamp}.`).update(raw).digest('hex');
  const header = `t=${timestamp},te=${signature}`;
  assert.ok(verifyTestWebhook(raw, header, 'fixture', at));
  assert.equal(verifyTestWebhook(Buffer.from('{ "paid":true}'), header, 'fixture', at), false);
  assert.equal(verifyTestWebhook(raw, header.replace('te=', 'li='), 'fixture', at), false);
  assert.equal(verifyTestWebhook(raw, header, 'fixture', new Date(at.getTime() + 301000)), false);
  assert.equal(verifyTestWebhook(raw, `${header},t=${timestamp}`, 'fixture', at), false);
});
function evidence() {
  return {
    data: {
      id: 'cs_fixture',
      type: 'checkout_session',
      attributes: {
        livemode: false,
        reference_number: 'checkout-fixture',
        status: 'active',
        payment_intent: {
          id: 'pi_fixture',
          type: 'payment_intent',
          attributes: { livemode: false, status: 'succeeded', amount: 24900, currency: 'PHP' },
        },
        payments: [
          {
            id: 'pay_fixture',
            type: 'payment',
            attributes: {
              livemode: false,
              status: 'paid',
              amount: 24900,
              currency: 'PHP',
              paid_at: at.getTime() / 1000,
              payment_intent_id: 'pi_fixture',
              refunds: [],
              disputed: false,
            },
          },
        ],
      },
    },
  };
}
const expected = { id: 'checkout-fixture', providerSessionId: 'cs_fixture', amountCentavos: 24900 };
test('paid evidence must match session, reference, amount, currency, intent, test mode and refund state', () => {
  assert.equal(verifiedTestPayment(evidence(), expected, at)?.id, 'pay_fixture');
  for (const change of [{ id: 'other' }, { providerSessionId: 'cs_other' }, { amountCentavos: 1 }])
    assert.throws(() => verifiedTestPayment(evidence(), { ...expected, ...change }, at));
  for (const field of ['livemode', 'amount', 'currency', 'payment_intent_id', 'refunds', 'disputed']) {
    const body = evidence();
    Object.assign(body.data.attributes.payments[0].attributes, {
      [field]: (
        {
          livemode: true,
          amount: 1,
          currency: 'USD',
          payment_intent_id: 'pi_other',
          refunds: [{}],
          disputed: true,
        } as Record<string, unknown>
      )[field],
    });
    assert.throws(() => verifiedTestPayment(body, expected, at));
  }
  const pending = evidence();
  pending.data.attributes.payments = [];
  pending.data.attributes.payment_intent.attributes.status = 'awaiting_payment_method';
  assert.equal(verifiedTestPayment(pending, expected, at), null);
});
test('checkout redirects cannot use a lookalike domain, embedded credentials or insecure URL', () => {
  assert.ok(isPaymongoCheckoutUrl('https://checkout.paymongo.com/cs_fixture'));
  for (const value of [
    'https://checkout.paymongo.com.example.com',
    'http://checkout.paymongo.com',
    'https://attacker@checkout.paymongo.com',
    'javascript:alert(1)',
  ])
    assert.equal(isPaymongoCheckoutUrl(value), false);
});

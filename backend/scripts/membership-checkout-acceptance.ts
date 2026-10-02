import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';

async function main() {
  const database = new URL(process.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1'].includes(database.hostname) || database.pathname !== '/membership_acceptance')
    throw new Error('Checkout acceptance requires the disposable local membership_acceptance database.');
  Object.assign(process.env, {
    NODE_ENV: 'test',
    MEMBERSHIP_ENABLED: 'true',
    PAYMONGO_INTEGRATION_ENABLED: 'true',
    PAYMONGO_ENVIRONMENT: 'TEST',
    PAYMONGO_SECRET_KEY: `sk_test_${'fixture'.repeat(5)}`,
    PAYMONGO_WEBHOOK_SECRET: 'checkout-acceptance-signature-fixture',
    FRONTEND_URL: 'http://localhost:3108',
    JWT_SECRET: 'checkout-acceptance-access-fixture',
    JWT_REFRESH_SECRET: 'checkout-acceptance-refresh-fixture',
  });
  const { default: prisma } = await import('../src/lib/prisma');
  const { default: app } = await import('../src/app');
  const { MembershipService } = await import('../src/services/membership.service');
  const { MembershipCheckoutService } = await import('../src/services/membership-checkout.service');
  const users: string[] = [];
  const realFetch = globalThis.fetch;
  const sessions = new Map<string, { reference: string; amount: number; paid: boolean; unsafe?: boolean }>();
  let created = 0;
  let providerFailure = false;
  globalThis.fetch = (async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (!url.startsWith('https://api.paymongo.com/')) return realFetch(input, init);
    if (providerFailure) return new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } });
    if (init?.method === 'POST') {
      const a = JSON.parse(String(init.body)).data.attributes;
      assert.equal(new URL(a.success_url).origin, 'http://localhost:3108');
      assert.match(a.success_url, /purchase=/);
      assert.match(a.cancel_url, /cancelled=1/);
      assert.equal(a.line_items[0].currency, 'PHP');
      const id = `cs_fixture_${++created}`;
      sessions.set(id, { reference: a.reference_number, amount: a.line_items[0].amount, paid: false });
      await new Promise((resolve) => setTimeout(resolve, 30));
      // v2 creation intentionally has no reference_number; v1 retrieval does.
      return Response.json({
        data: {
          id,
          type: 'checkout_session',
          attributes: { livemode: false, checkout_url: `https://checkout.paymongo.com/${id}` },
        },
      });
    }
    const id = url.split('/').pop()!;
    const row = sessions.get(id)!;
    const paymentAmount = row.unsafe ? row.amount - 1 : row.amount;
    return Response.json({
      data: {
        id,
        type: 'checkout_session',
        attributes: {
          livemode: false,
          reference_number: row.reference,
          status: 'active',
          payment_intent: row.paid
            ? {
                id: `pi_${id}`,
                type: 'payment_intent',
                attributes: { livemode: false, status: 'succeeded', amount: row.amount, currency: 'PHP' },
              }
            : null,
          payments: row.paid
            ? [
                {
                  id: `pay_${id}`,
                  type: 'payment',
                  attributes: {
                    livemode: false,
                    status: 'paid',
                    amount: paymentAmount,
                    currency: 'PHP',
                    paid_at: Math.floor(Date.now() / 1000),
                    payment_intent_id: `pi_${id}`,
                    disputed: false,
                    refunds: [],
                  },
                },
              ]
            : [],
        },
      },
    });
  }) as typeof fetch;
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const createUser = async (role: 'USER' | 'ADMIN' = 'USER') => {
    const id = `checkout-acceptance-${randomUUID()}`;
    users.push(id);
    await prisma.user.create({
      data: {
        id,
        email: `${id}@preview.invalid`,
        name: 'Checkout acceptance fixture',
        role,
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        passwordHash: 'not-a-real-login',
        userProfile: {
          create: {
            age: 26,
            biologicalSex: 'MALE',
            heightCm: 170,
            weightKg: 65,
            goal: 'MAINTAIN',
            activityLevel: 'SEDENTARY',
            dietaryPreference: 'OMNIVORE',
          },
        },
        membershipAccount: {
          create: {
            trialStartedAt: new Date(Date.now() - 30 * 86400000),
            createdAt: new Date(Date.now() - 31 * 86400000),
          },
        },
      },
    });
    return id;
  };
  const request = async (userId: string | null, path: string, body?: unknown) => {
    const token = userId
      ? jwt.sign({ userId, role: userId === admin ? 'ADMIN' : 'USER' }, process.env.JWT_SECRET!, { expiresIn: '15m' })
      : null;
    const response = await realFetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return {
      status: response.status,
      body: (await response.json()) as { data: ReturnType<typeof MembershipCheckoutService.view> },
    };
  };
  let admin = '';
  try {
    const user = await createUser();
    const other = await createUser();
    admin = await createUser('ADMIN');
    const selection = { tier: 'LIFESTYLE', period: 'MONTHLY', requestKey: randomUUID() };
    assert.equal((await request(null, '/user/membership/checkout', selection)).status, 401);
    assert.equal((await request(admin, '/user/membership/checkout', selection)).status, 403);
    assert.equal((await request(user, '/user/membership/checkout', { ...selection, amount: 1 })).status, 400);
    const concurrent = await Promise.all([
      request(user, '/user/membership/checkout', selection),
      request(user, '/user/membership/checkout', selection),
    ]);
    assert.equal(created, 1);
    assert.ok(concurrent.every((r) => r.status === 200 || r.status === 409));
    const checkout = concurrent.find((r) => r.status === 200)!.body.data;
    assert.equal(checkout.amountCentavos, 24900);
    assert.equal((await request(user, '/user/membership/checkout', selection)).body.data.id, checkout.id);
    assert.equal((await request(other, `/user/membership/checkout/${checkout.id}`)).status, 404);
    assert.equal((await request(user, '/user/membership/checkout', { ...selection, tier: 'HEALTH' })).status, 409);
    assert.equal((await request(user, `/user/membership/checkout/${checkout.id}?paid=true`)).body.data.status, 'OPEN');
    assert.equal((await MembershipService.state(user)).tier, 'FREE');
    const ledger = await prisma.membershipTestCheckout.findUniqueOrThrow({ where: { id: checkout.id } });
    sessions.get(ledger.providerSessionId!)!.paid = true;
    const paid = await Promise.all([
      MembershipCheckoutService.reconcile(ledger.id),
      MembershipCheckoutService.reconcile(ledger.id),
    ]);
    assert.ok(paid.every((row) => row.status === 'PAID'));
    assert.equal((await MembershipService.state(user)).tier, 'LIFESTYLE');
    assert.equal(await prisma.notification.count({ where: { userId: user, type: 'MEMBERSHIP_UPDATED' } }), 1);
    assert.equal(await prisma.membershipGrant.count({ where: { userId: user } }), 0);

    const body = Buffer.from(
      JSON.stringify({
        data: {
          attributes: {
            type: 'checkout_session.payment.paid',
            livemode: false,
            data: { id: ledger.providerSessionId, type: 'checkout_session' },
          },
        },
      })
    );
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', process.env.PAYMONGO_WEBHOOK_SECRET!)
      .update(`${timestamp}.`)
      .update(body)
      .digest('hex');
    const webhook = async (sig: string, bytes = body) =>
      realFetch(base + '/payments/paymongo/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Paymongo-Signature': sig },
        body: bytes,
      });
    assert.equal((await webhook(`t=${timestamp},li=${signature}`)).status, 401);
    assert.equal((await webhook(`t=${timestamp},te=${signature}`, Buffer.from(body.toString() + ' '))).status, 401);
    assert.equal((await webhook(`t=${timestamp},te=${signature}`)).status, 200);
    assert.equal(await prisma.notification.count({ where: { userId: user, type: 'MEMBERSHIP_UPDATED' } }), 1);

    // A customer need not return to the app: a signed notification verifies payment independently.
    const webhookOnly = (await request(other, '/user/membership/checkout', { ...selection, requestKey: randomUUID() }))
      .body.data;
    const webhookLedger = await prisma.membershipTestCheckout.findUniqueOrThrow({ where: { id: webhookOnly.id } });
    sessions.get(webhookLedger.providerSessionId!)!.paid = true;
    const webhookBody = Buffer.from(
      JSON.stringify({
        data: {
          attributes: {
            type: 'checkout_session.payment.paid',
            livemode: false,
            data: { id: webhookLedger.providerSessionId, type: 'checkout_session' },
          },
        },
      })
    );
    const webhookSignature = createHmac('sha256', process.env.PAYMONGO_WEBHOOK_SECRET!)
      .update(`${timestamp}.`)
      .update(webhookBody)
      .digest('hex');
    assert.equal((await webhook(`t=${timestamp},te=${webhookSignature}`, webhookBody)).status, 200);
    assert.equal((await MembershipService.state(other)).tier, 'LIFESTYLE');
    assert.equal(await prisma.notification.count({ where: { userId: other, type: 'MEMBERSHIP_UPDATED' } }), 1);

    const health = (
      await request(user, '/user/membership/checkout', { tier: 'HEALTH', period: 'YEARLY', requestKey: randomUUID() })
    ).body.data;
    assert.equal(health.amountCentavos, 1439000);
    const healthLedger = await prisma.membershipTestCheckout.findUniqueOrThrow({ where: { id: health.id } });
    const providerHealth = sessions.get(healthLedger.providerSessionId!)!;
    providerHealth.paid = true;
    providerHealth.unsafe = true;
    await assert.rejects(() => MembershipCheckoutService.reconcile(health.id));
    assert.equal((await MembershipService.state(user)).tier, 'LIFESTYLE');
    providerHealth.unsafe = false;
    await MembershipCheckoutService.reconcile(health.id);
    assert.equal((await MembershipService.state(user)).tier, 'HEALTH');
    const renewal = (
      await request(user, '/user/membership/checkout', { tier: 'HEALTH', period: 'MONTHLY', requestKey: randomUUID() })
    ).body.data;
    const renewalLedger = await prisma.membershipTestCheckout.findUniqueOrThrow({ where: { id: renewal.id } });
    sessions.get(renewalLedger.providerSessionId!)!.paid = true;
    const renewed = await MembershipCheckoutService.reconcile(renewal.id);
    assert.equal(
      renewed.effectiveFrom,
      (
        await prisma.membershipTestCheckout.findUniqueOrThrow({ where: { id: health.id } })
      ).effectiveUntil!.toISOString()
    );

    process.env.PAYMONGO_INTEGRATION_ENABLED = 'false';
    assert.equal((await MembershipService.state(user)).tier, 'FREE');
    assert.equal((await request(user, '/user/membership/checkout', selection)).status, 503);
    process.env.PAYMONGO_INTEGRATION_ENABLED = 'true';
    providerFailure = true;
    assert.equal(
      (await request(other, '/user/membership/checkout', { ...selection, requestKey: randomUUID() })).status,
      502
    );
    assert.equal(await prisma.membershipGrant.count({ where: { userId: { in: users } } }), 0);
    console.log(
      'PASS: authenticated selection, server prices, concurrent idempotency, ownership, unpaid/cancelled returns, provider evidence, duplicate reconciliation and signed webhook, one live notification, tier upgrade, renewal dates, disabled-test isolation and provider failure.'
    );
  } finally {
    globalThis.fetch = realFetch;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(
    'Synthetic checkout acceptance failed:',
    error instanceof Error ? error.message : 'Unknown assertion failure'
  );
  process.exitCode = 1;
});

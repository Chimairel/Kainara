/** Only synthetic periods in the disposable history database; never reads shared member records. */
import assert from 'node:assert/strict';
import prisma from '../src/lib/prisma';
import { MembershipHistoryService } from '../src/services/membership-history.service';
import { testCheckoutConfig } from '../src/domain/membership-checkout.policy';

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55485');
  assert.equal(target.pathname, '/kainara_membership_history_test');
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(await prisma.user.count(), 0, 'Use a fresh task-owned database.');
  process.env.MEMBERSHIP_ENABLED = 'true';
  process.env.PAYMONGO_INTEGRATION_ENABLED = 'true';
  process.env.PAYMONGO_ENVIRONMENT = 'TEST';
  process.env.PAYMONGO_SECRET_KEY = 'sk_test_synthetic_membership_history_fixture';
  process.env.FRONTEND_URL = 'http://localhost:3000';
  const hash = testCheckoutConfig()!.accountHash;
  const at = new Date('2026-10-09T00:00:00Z');
  for (const [id, role] of [
    ['member', 'USER'],
    ['other', 'USER'],
    ['admin', 'ADMIN'],
    ['rnd', 'NUTRITIONIST'],
  ] as const) {
    await prisma.user.create({
      data: {
        id,
        email: `${id}@example.test`,
        name: `Synthetic ${id}`,
        role,
        emailVerified: true,
        passwordHash: 'unused-synthetic-hash',
      },
    });
  }
  await prisma.membershipAccount.create({
    data: {
      userId: 'member',
      trialStartedAt: new Date('2026-08-01T00:00:00Z'),
      createdAt: new Date('2026-08-01T00:00:00Z'),
    },
  });
  await prisma.membershipAccount.create({ data: { userId: 'other' } });
  await prisma.membershipGrant.create({
    data: {
      id: 'grant',
      userId: 'member',
      source: 'ADMIN_ADJUSTMENT',
      evidenceReference: 'synthetic-history-grant',
      verifiedAt: at,
      tier: 'HEALTH',
      effectiveFrom: at,
      effectiveUntil: new Date('2026-11-09T00:00:00Z'),
      createdAt: new Date('2026-09-01T00:00:00Z'),
    },
  });
  for (const [index, status] of ['PAID', 'PAID', 'PAID', 'REVIEW', 'OPEN', 'CLOSED', 'FAILED'].entries()) {
    await prisma.membershipTestCheckout.create({
      data: {
        id: `checkout-${index}`,
        userId: 'member',
        tier: 'HEALTH',
        period: 'MONTHLY',
        requestKey: `fixture-${index}`,
        amountCentavos: index ? 99900 : 0,
        accountHash: hash,
        status: status as 'PAID' | 'REVIEW' | 'OPEN' | 'CLOSED' | 'FAILED',
        verifiedAt: at,
        paidAt: at,
        providerPaymentId: `synthetic-history-payment-${index}`,
        createdAt: new Date(`2026-10-0${index + 1}T00:00:00Z`),
        effectiveFrom: new Date('2026-10-01T00:00:00Z'),
        effectiveUntil: new Date('2026-11-01T00:00:00Z'),
        ...(index === 0 ? { supersededAt: at } : index === 1 ? { revokedAt: at } : {}),
      },
    });
  }
  const first = await MembershipHistoryService.history('member', 'member', { page: 1, limit: 3 }, at);
  assert.equal(first.total, 6);
  assert.equal(first.totalPages, 2);
  assert.deepEqual(
    first.rows.map((row) => row.id),
    ['trial:member', 'grant:grant', 'checkout:checkout-0']
  );
  assert.equal(first.rows[0].plan, 'Free Health Plan');
  assert.equal(first.rows[0].status, 'ENDED');
  assert.equal(first.rows[0].endsAt, '2026-08-31T00:00:00.000Z');
  assert.equal(first.rows[2].status, 'REPLACED');
  assert.equal(first.rows[2].amountCentavos, 0);
  const second = await MembershipHistoryService.history('admin', 'member', { page: 2, limit: 3 }, at);
  assert.deepEqual(
    second.rows.map((row) => row.status),
    ['REVOKED', 'ACTIVE', 'PAYMENT_REVIEW']
  );
  const adminCopy = await MembershipHistoryService.history('admin', 'member', { page: 1, limit: 3 }, at);
  assert.deepEqual(adminCopy, first);
  const before = await prisma.user.count();
  const members = await MembershipHistoryService.members('admin', { page: 1, limit: 10, search: 'MEMBER' });
  assert.deepEqual(
    members.rows.map((member) => member.id),
    ['member']
  );
  assert.ok(!JSON.stringify(first).includes(hash));
  assert.ok(!JSON.stringify(first).includes('providerPaymentId'));
  for (const [actor, member] of [
    ['other', 'member'],
    ['rnd', 'member'],
  ]) {
    await assert.rejects(MembershipHistoryService.history(actor, member, { page: 1, limit: 10 }, at), {
      statusCode: 403,
    });
  }
  await assert.rejects(MembershipHistoryService.members('member', { page: 1, limit: 10 }), { statusCode: 403 });
  await assert.rejects(MembershipHistoryService.history('admin', 'rnd', { page: 1, limit: 10 }, at), {
    statusCode: 404,
  });
  const pending = await MembershipHistoryService.history('other', 'other', { page: 1, limit: 10 }, at);
  assert.equal(pending.rows[0].status, 'NOT_STARTED');
  assert.equal(pending.rows[0].startsAt, null);
  process.env.PAYMONGO_INTEGRATION_ENABLED = 'false';
  const archived = await MembershipHistoryService.history('member', 'member', { page: 2, limit: 3 }, at);
  assert.equal(archived.rows[1].status, 'RECORDED');
  await prisma.user.update({ where: { id: 'admin' }, data: { role: 'USER' } });
  await assert.rejects(MembershipHistoryService.history('admin', 'member', { page: 1, limit: 10 }, at), {
    statusCode: 403,
  });
  await prisma.user.update({ where: { id: 'member' }, data: { isSuspended: true } });
  await assert.rejects(MembershipHistoryService.history('member', 'member', { page: 1, limit: 10 }, at), {
    statusCode: 403,
  });
  assert.equal(await prisma.user.count(), before);
  assert.equal(await prisma.mealPlan.count(), 0);
  console.log(
    'Membership history SQL acceptance passed: period ordering/pagination, shared presentation, read scope, historical configuration and inactive accounts.'
  );
}
main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Acceptance failed');
    process.exitCode = 1;
  });

import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import prisma from '../src/lib/prisma';
import authenticate from '../src/middleware/auth';
import requireRole from '../src/middleware/rbac';
import { errorHandler } from '../src/middleware/errorHandler';
import { signAccessToken } from '../src/lib/jwt';
import { adminMembershipHistoryRouter, memberHistoryRouter } from '../src/routes/membership-history.routes';
import { MembershipHistoryService } from '../src/services/membership-history.service';
import { membershipHistoryEntry, type MembershipHistoryRecord } from '../src/domain/membership-history.policy';

const at = new Date('2026-10-09T00:00:00Z');
const record: MembershipHistoryRecord = {
  id: 'saved',
  kind: 'CHECKOUT',
  tier: 'HEALTH',
  period: 'MONTHLY',
  source: 'PAID',
  recordedAt: new Date('2026-09-01T00:00:00Z'),
  startsAt: new Date('2026-10-01T00:00:00Z'),
  endsAt: new Date('2026-10-31T00:00:00Z'),
  verifiedAt: new Date('2026-10-01T00:00:00Z'),
  revokedAt: null,
  supersededAt: null,
  amountCentavos: 0,
  currency: 'PHP',
  currentConfiguration: true,
};
test('history keeps the 30-day free introduction, unstarted access, zero test amounts and recorded dates', () => {
  const started = membershipHistoryEntry({ ...record, kind: 'TRIAL' }, at);
  assert.equal(started.plan, 'Free Health Plan');
  assert.equal(started.period, '30 days');
  assert.equal(started.endsAt, '2026-10-31T00:00:00.000Z');
  const pending = membershipHistoryEntry({ ...record, kind: 'TRIAL', startsAt: null }, at);
  assert.equal(pending.status, 'NOT_STARTED');
  assert.equal(pending.startsAt, null);
  assert.equal(pending.endsAt, null);
  const paid = membershipHistoryEntry(record, at);
  assert.equal(paid.status, 'ACTIVE');
  assert.equal(paid.amountCentavos, 0);
  assert.equal(paid.source, 'Test checkout');
});
test('history distinguishes expiration, scheduling, replacement, revocation and unconfirmed periods', () => {
  assert.equal(membershipHistoryEntry(record, record.endsAt!).status, 'ENDED');
  assert.equal(
    membershipHistoryEntry({ ...record, startsAt: new Date('2026-11-01T00:00:00Z') }, at).status,
    'SCHEDULED'
  );
  const replaced = membershipHistoryEntry({ ...record, supersededAt: at }, at);
  assert.equal(replaced.status, 'REPLACED');
  assert.equal(
    replaced.endsAt,
    record.endsAt!.toISOString(),
    'Keep the original promised end alongside replacement date'
  );
  assert.equal(replaced.supersededAt, at.toISOString());
  assert.equal(membershipHistoryEntry({ ...record, revokedAt: at }, at).status, 'REVOKED');
  assert.equal(membershipHistoryEntry({ ...record, verifiedAt: null }, at).status, 'UNCONFIRMED');
  assert.equal(membershipHistoryEntry({ ...record, source: 'REVIEW' }, at).status, 'PAYMENT_REVIEW');
  assert.equal(membershipHistoryEntry({ ...record, currentConfiguration: false }, at).status, 'RECORDED');
});
test('subscription routes enforce live roles, session-only member scope, pagination and read-only methods', async (t) => {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'synthetic-subscription-history-secret';
  t.after(() => {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  });
  let role = 'USER',
    suspended = false;
  const originalUserRead = prisma.user.findUnique;
  prisma.user.findUnique = (async () => ({
    role,
    email: 'synthetic@example.test',
    isSuspended: suspended,
  })) as unknown as typeof originalUserRead;
  t.after(() => {
    prisma.user.findUnique = originalUserRead;
  });
  const calls: unknown[][] = [];
  t.mock.method(MembershipHistoryService, 'history', async (...args: unknown[]) => {
    calls.push(args);
    return { rows: [] };
  });
  t.mock.method(MembershipHistoryService, 'members', async (...args: unknown[]) => {
    calls.push(args);
    return { rows: [] };
  });
  const app = express();
  app.use('/member', authenticate, requireRole('USER'), memberHistoryRouter);
  app.use('/admin', authenticate, requireRole('ADMIN'), adminMembershipHistoryRouter);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  await new Promise<void>((resolve) => server.on('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const headers = {
    authorization: `Bearer ${signAccessToken({ userId: 'actor', email: 'synthetic@example.test', role: 'USER' })}`,
  };
  assert.equal((await fetch(`${base}/member`)).status, 401);
  const own = await fetch(`${base}/member?page=2&limit=5`, { headers });
  assert.equal(own.status, 200);
  assert.equal(own.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(calls.pop(), ['actor', 'actor', { page: 2, limit: 5 }]);
  for (const filters of ['userId=other', 'limit=21', 'page=0', 'page=1.5', 'search=other'])
    assert.equal((await fetch(`${base}/member?${filters}`, { headers })).status, 400);
  assert.equal((await fetch(`${base}/admin/other`, { headers })).status, 403);
  role = 'NUTRITIONIST';
  assert.equal((await fetch(`${base}/member`, { headers })).status, 403);
  assert.equal((await fetch(`${base}/admin/members`, { headers })).status, 403);
  role = 'ADMIN';
  assert.equal((await fetch(`${base}/admin/other`, { headers })).status, 200);
  assert.deepEqual(calls.pop(), ['actor', 'other', { page: 1, limit: 10 }]);
  assert.equal((await fetch(`${base}/admin/members?search=Rosa`, { headers })).status, 200);
  assert.deepEqual(calls.pop(), ['actor', { page: 1, limit: 10, search: 'Rosa' }]);
  suspended = true;
  assert.equal((await fetch(`${base}/admin/other`, { headers })).status, 401);
  suspended = false;
  assert.equal((await fetch(`${base}/admin/other`, { headers, method: 'POST' })).status, 404);
});

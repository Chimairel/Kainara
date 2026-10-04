import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import prisma from '../src/lib/prisma';
import router from '../src/routes/admin-audit.routes';
import authenticate from '../src/middleware/auth';
import requireRole from '../src/middleware/rbac';
import { signAccessToken } from '../src/lib/jwt';
import { StaffAuditService, type StaffAuditFilters } from '../src/services/staff-audit.service';

test('admin audit is read-only, checks live roles, validates filters and derives My actions from the session', async (context) => {
  process.env.JWT_SECRET ||= 'synthetic-audit-secret';
  let role = 'ADMIN';
  const original = prisma.user.findUnique;
  prisma.user.findUnique = (async () => ({
    role,
    email: 'staff@example.invalid',
    isSuspended: false,
  })) as unknown as typeof original;
  context.after(() => {
    prisma.user.findUnique = original;
  });
  const calls: StaffAuditFilters[] = [];
  context.mock.method(StaffAuditService, 'history', async (filters: StaffAuditFilters) => {
    calls.push(filters);
    return { rows: [], total: 0, page: 1, limit: 20, totalPages: 0 };
  });
  const app = express();
  app.use('/audit', authenticate, requireRole('ADMIN'), router);
  const server = app.listen(0, '127.0.0.1');
  context.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  await new Promise<void>((resolve) => server.on('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/audit`;
  const headers = {
    authorization: `Bearer ${signAccessToken({ userId: 'admin', email: 'staff@example.invalid', role: 'ADMIN' })}`,
  };
  assert.equal((await fetch(base)).status, 401);
  for (const denied of ['USER', 'NUTRITIONIST']) {
    role = denied;
    assert.equal((await fetch(base, { headers })).status, 403);
    assert.equal((await fetch(`${base}/record/related`, { headers })).status, 403);
  }
  role = 'ADMIN';
  for (const invalid of [
    'from=2026-02-30',
    'from=2026-10-04&to=2026-10-03',
    'limit=9999',
    'page=0',
    'actorId=other',
    'view=member',
  ])
    assert.equal((await fetch(`${base}?${invalid}`, { headers })).status, 400);
  assert.equal(calls.length, 0);
  assert.equal((await fetch(`${base}?view=nutritionist&mine=true`, { headers })).status, 200);
  assert.equal(calls[0].actorId, 'admin');
  assert.equal(calls[0].view, 'nutritionist');
  assert.equal((await fetch(`${base}/record/related?page=2`, { headers })).status, 200);
  assert.equal(calls[1].relatedTo, 'record');
  assert.equal(calls[1].page, 2);
  assert.equal((await fetch(base, { headers, method: 'POST' })).status, 404);
});

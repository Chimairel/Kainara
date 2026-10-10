/** Application checks on the drill's isolated restored copy; never accepts a hosted target. */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import app from '../src/app';
import prisma from '../src/lib/prisma';
import { signAccessToken } from '../src/lib/jwt';

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.pathname, '/kainara_capstone_restore');
  assert.equal(process.env.CAPSTONE_RESTORE_DRILL, 'true');
  assert.equal(process.env.NODE_ENV, 'test');
  for (const key of ['GEMINI_API_KEY', 'SMTP_USER', 'BREVO_API_KEY', 'PAYMONGO_SECRET_KEY'])
    assert.equal(process.env[key] ?? '', '');
  const history = await prisma.clinicalProfileReview.findFirstOrThrow({ where: { reviewedAt: { not: null } } });
  const event = await prisma.auditEvent.findFirstOrThrow({
    where: { entityType: 'ClinicalProfileReview', entityId: history.id },
  });
  const actor = await prisma.user.create({
    data: {
      name: '[TEST RESTORE] Read-only oversight',
      email: `restore-${randomUUID()}@example.invalid`,
      passwordHash: 'NON_LOGIN_FIXTURE',
      role: 'ADMIN',
      emailVerified: true,
    },
  });
  const token = signAccessToken({ userId: actor.id, email: actor.email, role: actor.role });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    for (const route of ['/health', '/ready']) {
      const response = await fetch(base + route);
      assert.equal(response.status, 200);
    }
    const route = `/api/admin/audit-history/${event.id}/review-context`;
    assert.equal((await fetch(base + route)).status, 401);
    const response = await fetch(base + route, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const saved = ((await response.json()) as any).data;
    assert.deepEqual(saved.reviewedSnapshot, history.profileSnapshot);
    assert.equal(saved.decisions[0].id, history.id);
    assert.equal(
      await prisma.auditEvent.count({
        where: { actorUserId: actor.id, action: 'ADMIN_REVIEW_SENSITIVE_DETAILS_ACCESSED' },
      }),
      1
    );
    console.log(
      JSON.stringify({
        health: true,
        ready: true,
        anonymousDenied: true,
        immutableProfileAuditLoaded: true,
        sensitiveAccessRecorded: true,
        scope: 'Current API with the fully restored database and its migrated copy. No browser or provider execution.',
      })
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
main()
  .finally(() => prisma.$disconnect())
  .catch(() => {
    console.error('Restored API smoke failed; inspect the isolated drill log.');
    process.exitCode = 1;
  });

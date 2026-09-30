/** Connected HTTP authorization/privacy probes. Only explicit disposable loopback fixtures. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import app from '../src/app';
import prisma from '../src/lib/prisma';
import { signAccessToken } from '../src/lib/jwt';
import { ClinicalEvidenceService } from '../src/services/clinical-evidence.service';

type Inbox = { data: { notifications: { id: string; userId: string }[] } };
type AuditHistory = { data: { rows: { id: string; nutritionist: string }[] } };
const readJson = async <T>(response: Response): Promise<T> => (await response.json()) as T;

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(process.env.FULL_AUDIT_DISPOSABLE_DB, '1');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55463');
  assert.equal(target.pathname, '/nutrimind_browser_audit');
  assert.equal(process.env.NODE_ENV, 'test');
  assert.ok(process.env.BATCH10_BROWSER_RUN_ID);
  process.env.CLINICAL_DOCUMENT_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  const marker = randomUUID();
  const createdUsers: string[] = [];
  const notifications: string[] = [];
  const auditIds: string[] = [];
  let documentId: string | null = null;
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  try {
    const fixture = async (email: string) => prisma.user.findUniqueOrThrow({ where: { email } });
    const user = await fixture(`batch10-browser-user-${process.env.BATCH10_BROWSER_RUN_ID}@example.invalid`);
    const rnd = await fixture(`batch10-browser-nutritionist-${process.env.BATCH10_BROWSER_RUN_ID}@example.invalid`);
    const admin = await fixture(`batch10-browser-admin-${process.env.BATCH10_BROWSER_RUN_ID}@example.invalid`);
    const second = await fixture('nutritionist.lead1@gmail.com');
    const token = (account: typeof user, role = account.role) =>
      signAccessToken({ userId: account.id, email: account.email, role });
    const request = (path: string, account?: typeof user, method = 'GET', forgedRole?: typeof user.role) =>
      fetch(`${base}${path}`, {
        method,
        headers: account ? { Authorization: `Bearer ${token(account, forgedRole)}` } : {},
        signal: AbortSignal.timeout(15_000),
      });
    assert.equal((await request('/user/meals/current')).status, 401);
    assert.equal((await request('/admin/users', user)).status, 403);
    assert.equal((await request('/nutritionist/profile-work', user)).status, 403);
    assert.equal((await request('/user/meals/current', rnd)).status, 403);
    assert.equal((await request('/nutritionist/audit-history', admin)).status, 403);
    assert.equal(
      (await request('/admin/users', user, 'GET', 'ADMIN')).status,
      403,
      'A signed stale role claim must not override the live database role.'
    );
    const outsider = await prisma.user.create({
      data: {
        email: `http-audit-${marker}@example.invalid`,
        name: 'Disposable HTTP patient',
        passwordHash: 'disabled',
        emailVerified: true,
        healthConditions: { create: { condition: 'KIDNEY_DISEASE' } },
      },
    });
    createdUsers.push(outsider.id);
    const unavailable = await request('/user/meals/current', outsider);
    assert.equal(unavailable.status, 409, 'Incomplete onboarding must not authorize planning.');
    assert.equal((await readJson<{ errorCode: string }>(unavailable)).errorCode, 'ONBOARDING_REQUIRED');

    // The inbox is shared presentation across roles, with per-account storage/ownership.
    for (const account of [user, rnd, admin, outsider]) {
      const notification = await prisma.notification.create({
        data: { userId: account.id, title: marker, message: 'Synthetic audit notification', type: 'REVIEW_REQUEST' },
      });
      notifications.push(notification.id);
      const response = await request('/notifications', account);
      assert.equal(response.status, 200);
      const payload = await readJson<Inbox>(response);
      assert.ok(payload.data.notifications.some((item: { id: string }) => item.id === notification.id));
      assert.ok(payload.data.notifications.every((item: { userId: string }) => item.userId === account.id));
    }
    await request(`/notifications/${notifications[0]}/read`, outsider, 'PATCH');
    assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: notifications[0] } })).isRead, false);
    await request(`/notifications/${notifications[0]}/read`, user, 'PATCH');
    assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: notifications[0] } })).isRead, true);
    await prisma.user.update({ where: { id: outsider.id }, data: { isSuspended: true } });
    assert.equal((await request('/notifications', outsider)).status, 401);
    await prisma.user.update({ where: { id: outsider.id }, data: { isSuspended: false } });

    // Actual encrypted bytes remain inaccessible before claim, to another reviewer, and to admin/user routes.
    const document = await ClinicalEvidenceService.upload({
      userId: outsider.id,
      area: 'KIDNEY_DISEASE',
      documentType: 'MEDICAL_ABSTRACT',
      file: {
        buffer: Buffer.from('%PDF-1.7\nsynthetic HTTP document'),
        mimetype: 'application/pdf',
        originalname: 'http-audit.pdf',
      },
      consentAccepted: true,
    });
    documentId = document.id;
    const filePath = `/nutritionist/profile-work/${outsider.id}/documents/${document.id}/file`;
    assert.equal((await request(filePath, user)).status, 403);
    assert.equal((await request(filePath, admin)).status, 403);
    assert.equal((await request(filePath, rnd)).status, 409);
    const detail = await request(`/nutritionist/profile-work/${outsider.id}`, rnd);
    assert.equal(detail.status, 200);
    assert.equal(
      (await prisma.clinicalDocument.findUniqueOrThrow({ where: { id: document.id } })).claimedByNutritionistId,
      null
    );
    assert.equal(
      (await request(`/nutritionist/profile-work/${outsider.id}/documents/${document.id}`, rnd)).status,
      200
    );
    assert.equal(
      (await request(`/nutritionist/profile-work/${outsider.id}/documents/${document.id}`, second)).status,
      409
    );
    assert.equal((await request(filePath, second)).status, 409);
    const file = await request(filePath, rnd);
    assert.equal(file.status, 200);
    assert.equal(file.headers.get('cache-control'), 'private, no-store');
    assert.equal(file.headers.get('content-type'), 'application/pdf');
    assert.equal(await file.text(), '%PDF-1.7\nsynthetic HTTP document');
    assert.equal(
      await prisma.auditEvent.count({
        where: { actorUserId: rnd.id, action: 'CLINICAL_DOCUMENT_ACCESSED', entityId: document.id },
      }),
      1
    );

    // Cross-nutritionist audit attributes actors, excludes admin events and drops raw metadata.
    for (const account of [rnd, second, admin]) {
      const event = await prisma.auditEvent.create({
        data: {
          actorUserId: account.id,
          action: account.role === 'ADMIN' ? 'ACCOUNT_UPDATED' : 'BASE_MEAL_VERIFIED',
          entityType: 'RawRecipeCandidate',
          entityId: marker,
          metadata: { secretClinicalText: 'must not be returned' },
        },
      });
      auditIds.push(event.id);
    }
    const history = await request('/nutritionist/audit-history?page=1&limit=2', rnd);
    assert.equal(history.status, 200);
    const historyData = (await readJson<AuditHistory>(history)).data;
    assert.equal(historyData.rows.length, 2);
    assert.ok(historyData.rows.some((row: { nutritionist: string }) => row.nutritionist === second.name));
    assert.ok(historyData.rows.every((row: { id: string }) => row.id !== auditIds[2]));
    assert.ok(!JSON.stringify(historyData).includes('secretClinicalText'));
    const nextPage = (await readJson<AuditHistory>(await request('/nutritionist/audit-history?page=2&limit=2', rnd)))
      .data;
    assert.ok(
      nextPage.rows.every(
        (row: { id: string }) => !historyData.rows.some((first: { id: string }) => first.id === row.id)
      )
    );
    console.log(
      JSON.stringify({
        pass: true,
        checks: [
          'live role and suspension',
          'readiness',
          'all-role inbox ownership',
          'grouped document-only work',
          'claim conflicts and private file access logging',
          'audit actors, privacy and pagination',
        ],
      })
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.notification.deleteMany({ where: { id: { in: notifications } } });
    await prisma.auditEvent.deleteMany({
      where: { OR: [{ id: { in: auditIds } }, ...(documentId ? [{ entityId: documentId }] : [])] },
    });
    await prisma.user.deleteMany({ where: { id: { in: createdUsers } } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

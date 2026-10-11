import 'dotenv/config';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import prisma from '../src/lib/prisma';
import app from '../src/app';
import { signAccessToken } from '../src/lib/jwt';
import { licenseExpiryAtEndOfDay } from '../src/domain/nutritionist-license.policy';

async function main() {
  const target = new URL(process.env.DATABASE_URL!);
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.pathname, '/kainara_license_acceptance');
  assert.equal(process.env.LICENSE_ACCEPTANCE_DISPOSABLE, '1');
  const password = 'Asdqwe123';
  const passwordHash = await bcrypt.hash(password, 10);
  const marker = randomUUID().slice(0, 8);
  async function account(name: string, role: 'ADMIN' | 'NUTRITIONIST' | 'USER', expiry?: string, verified = true) {
    return prisma.user.create({
      data: {
        name: `License acceptance ${name}`,
        email: `license-${name}-${marker}@example.test`,
        role,
        emailVerified: true,
        tosAccepted: true,
        onboardingDone: true,
        passwordHash,
        ...(role === 'NUTRITIONIST'
          ? {
              nutritionistProfile: {
                create: {
                  prcLicenseNumber: `LICENSE-${name}-${marker}`,
                  prcLicenseExpiry: licenseExpiryAtEndOfDay(expiry!),
                  isVerified: verified,
                  verifiedAt: new Date(),
                  totalVerified: 7,
                },
              },
            }
          : {}),
      },
      include: { nutritionistProfile: true },
    });
  }
  const admin = await account('admin', 'ADMIN'),
    otherAdmin = await account('admin2', 'ADMIN');
  const expired = await account('expired', 'NUTRITIONIST', '2026-10-04');
  const active = await account('active', 'NUTRITIONIST', '2030-01-01');
  const stale = await account('stale', 'NUTRITIONIST', '2026-10-04');
  const suspended = await account('suspended', 'NUTRITIONIST', '2026-10-04');
  const unverified = await account('unverified', 'NUTRITIONIST', '2026-10-04', false);
  const member = await account('member', 'USER');
  const browserExpired = await account('browser-expired', 'NUTRITIONIST', '2026-10-04');
  const browserRejected = await account('browser-rejected', 'NUTRITIONIST', '2030-01-01');
  type Account = typeof admin;
  const token = (user: Account) => signAccessToken({ userId: user.id, role: user.role, email: user.email });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  async function request(user: Account, route: string, method = 'GET', body?: unknown) {
    return fetch(`${base}/api${route}`, {
      method,
      headers: {
        Authorization: `Bearer ${token(user)}`,
        ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}),
    });
  }
  const evidence = Buffer.from('%PDF-1.4\nSynthetic license evidence for integration tests.\n%%EOF');
  async function submit(
    user: Account,
    expiry = '2031-10-11',
    purpose = 'RENEWAL',
    invalidFile = false,
    oversized = false
  ) {
    const body = new FormData();
    body.set('purpose', purpose);
    body.set('licenseNumber', user.nutritionistProfile!.prcLicenseNumber);
    body.set('expiryDate', expiry);
    body.set('reason', 'Synthetic current credential evidence submitted for acceptance.');
    body.set('consentAccepted', 'true');
    body.set(
      'document',
      new Blob(
        [
          oversized
            ? Buffer.alloc(4 * 1024 * 1024 + 1)
            : invalidFile
              ? Buffer.from('<svg>not a license</svg>')
              : evidence,
        ],
        { type: 'application/pdf' }
      ),
      'synthetic-license.pdf'
    );
    return request(user, '/nutritionist/license-updates', 'POST', body);
  }
  async function decide(user: Account, id: string, decision: 'APPROVED' | 'REJECTED') {
    return request(user, `/admin/license-updates/${id}/decision`, 'POST', {
      decision,
      reason: 'Synthetic administrator checked the supplied credential evidence.',
    });
  }
  const passed: string[] = [];
  const checks = async (name: string, check: () => Promise<void>) => {
    await check();
    passed.push(name);
    console.log(`PASS ${name}`);
  };
  try {
    await checks('Expired RND can maintain a profile but cannot review; other roles are denied', async () => {
      assert.equal((await request(expired, '/nutritionist/profile')).status, 200);
      const status = (await (await request(expired, '/nutritionist/credential-status')).json()) as {
        data: { eligible: boolean; canSubmitUpdate: boolean };
      };
      assert.equal(status.data.eligible, false);
      assert.equal(status.data.canSubmitUpdate, true);
      const review = await request(expired, '/nutritionist/queue');
      assert.equal(review.status, 403);
      assert.equal(((await review.json()) as { errorCode: string }).errorCode, 'RND_LICENSE_EXPIRED');
      assert.equal((await request(member, '/nutritionist/license-updates')).status, 403);
      assert.equal((await request(expired, '/admin/license-updates')).status, 403);
      assert.equal((await submit(unverified)).status, 403);
    });
    await checks('Invalid and oversized evidence and expired proposals are rejected', async () => {
      assert.equal((await submit(stale, '2026-10-04')).status, 422);
      assert.equal((await submit(stale, '2031-10-11', 'RENEWAL', true)).status, 422);
      assert.equal((await submit(stale, '2031-10-11', 'RENEWAL', false, true)).status, 413);
    });
    const response = await submit(expired);
    assert.equal(response.status, 201);
    const renewal = ((await response.json()) as { data: { id: string } }).data;
    await checks('Pending update preserves old credentials and refuses duplicates', async () => {
      assert.equal((await submit(expired)).status, 409);
      const profile = await prisma.nutritionistProfile.findUniqueOrThrow({
        where: { id: expired.nutritionistProfile!.id },
      });
      assert.equal(profile.prcLicenseExpiry.getTime(), expired.nutritionistProfile!.prcLicenseExpiry.getTime());
      assert.equal((await request(expired, '/nutritionist/queue')).status, 403);
      const raw = await prisma.nutritionistLicenseUpdate.findUniqueOrThrow({ where: { id: renewal.id } });
      assert.notEqual(Buffer.from(raw.encryptedPayload).toString(), evidence.toString());
      await assert.rejects(
        prisma.nutritionistLicenseUpdate.create({ data: { ...raw, id: randomUUID() } }),
        /Unique constraint/
      );
      await assert.rejects(
        prisma.nutritionistLicenseUpdate.update({
          where: { id: renewal.id },
          data: {
            status: 'APPROVED',
            reviewerName: 'Invalid direct decision',
            reviewedAt: new Date(),
            decisionReason: null,
          },
        }),
        /NutritionistLicenseUpdate_decision_check/
      );
      assert.equal((await request(active, `/nutritionist/license-updates/${renewal.id}/document`)).status, 404);
      const list = await (await request(admin, '/admin/license-updates')).json();
      assert(!JSON.stringify(list).includes('encryptedPayload'));
      assert(!JSON.stringify(list).includes(evidence.toString()));
    });
    await checks('Approval requires audited evidence access and concurrent decisions commit once', async () => {
      assert.equal((await decide(admin, renewal.id, 'APPROVED')).status, 422);
      for (const actor of [admin, otherAdmin]) {
        const file = await request(actor, `/admin/license-updates/${renewal.id}/document`);
        assert.equal(file.status, 200);
        assert.equal(file.headers.get('cache-control'), 'private, no-store');
        assert.deepEqual(Buffer.from(await file.arrayBuffer()), evidence);
      }
      const results = await Promise.all([
        decide(admin, renewal.id, 'APPROVED'),
        decide(otherAdmin, renewal.id, 'APPROVED'),
      ]);
      assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
      assert.equal(
        await prisma.auditEvent.count({
          where: { entityId: renewal.id, action: 'NUTRITIONIST_LICENSE_UPDATE_APPROVED' },
        }),
        1
      );
      const profile = await prisma.nutritionistProfile.findUniqueOrThrow({
        where: { id: expired.nutritionistProfile!.id },
      });
      assert.equal(profile.prcLicenseExpiry.getTime(), licenseExpiryAtEndOfDay('2031-10-11').getTime());
      assert.equal(profile.totalVerified, 7);
      assert.equal((await request(expired, '/nutritionist/queue')).status, 200);
      assert.equal((await decide(admin, renewal.id, 'REJECTED')).status, 409);
    });
    await checks('Valid RND retains access while pending, and rejection preserves current credentials', async () => {
      const response = await submit(active);
      assert.equal(response.status, 201);
      const record = ((await response.json()) as { data: { id: string } }).data;
      assert.equal((await request(active, '/nutritionist/queue')).status, 200);
      assert.equal((await decide(admin, record.id, 'REJECTED')).status, 200);
      const profile = await prisma.nutritionistProfile.findUniqueOrThrow({
        where: { id: active.nutritionistProfile!.id },
      });
      assert.equal(profile.prcLicenseExpiry.getTime(), active.nutritionistProfile!.prcLicenseExpiry.getTime());
      assert.equal((await submit(active, '2029-01-01', 'CORRECTION')).status, 201);
    });
    await checks('Changed credentials and account suspension cannot be overwritten by approval', async () => {
      for (const owner of [stale, suspended]) {
        const response = await submit(owner);
        assert.equal(response.status, 201);
        const record = ((await response.json()) as { data: { id: string } }).data;
        await request(admin, `/admin/license-updates/${record.id}/document`);
        if (owner === stale)
          await prisma.nutritionistProfile.update({
            where: { id: owner.nutritionistProfile!.id },
            data: { prcLicenseExpiry: licenseExpiryAtEndOfDay('2028-02-01') },
          });
        else await prisma.user.update({ where: { id: owner.id }, data: { isSuspended: true } });
        assert.equal((await decide(admin, record.id, 'APPROVED')).status, owner === stale ? 409 : 403);
        assert.equal((await decide(admin, record.id, 'REJECTED')).status, 200);
      }
    });
    const directory = path.resolve(process.env.LICENSE_ACCEPTANCE_OUTPUT!);
    await mkdir(directory, { recursive: true });
    await writeFile(
      path.join(directory, 'http-acceptance.json'),
      JSON.stringify(
        {
          verifiedAt: new Date().toISOString(),
          database: `kainara_license_acceptance@${target.hostname}:${target.port}`,
          passed,
        },
        null,
        2
      )
    );
    await writeFile(
      path.join(directory, 'browser-fixtures.json'),
      JSON.stringify(
        {
          pid: process.pid,
          base,
          password,
          admin: admin.email,
          expired: browserExpired.email,
          active: browserRejected.email,
        },
        null,
        2
      )
    );
    console.log(`PASS ${passed.length} HTTP/database groups; browser fixtures saved privately.`);
    if (!process.argv.includes('--serve')) await new Promise<void>((resolve) => server.close(() => resolve()));
  } catch (error) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw error;
  }
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (!process.argv.includes('--serve') || process.exitCode) await prisma.$disconnect();
  });

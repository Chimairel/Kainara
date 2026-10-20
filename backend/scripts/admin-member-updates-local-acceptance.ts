/** Fresh disposable loopback database only; no external provider requests. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { writeFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';

async function main() {
  const target = new URL(process.env.DATABASE_URL!);
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55432');
  assert.match(target.pathname, /^\/kainara_nara_[a-f0-9]{8}$/);
  assert.equal(process.env.NODE_ENV, 'test');
  const { default: db } = await import('../src/lib/prisma');
  const { default: app } = await import('../src/app');
  const { signAccessToken } = await import('../src/lib/jwt');
  const { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } = await import('../src/domain/onboarding.policy');
  const { NUTRITION_GUIDANCE_POLICY_VERSION } = await import('../src/domain/deterministic-nutrition-report.policy');
  const { NaraActivityService } = await import('../src/services/nara-activity.service');
  assert.equal(await db.user.count(), 0);
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    assert.equal(new URL(String(input)).hostname, '127.0.0.1');
    return nativeFetch(input, init);
  };
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
    const actors = await Promise.all(
      (['ADMIN', 'NUTRITIONIST', 'USER'] as const).map(async (role) =>
        db.user.create({
          data: {
            email: `oct20-${role.toLowerCase()}@example.invalid`,
            name: `Synthetic ${role}`,
            role,
            passwordHash: await bcrypt.hash('Current123!', 4),
            passwordLoginEnabled: true,
            emailVerified: true,
            onboardingDone: true,
            tosAccepted: true,
            acceptedTermsVersion: CURRENT_TERMS_VERSION,
            acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
          },
        })
      )
    );
    const [admin, rnd, member] = actors;
    const call = async (actor: typeof admin | null, path: string, body?: unknown, method?: string) => {
      const response = await fetch(base + path, {
        method: method ?? (body ? 'POST' : 'GET'),
        headers: {
          'Content-Type': 'application/json',
          ...(actor
            ? { Authorization: 'Bearer ' + signAccessToken({ userId: actor.id, email: actor.email, role: actor.role }) }
            : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: response.status, body: (await response.json()) as any };
    };
    for (const actor of [null, rnd, member])
      assert.equal((await call(actor, '/admin/nara-answers/activity')).status, actor ? 403 : 401);
    const key = randomUUID(),
      message = 'hello from the activity acceptance check';
    for (let repeat = 0; repeat < 2; repeat++)
      assert.equal((await call(member, '/user/assistant/activity', { requestKey: key, message })).status, 201);
    assert.equal(await db.assistantMessageLog.count(), 1);
    assert.equal(
      (await call(member, '/user/assistant/activity', { requestKey: randomUUID(), message, context: [] })).status,
      400
    );
    assert.equal((await call(admin, '/user/assistant/activity', { requestKey: randomUUID(), message })).status, 403);
    const serverMessage = await call(member, '/user/assistant/messages', {
      requestKey: randomUUID(),
      message: 'hello',
      allowAi: false,
    });
    assert.equal(serverMessage.status, 200);
    assert.equal(serverMessage.body.data.reply.creditsUsed, 0);
    assert.equal(await db.assistantMessageLog.count(), 2);
    await db.assistantMessageLog.createMany({
      data: Array.from({ length: 27 }, (_, i) => ({
        userId: member.id,
        requestKey: randomUUID(),
        message: `paginated ${i}`,
        mode: 'STANDARD',
      })),
    });
    await db.assistantMessageLog.create({
      data: {
        userId: member.id,
        requestKey: randomUUID(),
        message: 'expired record',
        mode: 'STANDARD',
        createdAt: new Date(Date.now() - 31 * 86400000),
      },
    });
    const first = await call(admin, '/admin/nara-answers/activity');
    assert.equal(first.status, 200);
    assert.equal(first.body.data.items.length, 25);
    assert(first.body.data.nextCursor);
    const second = await call(admin, '/admin/nara-answers/activity?cursor=' + first.body.data.nextCursor);
    assert.equal(second.body.data.items.length, 4);
    assert.equal(new Set([...first.body.data.items, ...second.body.data.items].map((row) => row.id)).size, 29);
    const filtered = await call(admin, '/admin/nara-answers/activity?search=hello');
    assert.equal(filtered.body.data.items.length, 2);
    assert.equal(filtered.body.data.items[0].user.email, member.email);
    assert((await db.auditEvent.count({ where: { action: 'NARA_ACTIVITY_VIEWED' } })) >= 3);
    await NaraActivityService.purgeExpired();
    assert.equal(await db.assistantMessageLog.count({ where: { message: 'expired record' } }), 0);
    for (const staff of [admin, rnd]) {
      await db.session.create({
        data: { userId: staff.id, sessionToken: randomUUID(), expires: new Date(Date.now() + 86400000) },
      });
      assert.equal(
        (
          await call(
            staff,
            '/user/profile/settings',
            { currentPassword: 'Wrong123!', newPassword: 'Replacement123!' },
            'PUT'
          )
        ).status,
        400
      );
      assert.equal(await db.session.count({ where: { userId: staff.id } }), 1);
      const changed = await call(
        staff,
        '/user/profile/settings',
        { currentPassword: 'Current123!', newPassword: 'Replacement123!' },
        'PUT'
      );
      assert.equal(changed.status, 200);
      assert.equal(changed.body.data.requiresSignIn, true);
      assert.equal(await db.session.count({ where: { userId: staff.id } }), 0);
      assert(
        await bcrypt.compare(
          'Replacement123!',
          (await db.user.findUniqueOrThrow({ where: { id: staff.id } })).passwordHash
        )
      );
    }
    const media = {
      kind: 'image',
      publicId: 'nutrimind/landing/local-check',
      url: 'https://res.cloudinary.com/test/image/upload/local-check.jpg',
      width: 1200,
      height: 800,
      bytes: 1000,
      format: 'jpg',
      duration: null,
    };
    await db.websiteContent.create({
      data: { id: 'landing-hero', revision: 1, draft: { asset: media, poster: null, altText: 'Synthetic media' } },
    });
    const framing = { fit: 'contain', x: 30, y: 75 };
    assert.equal(
      (
        await call(
          member,
          '/admin/website-content/draft',
          { revision: 1, altText: 'Synthetic media', framing },
          'PATCH'
        )
      ).status,
      403
    );
    const saved = await call(
      admin,
      '/admin/website-content/draft',
      { revision: 1, altText: 'Synthetic media', framing },
      'PATCH'
    );
    assert.equal(saved.status, 200);
    assert.equal((await call(null, '/public/landing-media')).body.data, null);
    assert.equal(
      (await call(admin, '/admin/website-content/publish', { revision: saved.body.data.revision })).status,
      200
    );
    assert.deepEqual((await call(null, '/public/landing-media')).body.data.framing, framing);
    assert.equal(
      (
        await call(
          admin,
          '/admin/website-content/draft',
          { revision: 3, altText: 'Synthetic media', framing: { fit: 'cover', x: -1, y: 0 } },
          'PATCH'
        )
      ).status,
      400
    );
    const profile = await db.userProfile.create({
      data: {
        userId: member.id,
        age: 25,
        biologicalSex: 'MALE',
        heightCm: 170,
        weightKg: 65,
        targetWeightKg: 65,
        goal: 'MAINTAIN',
        activityLevel: 'SEDENTARY',
        dietaryPreference: 'OMNIVORE',
        dailyCalorieTarget: 2000,
        planningReportVersion: 1,
        revision: 1,
      },
    });
    const profileSnapshot = JSON.parse(
      JSON.stringify({ profile, conditions: [], allergens: [], otherConditions: '', otherAllergies: '' })
    );
    await db.nutritionReportVersion.create({
      data: {
        userId: member.id,
        version: 1,
        profileRevision: 1,
        profileSnapshot,
        content: {},
        acknowledgedAt: new Date(),
        policyVersion: NUTRITION_GUIDANCE_POLICY_VERSION,
      },
    });
    await db.nutritionReport.create({
      data: {
        userId: member.id,
        version: 1,
        profileRevision: 1,
        acknowledgedAt: new Date(),
        foodsToAvoid: [],
        foodsToLimit: [],
        foodsRecommended: [],
        drinksGuidance: [],
        generalSummary: 'Synthetic report',
        basedOnConditions: [],
        basedOnAllergies: [],
      },
    });
    assert.equal((await call(member, '/user/profile')).body.data.reportAcknowledged, true);
    const weight = await call(member, '/user/profile', { weightKg: 66 }, 'PUT');
    assert.equal(weight.status, 200);
    assert.equal(weight.body.data.reportAcknowledged, false);
    assert.equal((await call(member, '/user/profile')).body.data.reportAcknowledged, false);
    assert.equal((await call(member, '/user/meals/current')).status, 409);
    const report = await db.nutritionReport.findUniqueOrThrow({ where: { userId: member.id } });
    assert.equal(report.isStale, true);
    assert.equal(report.acknowledgedAt, null);
    // Simulate the saved acknowledged replacement snapshot; existing report HTTP tests cover the acknowledgement transaction.
    const updated = await db.userProfile.findUniqueOrThrow({ where: { userId: member.id } });
    await db.nutritionReportVersion.create({
      data: {
        userId: member.id,
        version: 2,
        profileRevision: updated.revision,
        profileSnapshot: JSON.parse(JSON.stringify({ ...profileSnapshot, profile: updated })),
        content: {},
        acknowledgedAt: new Date(),
        policyVersion: NUTRITION_GUIDANCE_POLICY_VERSION,
      },
    });
    await db.userProfile.update({ where: { userId: member.id }, data: { planningReportVersion: 2 } });
    assert.equal((await call(member, '/user/profile')).body.data.reportAcknowledged, true);
    const { UserPrivacyService } = await import('../src/services/user-privacy.service');
    assert.equal((await UserPrivacyService.exportAccount(member.id)).data.assistantMessageLogs.length, 29);
    await db.user.delete({ where: { id: member.id } });
    assert.equal(await db.assistantMessageLog.count(), 0);
    const receipt = {
      at: new Date().toISOString(),
      localOnly: true,
      submittedMessages: true,
      idempotency: true,
      pagination: true,
      retention: true,
      adminRoles: true,
      passwordVerificationAndRevocation: true,
      framingDraftAndPublish: true,
      weightReportGate: true,
      exportAndDeletion: true,
      providerCalls: 0,
    };
    if (process.env.NARA_ACCEPTANCE_RECEIPT)
      writeFileSync(process.env.NARA_ACCEPTANCE_RECEIPT, JSON.stringify(receipt, null, 2));
    console.log(JSON.stringify(receipt));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.$disconnect();
    globalThis.fetch = nativeFetch;
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

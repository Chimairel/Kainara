/** Destructive fixture creation is allowed only in this fresh task-owned loopback database. */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import type { Role } from '@prisma/client';
import app from '../src/app';
import db from '../src/lib/prisma';
import { signAccessToken } from '../src/lib/jwt';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '../src/domain/onboarding.policy';
import { MembershipService } from '../src/services/membership.service';
import { PlanningReadinessService } from '../src/services/planning-readiness.service';

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55432');
  assert.equal(target.pathname, '/kainara_food_exclusions_20261013');
  assert.equal(process.env.NODE_ENV, 'test');
  for (const key of ['GEMINI_API_KEY', 'SMTP_USER', 'BREVO_API_KEY', 'PAYMONGO_SECRET_KEY'])
    assert.equal(process.env[key] ?? '', '');
  assert.equal(await db.user.count(), 0, 'Use a fresh disposable database.');
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    assert.equal(new URL(String(input)).hostname, '127.0.0.1');
    return nativeFetch(input, init);
  };
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  let sequence = 0;
  const marker = randomUUID();
  const account = (role: Role) =>
    db.user.create({
      data: {
        role,
        name: `Synthetic ${role}`,
        email: `${marker}-${++sequence}@example.invalid`,
        passwordHash: 'NON_LOGIN_FIXTURE',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        acceptedTermsVersion: CURRENT_TERMS_VERSION,
        acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
        healthDataConsentedAt: new Date(),
      },
    });
  type Actor = Awaited<ReturnType<typeof account>>;
  const request = async (actor: Actor, route: string, method = 'GET', body?: unknown) => {
    const response = await fetch(base + route, {
      method,
      headers: {
        Authorization: `Bearer ${signAccessToken({ userId: actor.id, email: actor.email, role: actor.role })}`,
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: (await response.json()) as any };
  };
  const ok = async (promise: ReturnType<typeof request>) => {
    const result = await promise;
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body.data;
  };
  const passed: string[] = [];
  const pass = (name: string) => {
    passed.push(name);
    console.log(`PASS ${name}`);
  };
  const profile = async (member: Actor, heart = false, details = true) => {
    await db.userProfile.create({
      data: {
        userId: member.id,
        revision: 1,
        safetyRevision: 1,
        age: 28,
        heightCm: 170,
        weightKg: 65,
        goal: 'MAINTAIN',
        activityLevel: 'SEDENTARY',
        dietaryPreference: 'OMNIVORE',
        dailyCalorieTarget: 2000,
        otherConditions: 'Reviewed unrelated condition',
      },
    });
    const custom = await db.safetyProfileEntry.create({
      data: {
        userId: member.id,
        domain: 'CONDITION',
        canonicalCode: null,
        displayName: 'Reviewed unrelated condition',
        originalText: 'Reviewed unrelated condition',
        normalizedText: 'reviewed unrelated condition',
        provenance: 'CUSTOM',
        supportState: 'PENDING_REVIEW',
        policyReference: 'SYNTHETIC_UNMAPPED',
      },
    });
    await db.safetyProfileEntry.create({
      data: {
        userId: member.id,
        domain: 'ALLERGY',
        canonicalCode: heart ? 'NUTS' : 'NONE',
        displayName: heart ? 'Nuts' : 'None',
        originalText: heart ? 'Nuts' : 'None',
        normalizedText: heart ? 'nuts' : 'none',
        provenance: 'PREDEFINED',
        supportState: 'SUPPORTED',
        policyReference: 'SYNTHETIC_ALLERGY',
      },
    });
    if (heart) {
      await db.healthCondition.create({ data: { userId: member.id, condition: 'HEART_CONDITION' } });
      await db.allergy.create({ data: { userId: member.id, allergen: 'NUTS' } });
      await db.safetyProfileEntry.create({
        data: {
          userId: member.id,
          domain: 'CONDITION',
          canonicalCode: 'HEART_CONDITION',
          displayName: 'Heart condition',
          originalText: 'Heart condition',
          normalizedText: 'heart condition',
          provenance: 'PREDEFINED',
          supportState: 'RECOGNIZED_UNSUPPORTED',
          policyReference: 'SYNTHETIC_HEART',
        },
      });
    }
    if (details)
      for (const area of heart ? (['OTHER', 'HEART_CONDITION', 'FOOD_ALLERGY'] as const) : (['OTHER'] as const)) {
        await db.clinicalContextResponse.create({
          data: {
            userId: member.id,
            area,
            responses: {
              formVersion: 'HEALTH_DETAILS_V1',
              safetyRevision: 1,
              conditionDetails: 'Synthetic condition details',
              medications: 'No reported medications',
              dietaryAdvice: 'No reported restrictions',
              recentSymptoms: 'None reported',
              measurements: '',
            },
          },
        });
      }
    return custom;
  };
  const decision = (detail: any, ids: string[] = []) => ({
    decision: 'APPROVED',
    notes: 'Reviewed complete details and retained the declared restrictions.',
    profileRevision: detail.profileRevision,
    scopeKey: detail.scopeKey,
    reviewedDeclarationIds: ids,
  });
  try {
    const member = await account('USER'),
      mixed = await account('USER'),
      incomplete = await account('USER'),
      vague = await account('USER'),
      avoid = await account('USER'),
      conditionOnly = await account('USER');
    const rnd = await account('NUTRITIONIST'),
      other = await account('NUTRITIONIST'),
      admin = await account('ADMIN');
    for (const actor of [rnd, other])
      await db.nutritionistProfile.create({
        data: {
          userId: actor.id,
          isVerified: true,
          prcLicenseNumber: actor.id,
          prcLicenseExpiry: new Date('2099-01-01'),
        },
      });
    const named = await profile(member),
      known = await profile(mixed, true),
      missing = await profile(incomplete, false, false),
      unclear = await profile(vague),
      exclusion = await profile(avoid);
    await db.safetyProfileEntry.update({ where: { id: unclear.id }, data: { supportState: 'NEEDS_CLARIFICATION' } });
    await db.safetyProfileEntry.update({
      where: { id: exclusion.id },
      data: {
        domain: 'AVOIDED_INGREDIENT',
        canonicalCode: 'PORK',
        displayName: 'Pork',
        originalText: 'Pork',
        normalizedText: 'pork',
        supportState: 'RECOGNIZED_UNSUPPORTED',
      },
    });
    await db.userProfile.update({
      where: { userId: avoid.id },
      data: { otherConditions: null, otherAllergies: 'PORK' },
    });
    await db.safetyProfileEntry.create({
      data: {
        userId: avoid.id,
        domain: 'CONDITION',
        canonicalCode: 'NONE',
        displayName: 'None',
        originalText: 'None',
        normalizedText: 'none',
        provenance: 'PREDEFINED',
        supportState: 'SUPPORTED',
        policyReference: 'SYNTHETIC',
      },
    });
    const avoidanceStatus = await ok(request(avoid, '/user/clinical-profile-review/status'));
    assert.equal(avoidanceStatus.approved, true);
    assert.equal((await MembershipService.state(avoid.id)).requiresCaseReview, false);
    assert.equal((await PlanningReadinessService.getForUser(avoid.id)).canRequestPlan, true);
    pass('Persisted pork avoidance alone needs no profile confirmation or case-review membership');
    let detail = await ok(request(rnd, '/nutritionist/profile-reviews/' + member.id));
    assert.equal(detail.clarificationEntries[0].canReviewAsRecorded, true);
    const path = '/nutritionist/profile-reviews/' + member.id;
    assert.equal((await request(rnd, path + '/decision', 'POST', decision(detail, [named.id]))).status, 409);
    detail = await ok(request(rnd, path + '/claim', 'POST', {}));
    assert.equal((await request(rnd, path + '/decision', 'POST', decision(detail))).status, 422);
    assert.equal((await request(other, path + '/decision', 'POST', decision(detail, [named.id]))).status, 409);
    assert.equal((await request(member, path + '/decision', 'POST', decision(detail, [named.id]))).status, 403);
    assert.equal((await request(admin, path + '/decision', 'POST', decision(detail, [named.id]))).status, 403);
    assert.equal(
      (await request(rnd, path + '/decision', 'POST', { ...decision(detail, [named.id]), profileRevision: 0 })).status,
      409
    );
    for (const ids of [[known.id], [named.id, named.id]])
      assert.equal((await request(rnd, path + '/decision', 'POST', decision(detail, ids))).status, 422);
    pass(
      'Missing review selection, foreign declarations, duplicate IDs, roles, claims and stale revisions remain blocked'
    );
    const before = await db.safetyProfileEntry.findMany({ where: { userId: member.id }, orderBy: { id: 'asc' } });
    const beforeProfile = await db.userProfile.findUniqueOrThrow({ where: { userId: member.id } });
    const outcomes = await Promise.all(
      [0, 1].map(() => request(rnd, path + '/decision', 'POST', decision(detail, [named.id])))
    );
    assert.deepEqual(outcomes.map((x) => x.status).sort(), [200, 409]);
    const signed = outcomes.find((x) => x.status === 200)!.body.data;
    assert.deepEqual(
      await db.safetyProfileEntry.findMany({ where: { userId: member.id }, orderBy: { id: 'asc' } }),
      before
    );
    assert.deepEqual(await db.userProfile.findUniqueOrThrow({ where: { userId: member.id } }), beforeProfile);
    assert.equal((await ok(request(member, '/user/clinical-profile-review/status'))).approved, true);
    assert.equal(
      (await MembershipService.state(member.id)).requiresCaseReview,
      true,
      'Reviewing as recorded must retain manual case restrictions.'
    );
    const snapshot = (
      (await db.clinicalProfileReview.findUniqueOrThrow({ where: { id: signed.id } })).profileSnapshot as any
    ).reviewedDeclarations[0];
    assert.equal(snapshot.entryId, named.id);
    assert.equal(snapshot.result, 'REVIEWED_AS_RECORDED');
    assert.equal(
      snapshot.reviewerId,
      (await db.nutritionistProfile.findUniqueOrThrow({ where: { userId: rnd.id } })).id
    );
    assert.equal(await db.auditEvent.count({ where: { entityId: signed.id, action: 'CLINICAL_PROFILE_REVIEWED' } }), 1);
    assert.equal(await db.clinicalProfileProposal.count({ where: { userId: member.id } }), 0);
    pass(
      'Concurrent unchanged confirmation saves one signed review and audit; declarations, profile, restrictions and revision remain identical'
    );
    for (const [actor, entry] of [
      [incomplete, missing],
      [vague, unclear],
    ] as const) {
      const d = await ok(request(rnd, '/nutritionist/profile-reviews/' + actor.id + '/claim', 'POST', {}));
      assert.equal(
        (await request(rnd, '/nutritionist/profile-reviews/' + actor.id + '/decision', 'POST', decision(d, [entry.id])))
          .status,
        422
      );
    }
    pass('Reviewed-as-recorded cannot bypass missing evidence or vague declarations');
    const combined = await ok(request(rnd, '/nutritionist/profile-reviews/' + mixed.id + '/claim', 'POST', {}));
    await ok(
      request(rnd, '/nutritionist/profile-reviews/' + mixed.id + '/decision', 'POST', decision(combined, [known.id]))
    );
    assert.equal((await ok(request(mixed, '/user/clinical-profile-review/status'))).approved, true);
    assert.equal((await MembershipService.state(mixed.id)).requiresCaseReview, true);
    pass(
      'Complete heart-condition plus allergy details can be confirmed unchanged while individual meal review stays required'
    );
    const heart = await profile(conditionOnly);
    await db.safetyProfileEntry.update({
      where: { id: heart.id },
      data: {
        canonicalCode: 'HEART_CONDITION',
        supportState: 'RECOGNIZED_UNSUPPORTED',
        displayName: 'Heart condition',
      },
    });
    await db.healthCondition.create({ data: { userId: conditionOnly.id, condition: 'HEART_CONDITION' } });
    await db.safetyProfileEntry.create({
      data: {
        userId: conditionOnly.id,
        domain: 'AVOIDED_INGREDIENT',
        canonicalCode: 'PORK',
        displayName: 'Pork',
        originalText: 'Pork',
        normalizedText: 'pork',
        provenance: 'PREDEFINED',
        supportState: 'RECOGNIZED_UNSUPPORTED',
        policyReference: 'SYNTHETIC',
      },
    });
    await db.userProfile.update({
      where: { userId: conditionOnly.id },
      data: { otherConditions: null, otherAllergies: 'PORK' },
    });
    await db.clinicalContextResponse.update({
      where: { userId_area: { userId: conditionOnly.id, area: 'OTHER' } },
      data: { area: 'HEART_CONDITION' },
    });
    const heartDetail = await ok(
      request(rnd, '/nutritionist/profile-reviews/' + conditionOnly.id + '/claim', 'POST', {})
    );
    assert.deepEqual(heartDetail.clarificationEntryIds, []);
    assert.deepEqual(
      heartDetail.requirements.map((item: any) => item.area),
      ['HEART_CONDITION']
    );
    await ok(
      request(rnd, '/nutritionist/profile-reviews/' + conditionOnly.id + '/decision', 'POST', decision(heartDetail))
    );
    pass(
      'Named condition with complete details confirms without correction or an extra allergy form for pork avoidance'
    );
    console.log(JSON.stringify({ database: target.pathname.slice(1), passed: passed.length, checks: passed }));
  } finally {
    globalThis.fetch = nativeFetch;
    server.close();
    await once(server, 'close');
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

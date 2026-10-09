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
import { ClinicalProfileReviewService } from '../src/services/clinical-profile-review.service';
import { lockUserProfile, advanceProfileRevision } from '../src/services/profile-revision.service';

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55488');
  assert.equal(target.pathname, '/kainara_clarifications');
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(process.env.CLINICAL_CLARIFICATIONS_ENABLED, 'true');
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
  try {
    const member = await account('USER'),
      foreign = await account('USER');
    const rnd = await account('NUTRITIONIST'),
      next = await account('NUTRITIONIST'),
      expired = await account('NUTRITIONIST'),
      admin = await account('ADMIN');
    for (const actor of [rnd, next, expired])
      await db.nutritionistProfile.create({
        data: {
          userId: actor.id,
          isVerified: true,
          prcLicenseNumber: actor.id,
          prcLicenseExpiry: new Date(actor.id === expired.id ? '2020-01-01' : '2099-01-01'),
        },
      });
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
      },
    });
    await db.healthCondition.create({ data: { userId: member.id, condition: 'DIABETES' } });
    for (const [domain, code] of [
      ['CONDITION', 'DIABETES'],
      ['ALLERGY', 'NONE'],
    ] as const)
      await db.safetyProfileEntry.create({
        data: {
          userId: member.id,
          domain,
          canonicalCode: code,
          displayName: code,
          originalText: code,
          normalizedText: code.toLowerCase(),
          provenance: 'PREDEFINED',
          supportState: 'SUPPORTED',
          policyReference: 'SYNTHETIC_DETAILS',
        },
      });
    await db.clinicalContextResponse.create({
      data: {
        userId: member.id,
        area: 'DIABETES',
        responses: {
          formVersion: 'HEALTH_DETAILS_V1',
          safetyRevision: 1,
          conditionDetails: 'Synthetic diagnosis details',
          medications: 'No reported medications',
          dietaryAdvice: 'No reported restrictions',
          recentSymptoms: 'None reported',
          measurements: '',
        },
      },
    });
    const before = await db.userProfile.findUniqueOrThrow({ where: { userId: member.id } });
    const route = `/nutritionist/profile-reviews/${member.id}`;
    let detail = await ok(request(rnd, route));
    const expected = () => ({ profileRevision: detail.profileRevision, scopeKey: detail.scopeKey });
    const publish = {
      ...expected(),
      title: 'Clarify diagnosis details',
      questions: [
        { id: 'diagnosis', type: 'TEXT', label: 'What diagnosis is recorded?', required: true },
        {
          id: 'changed',
          type: 'CHOICE',
          label: 'Has this information changed?',
          required: true,
          options: ['Yes', 'No'],
        },
      ],
      requestKey: randomUUID(),
    };
    assert.equal((await request(rnd, route + '/clarifications', 'POST', publish)).status, 409);
    assert.equal((await request(member, route + '/clarifications', 'POST', publish)).status, 403);
    assert.equal((await request(admin, route + '/clarifications', 'POST', publish)).status, 403);
    assert.equal((await request(expired, route + '/claim', 'POST', {})).status, 403);
    pass('Publishing requires a current claim, staff role and eligible credentials');
    detail = await ok(request(rnd, route + '/claim', 'POST', {}));
    const form = await ok(request(rnd, route + '/clarifications', 'POST', publish));
    assert.equal((await ok(request(rnd, route + '/clarifications', 'POST', publish))).id, form.id);
    assert.equal(await db.clinicalClarificationForm.count(), 1);
    assert.equal(
      await db.notification.count({ where: { userId: member.id, title: 'An RND requested clarification' } }),
      1
    );
    assert.equal(
      (await request(rnd, route + '/clarifications', 'POST', { ...publish, title: 'Different question set' })).status,
      409
    );
    assert.deepEqual(await db.userProfile.findUniqueOrThrow({ where: { userId: member.id } }), before);
    pass('Publishing/retry creates one immutable form and notification without altering the profile');
    assert.equal((await ok(request(rnd, '/nutritionist/profile-work')))[0].profileStatus, 'AWAITING_MEMBER');
    const confirmation = { ...expected(), decision: 'APPROVED', notes: 'Reviewed all current clinical details.' };
    assert.equal((await request(rnd, route + '/decision', 'POST', confirmation)).status, 422);
    await assert.rejects(() => ClinicalProfileReviewService.assertReadyForMealPlanning(member.id));
    pass('Unresolved clarification blocks profile confirmation and planning');
    const answer = {
      ...expected(),
      answers: { diagnosis: 'Synthetic recorded diagnosis', changed: 'No' },
      expectedResponseId: null,
      requestKey: randomUUID(),
    };
    const answerRoute = `/user/clinical-clarifications/${form.id}/answers`;
    assert.equal((await request(foreign, answerRoute, 'POST', answer)).status, 404);
    assert.equal((await request(rnd, answerRoute, 'POST', answer)).status, 403);
    assert.equal(
      (await request(member, answerRoute, 'POST', { ...answer, answers: { diagnosis: '', changed: 'No' } })).status,
      422
    );
    assert.equal(
      (await request(member, answerRoute, 'POST', { ...answer, answers: { diagnosis: 'Answer', changed: 'Maybe' } }))
        .status,
      422
    );
    assert.equal(
      (
        await request(member, answerRoute, 'POST', {
          ...answer,
          answers: { ...answer.answers, profileCondition: 'NONE' },
        })
      ).status,
      422
    );
    pass('Member ownership and required/choice/unknown-field validation are enforced');
    await db.clinicalProfileReview.updateMany({
      where: { userId: member.id },
      data: { claimedAt: new Date(Date.now() - 31 * 60_000) },
    });
    const response = await ok(request(member, answerRoute, 'POST', answer));
    assert.equal((await ok(request(member, answerRoute, 'POST', answer))).id, response.id);
    assert.equal(await db.clinicalClarificationResponse.count(), 1);
    assert.equal((await ok(request(rnd, '/nutritionist/profile-work')))[0].profileStatus, 'CLARIFICATION_ANSWERED');
    detail = await ok(request(next, route + '/claim', 'POST', {}));
    assert.equal(detail.clarifications.forms[0].responses[0].answers.diagnosis, answer.answers.diagnosis);
    pass('A late member response survives expiry and is visible to the next claimant');
    const resolution = {
      ...expected(),
      responseId: response.id,
      rationale: 'Reviewed the submitted clarification in the current profile context.',
    };
    assert.equal((await request(rnd, route + `/clarifications/${form.id}/resolve`, 'POST', resolution)).status, 409);
    const secondResponse = await ok(
      request(member, answerRoute, 'POST', {
        ...answer,
        expectedResponseId: response.id,
        answers: { diagnosis: 'Corrected synthetic diagnosis detail', changed: 'No' },
        requestKey: randomUUID(),
      })
    );
    assert.equal((await request(next, route + `/clarifications/${form.id}/resolve`, 'POST', resolution)).status, 409);
    const currentResolution = { ...resolution, responseId: secondResponse.id };
    const resolved = await ok(request(next, route + `/clarifications/${form.id}/resolve`, 'POST', currentResolution));
    assert.equal(
      (await ok(request(next, route + `/clarifications/${form.id}/resolve`, 'POST', currentResolution))).id,
      resolved.id
    );
    assert.equal(await db.clinicalClarificationResolution.count(), 1);
    const savedForm = (await ok(request(member, '/user/clinical-evidence'))).clarifications.forms[0];
    assert.equal(savedForm.responses.length, 2);
    assert.equal(savedForm.responses[0].answers.diagnosis, answer.answers.diagnosis);
    assert.equal(savedForm.resolution.responseId, secondResponse.id);
    assert.equal(
      (
        await request(member, answerRoute, 'POST', {
          ...answer,
          expectedResponseId: secondResponse.id,
          requestKey: randomUUID(),
        })
      ).status,
      409
    );
    assert.deepEqual(await db.userProfile.findUniqueOrThrow({ where: { userId: member.id } }), before);
    pass('Resolution binds to the latest immutable answer and never alters profile/acknowledgment');
    const audit = await db.auditEvent.findFirstOrThrow({
      where: { entityId: form.id, action: 'CLINICAL_CLARIFICATION_RESOLVED' },
    });
    const auditContext = await ok(request(admin, `/admin/audit-history/${audit.id}/review-context`));
    assert.equal(auditContext.decisions.length, 3);
    assert.equal(auditContext.reviewedSnapshot.questions.length, 2);
    assert.equal(
      await db.auditEvent.count({ where: { action: 'ADMIN_REVIEW_SENSITIVE_DETAILS_ACCESSED', entityId: form.id } }),
      1
    );
    assert.equal((await request(member, `/admin/audit-history/${audit.id}/review-context`)).status, 403);
    pass('Admin related-case access shows question/answer/resolution history and records sensitive access');
    const concurrentForm = await ok(
      request(next, route + '/clarifications', 'POST', { ...publish, requestKey: randomUUID() })
    );
    const concurrentRoute = `/user/clinical-clarifications/${concurrentForm.id}/answers`;
    const outcomes = await Promise.all([
      request(member, concurrentRoute, 'POST', { ...answer, requestKey: randomUUID() }),
      request(member, concurrentRoute, 'POST', { ...answer, requestKey: randomUUID() }),
    ]);
    assert.deepEqual(outcomes.map((r) => r.status).sort(), [200, 409]);
    assert.equal(await db.clinicalClarificationResponse.count({ where: { formId: concurrentForm.id } }), 1);
    pass('Concurrent submissions cannot silently overwrite one another');
    const raceResponse = await db.clinicalClarificationResponse.findFirstOrThrow({
      where: { formId: concurrentForm.id },
    });
    const race = await Promise.all([
      request(member, concurrentRoute, 'POST', {
        ...answer,
        expectedResponseId: raceResponse.id,
        requestKey: randomUUID(),
        answers: { diagnosis: 'New evidence arriving during review', changed: 'No' },
      }),
      request(next, route + `/clarifications/${concurrentForm.id}/resolve`, 'POST', {
        ...expected(),
        responseId: raceResponse.id,
        rationale: 'Reviewed this exact submitted version while holding the profile claim.',
      }),
    ]);
    assert.deepEqual(race.map((result) => result.status).sort(), [200, 409]);
    const raceForm = await db.clinicalClarificationForm.findUniqueOrThrow({
      where: { id: concurrentForm.id },
      include: { responses: { orderBy: { version: 'asc' } }, resolution: true },
    });
    if (raceForm.resolution) assert.equal(raceForm.resolution.responseId, raceForm.responses.at(-1)!.id);
    pass('Concurrent answer changes and resolution cannot produce a stale signed resolution');

    await ok(request(next, route + '/release', 'POST', {}));
    assert.equal(
      (await request(next, route + `/clarifications/${concurrentForm.id}/resolve`, 'POST', currentResolution)).status,
      409
    );
    detail = await ok(request(rnd, route + '/claim', 'POST', {}));
    pass('Release and new claims retain the same forms and enforce write ownership');
    const scopeRevision = (await db.userProfile.findUniqueOrThrow({ where: { userId: member.id } })).revision;
    await ok(
      request(member, '/user/clinical-evidence/details', 'PUT', {
        area: 'DIABETES',
        expectedSafetyRevision: 1,
        conditionDetails: 'Synthetic changed condition details',
        medications: 'No reported medications',
        dietaryAdvice: 'No reported restrictions',
        recentSymptoms: 'None reported',
        measurements: '',
      })
    );
    assert.equal((await db.userProfile.findUniqueOrThrow({ where: { userId: member.id } })).revision, scopeRevision + 1);
    assert.equal((await request(member, concurrentRoute, 'POST', { ...answer, requestKey: randomUUID() })).status, 409);
    assert.equal(
      (await request(rnd, route + '/clarifications', 'POST', { ...publish, requestKey: randomUUID() })).status,
      409
    );
    pass('Changed health details advance the profile revision and invalidate old forms');

    await db.$transaction(async (tx) => {
      await lockUserProfile(tx, member.id);
      await advanceProfileRevision(tx, member.id, undefined, false);
    });
    assert.equal((await request(member, concurrentRoute, 'POST', { ...answer, requestKey: randomUUID() })).status, 409);
    assert.equal(
      (await request(rnd, route + '/clarifications', 'POST', { ...publish, requestKey: randomUUID() })).status,
      409
    );
    const historical = (await ok(request(member, '/user/clinical-evidence'))).clarifications.forms;
    assert.equal(
      historical.every((f: any) => f.status === 'SUPERSEDED'),
      true
    );
    assert.equal(historical[0].responses.length, 2);
    pass('Profile changes supersede old forms and block stale answers/writes without deletion');
    const newDetail = await ok(request(rnd, route + '/claim', 'POST', {}));
    const finalContext = { profileRevision: newDetail.profileRevision, scopeKey: newDetail.scopeKey };
    const finalForm = await ok(
      request(rnd, route + '/clarifications', 'POST', { ...publish, ...finalContext, requestKey: randomUUID() })
    );
    const finalResponse = await ok(
      request(member, `/user/clinical-clarifications/${finalForm.id}/answers`, 'POST', {
        ...answer,
        ...finalContext,
        requestKey: randomUUID(),
      })
    );
    await ok(
      request(rnd, route + `/clarifications/${finalForm.id}/resolve`, 'POST', {
        ...finalContext,
        responseId: finalResponse.id,
        rationale: 'Reviewed the current response and confirmed the clarification is adequately resolved.',
      })
    );
    await ok(
      request(rnd, route + '/decision', 'POST', {
        profileRevision: newDetail.profileRevision,
        scopeKey: newDetail.scopeKey,
        decision: 'APPROVED',
        notes: 'Confirmed the new revision and its current clinical information.',
      })
    );
    assert.equal((await ok(request(member, '/user/clinical-profile-review/status'))).approved, true);
    pass('Superseded historical forms do not block a separately reviewed current profile');
    console.log(JSON.stringify({ passed: passed.length, checks: passed }));
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

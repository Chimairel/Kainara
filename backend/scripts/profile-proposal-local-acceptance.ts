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
  assert.equal(target.pathname, '/kainara_profile_proposals');
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
    const scopedDetail = await ok(request(rnd, `/nutritionist/profile-work/${member.id}`));
    assert.equal(scopedDetail.profileReview.profileRevision, scopedDetail.currentProfile.revision);
    assert.equal(scopedDetail.profileReview.clarifications.forms[0].id, form.id);
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
    const proposalBody = {
      ...finalContext,
      changes: {
        domains: [],
        healthDetails: [
          {
            area: 'DIABETES',
            conditionDetails: 'Synthetic clarified type 2 diabetes details',
            medications: 'No reported medications',
            dietaryAdvice: 'No reported restrictions',
            recentSymptoms: 'None reported',
            measurements: '',
          },
        ],
      },
      rationale: 'Reviewed the member clarification and recorded the specific reported diabetes context.',
      evidence: [{ formId: finalForm.id, responseId: finalResponse.id }],
      requestKey: randomUUID(),
    };
    const proposalRoute = route + '/proposals';
    assert.equal((await request(expired, proposalRoute, 'POST', proposalBody)).status, 403);
    assert.equal((await request(next, proposalRoute, 'POST', proposalBody)).status, 409);
    assert.equal((await request(member, proposalRoute, 'POST', proposalBody)).status, 403);
    assert.equal((await request(rnd, proposalRoute, 'POST', { ...proposalBody, authorUserId: member.id })).status, 400);
    assert.equal(
      (
        await request(rnd, proposalRoute, 'POST', {
          ...proposalBody,
          evidence: [{ formId: finalForm.id, responseId: 'wrong' }],
        })
      ).status,
      409
    );
    pass('Profile proposals enforce credentials, role, active claim, strict fields and current resolved evidence');
    const proposalBefore = await db.userProfile.findUniqueOrThrow({ where: { userId: member.id } });
    const competingBody = { ...proposalBody, requestKey: randomUUID() };
    const competing = await Promise.all([
      request(rnd, proposalRoute, 'POST', proposalBody),
      request(rnd, proposalRoute, 'POST', competingBody),
    ]);
    assert.deepEqual(competing.map((r) => r.status).sort(), [200, 409]);
    const winningBody = competing[0].status === 200 ? proposalBody : competingBody;
    const proposalId = competing.find((r) => r.status === 200)!.body.data.id;
    assert.equal((await ok(request(rnd, proposalRoute, 'POST', winningBody))).id, proposalId);
    assert.equal(await db.clinicalProfileProposal.count(), 1);
    assert.deepEqual(await db.userProfile.findUniqueOrThrow({ where: { userId: member.id } }), proposalBefore);
    assert.equal((await ok(request(member, '/user/clinical-profile-review/status'))).proposalPending, true);
    assert.equal(await ClinicalProfileReviewService.hasCurrentApproval(member.id), false);
    assert.equal(
      (
        await request(rnd, route + '/decision', 'POST', {
          ...finalContext,
          decision: 'APPROVED',
          notes: 'Confirmed the profile but this should remain blocked.',
        })
      ).status,
      422
    );
    pass(
      'One active proposal survives concurrent publication and retries without mutating the profile or allowing confirmation'
    );
    const responseRoute = `/user/clinical-profile-proposals/${proposalId}/respond`;
    const correctionRequest = {
      ...finalContext,
      decision: 'REQUEST_CORRECTION',
      note: 'Please clarify the reported treatment before changing my profile.',
      requestKey: randomUUID(),
    };
    assert.equal((await request(foreign, responseRoute, 'POST', correctionRequest)).status, 404);
    assert.equal((await request(member, responseRoute, 'POST', { ...correctionRequest, note: '' })).status, 400);
    await ok(request(member, responseRoute, 'POST', correctionRequest));
    await ok(request(member, responseRoute, 'POST', correctionRequest));
    assert.deepEqual(await db.userProfile.findUniqueOrThrow({ where: { userId: member.id } }), proposalBefore);
    assert.equal(
      (
        await request(member, responseRoute, 'POST', {
          ...correctionRequest,
          decision: 'ACCEPT',
          requestKey: randomUUID(),
        })
      ).status,
      409
    );
    await ok(request(rnd, route + '/release', 'POST', {}));
    await ok(request(next, route + '/claim', 'POST', {}));
    const revisedBody = {
      ...proposalBody,
      replacesProposalId: proposalId,
      rationale: 'Revised the correction after reviewing the member response and treatment details.',
      requestKey: randomUUID(),
    };
    const revised = await ok(request(next, proposalRoute, 'POST', revisedBody));
    const history = (await ok(request(member, '/user/clinical-evidence'))).profileProposals.proposals;
    assert.equal(history.length, 2);
    assert.equal(history.find((p: any) => p.id === proposalId).status, 'SUPERSEDED');
    assert.equal(history.find((p: any) => p.id === proposalId).memberNote, correctionRequest.note);
    assert.equal(history.find((p: any) => p.id === revised.id).evidenceSnapshot[0].title, publish.title);
    pass(
      'Member correction requests preserve the saved profile and evidence across a new RND claim and revised proposal'
    );
    const now = new Date();
    const cycle = await db.mealPlanCycle.create({
      data: {
        id: randomUUID(),
        userId: member.id,
        planType: 'WEEKLY',
        startDate: now,
        endDate: new Date(now.getTime() + 7 * 86400000),
        preparationOpensAt: now,
        shoppingDeadlineAt: now,
        expectedSlotCount: 21,
      },
    });
    const nextProfile = await db.nutritionistProfile.findUniqueOrThrow({ where: { userId: next.id } });
    await db.mealPlan.createMany({
      data: Array.from({ length: 21 }, (_, i) => ({
        userId: member.id,
        planGroupId: cycle.id,
        mealType: ['BREAKFAST', 'LUNCH', 'DINNER'][i % 3] as 'BREAKFAST' | 'LUNCH' | 'DINNER',
        mealName: 'Synthetic meal',
        calories: 600,
        proteinG: 20,
        carbsG: 70,
        fatG: 20,
        scheduledDate: new Date(now.getTime() + Math.floor(i / 3) * 86400000),
        claimedByNutritionistId: nextProfile.id,
        claimedAt: now,
      })),
    });
    const acceptBody = { ...finalContext, decision: 'ACCEPT', note: '', requestKey: randomUUID() };
    const revisedRoute = `/user/clinical-profile-proposals/${revised.id}/respond`;
    const alternateAccept = { ...acceptBody, requestKey: randomUUID() };
    const accepts = await Promise.all([
      request(member, revisedRoute, 'POST', acceptBody),
      request(member, revisedRoute, 'POST', alternateAccept),
    ]);
    assert.deepEqual(accepts.map((r) => r.status).sort(), [200, 409]);
    await ok(request(member, revisedRoute, 'POST', accepts[0].status === 200 ? acceptBody : alternateAccept));
    const applied = await db.userProfile.findUniqueOrThrow({ where: { userId: member.id } });
    assert.equal(applied.revision, proposalBefore.revision + 1);
    assert.equal(applied.safetyRevision, proposalBefore.safetyRevision + 1);
    assert.equal(await db.mealPlan.count({ where: { userId: member.id, claimedByNutritionistId: { not: null } } }), 0);
    assert.equal(await db.mealPlan.count({ where: { userId: member.id, requiresSafetyRevalidation: true } }), 21);
    assert.equal(await ClinicalProfileReviewService.hasCurrentApproval(member.id), false);
    assert.equal(
      (
        await db.clinicalContextResponse.findUniqueOrThrow({
          where: { userId_area: { userId: member.id, area: 'DIABETES' } },
        })
      ).responses &&
        (
          (
            await db.clinicalContextResponse.findUniqueOrThrow({
              where: { userId_area: { userId: member.id, area: 'DIABETES' } },
            })
          ).responses as any
        ).conditionDetails,
      proposalBody.changes.healthDetails[0].conditionDetails
    );
    const proposalAudit = await db.auditEvent.findFirstOrThrow({
      where: { entityId: revised.id, action: 'CLINICAL_PROFILE_CORRECTION_PROPOSED' },
    });
    const accessBefore = await db.auditEvent.count({ where: { action: 'ADMIN_REVIEW_SENSITIVE_DETAILS_ACCESSED' } });
    const oversight = await ok(request(admin, `/admin/audit-history/${proposalAudit.id}/review-context`));
    assert.equal(oversight.decisions[0].status, 'ACCEPTED');
    assert.equal(
      await db.auditEvent.count({ where: { action: 'ADMIN_REVIEW_SENSITIVE_DETAILS_ACCESSED' } }),
      accessBefore + 1
    );
    pass(
      'Acknowledgment applies exactly once, advances safety/profile revisions, clears 21 old claims and retains audited admin oversight'
    );
    const refreshed = await ok(request(next, route + '/claim', 'POST', {}));
    await ok(
      request(next, route + '/decision', 'POST', {
        profileRevision: refreshed.profileRevision,
        scopeKey: refreshed.scopeKey,
        decision: 'APPROVED',
        notes: 'Confirmed the new revision and its current clinical information.',
      })
    );
    assert.equal((await ok(request(member, '/user/clinical-profile-review/status'))).approved, true);
    pass('Superseded historical forms do not block a separately reviewed current profile');
    await ok(
      request(member, '/user/clinical-evidence/details', 'PUT', {
        ...proposalBody.changes.healthDetails[0],
        expectedSafetyRevision: applied.safetyRevision,
        conditionDetails: 'Synthetic updated details after confirmation',
      })
    );
    const declarationContext = await ok(request(rnd, route + '/claim', 'POST', {}));
    const declarationBody = {
      profileRevision: declarationContext.profileRevision,
      scopeKey: declarationContext.scopeKey,
      changes: {
        domains: [{ domain: 'ALLERGY', entries: [{ value: 'NUTS', provenance: 'PREDEFINED' }] }],
        healthDetails: [
          {
            ...proposalBody.changes.healthDetails[0],
            conditionDetails: 'Synthetic updated details after confirmation',
          },
          {
            area: 'FOOD_ALLERGY',
            conditionDetails: 'Synthetic clarified nut allergy details',
            medications: 'No reported medications',
            dietaryAdvice: 'Avoid reported allergens',
            recentSymptoms: 'None reported',
            measurements: '',
          },
        ],
      },
      rationale: 'Reviewed and clarified the reported food restriction and its associated details.',
      evidence: [],
      requestKey: randomUUID(),
    };
    const declarationProposal = await ok(request(rnd, proposalRoute, 'POST', declarationBody));
    const rndProfile = await db.nutritionistProfile.findUniqueOrThrow({ where: { userId: rnd.id } });
    await db.nutritionistProfile.update({
      where: { id: rndProfile.id },
      data: { prcLicenseExpiry: new Date('2020-01-01') },
    });
    const declarationResponseRoute = `/user/clinical-profile-proposals/${declarationProposal.id}/respond`;
    assert.equal(
      (
        await request(member, declarationResponseRoute, 'POST', {
          profileRevision: declarationContext.profileRevision,
          scopeKey: declarationContext.scopeKey,
          decision: 'ACCEPT',
          note: '',
          requestKey: randomUUID(),
        })
      ).status,
      409
    );
    assert.equal((await db.userProfile.findUniqueOrThrow({ where: { userId: member.id } })).revision, declarationContext.profileRevision);
    await ok(
      request(member, declarationResponseRoute, 'POST', {
        profileRevision: declarationContext.profileRevision,
        scopeKey: declarationContext.scopeKey,
        decision: 'REQUEST_CORRECTION',
        note: 'Please have the current review team confirm this correction.',
        requestKey: randomUUID(),
      })
    );
    await db.clinicalProfileReview.updateMany({
      where: { userId: member.id },
      data: { claimedAt: new Date('2020-01-01') },
    });
    const handoff = await ok(request(next, route + '/claim', 'POST', {}));
    const finalDeclaration = await ok(
      request(next, proposalRoute, 'POST', {
        ...declarationBody,
        replacesProposalId: declarationProposal.id,
        requestKey: randomUUID(),
      })
    );
    await ok(
      request(member, `/user/clinical-profile-proposals/${finalDeclaration.id}/respond`, 'POST', {
        profileRevision: handoff.profileRevision,
        scopeKey: handoff.scopeKey,
        decision: 'ACCEPT',
        note: '',
        requestKey: randomUUID(),
      })
    );
    assert.equal(
      (await db.userProfile.findUniqueOrThrow({ where: { userId: member.id } })).revision,
      handoff.profileRevision + 1
    );
    assert.equal(
      (await db.userProfile.findUniqueOrThrow({ where: { userId: member.id } })).safetyRevision,
      applied.safetyRevision + 1
    );
    assert.equal(await db.allergy.count({ where: { userId: member.id, allergen: 'NUTS' } }), 1);
    assert.equal(await db.healthCondition.count({ where: { userId: member.id, condition: 'DIABETES' } }), 1);
    pass(
      'Acceptance rechecks current RND credentials and reuses structured safety validation without dropping other declarations'
    );
    const staleContext = await ok(request(next, route + '/claim', 'POST', {}));
    const staleProposal = await ok(
      request(next, proposalRoute, 'POST', {
        ...proposalBody,
        profileRevision: staleContext.profileRevision,
        scopeKey: staleContext.scopeKey,
        evidence: [],
        requestKey: randomUUID(),
        changes: {
          domains: [],
          healthDetails: [
            {
              ...proposalBody.changes.healthDetails[0],
              conditionDetails: 'Synthetic subsequent proposed diagnosis clarification',
            },
          ],
        },
      })
    );
    await ok(
      request(member, '/user/clinical-evidence/details', 'PUT', {
        ...proposalBody.changes.healthDetails[0],
        expectedSafetyRevision: applied.safetyRevision + 1,
        conditionDetails: 'Synthetic independently updated member statement',
      })
    );
    assert.equal(
      (
        await request(member, `/user/clinical-profile-proposals/${staleProposal.id}/respond`, 'POST', {
          profileRevision: staleContext.profileRevision,
          scopeKey: staleContext.scopeKey,
          decision: 'ACCEPT',
          note: '',
          requestKey: randomUUID(),
        })
      ).status,
      409
    );
    const staleHistory = (await ok(request(member, '/user/clinical-evidence'))).profileProposals.proposals;
    assert.equal(staleHistory.find((p: any) => p.id === staleProposal.id).status, 'SUPERSEDED');
    assert.equal(staleHistory.filter((p: any) => p.status === 'ACCEPTED').length, 2);
    pass('Member changes invalidate outstanding proposals while accepted corrections retain their recorded history');
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

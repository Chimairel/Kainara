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
import { loadUserNutritionContext } from '../src/domain/user-nutrition-context';
import { MembershipService } from '../src/services/membership.service';
import { ClinicalProfileReviewService } from '../src/services/clinical-profile-review.service';
import { ClinicalEvidenceService } from '../src/services/clinical-evidence.service';
import { lockUserProfile, advanceProfileRevision } from '../src/services/profile-revision.service';

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55488');
  assert.equal(target.pathname, '/kainara_condition_assessment');
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
  const assessment = (id: string) => ({
    entryId: id,
    rationale: 'Reviewed dietary needs, treatments and food-handling precautions for this profile.',
    reviewedDietaryAndTreatmentEffects: true,
    reviewedFoodborneIllnessRisk: true,
  });
  const decision = (detail: any, ids: string[]) => ({
    decision: 'APPROVED',
    notes: 'Reviewed the current member details.',
    profileRevision: detail.profileRevision,
    scopeKey: detail.scopeKey,
    conditionAssessments: ids.map(assessment),
  });
  try {
    const member = await account('USER'),
      mixed = await account('USER'),
      incomplete = await account('USER'),
      rnd = await account('NUTRITIONIST'),
      other = await account('NUTRITIONIST'),
      expired = await account('NUTRITIONIST'),
      admin = await account('ADMIN');
    for (const actor of [rnd, other, expired])
      await db.nutritionistProfile.create({
        data: {
          userId: actor.id,
          isVerified: true,
          prcLicenseNumber: actor.id,
          prcLicenseExpiry: new Date(actor.id === expired.id ? '2020-01-01' : '2099-01-01'),
        },
      });
    const custom = await profile(member),
      mixedCustom = await profile(mixed, true),
      noDetails = await profile(incomplete, false, false);
    assert.equal((await ok(request(member, '/user/clinical-profile-review/status'))).approved, false);
    pass('Unmapped conditions start in profile review; no automatic exclusion');
    let detail = await ok(request(rnd, `/nutritionist/profile-reviews/${member.id}`));
    assert.equal(detail.conditionReviewEntries[0].displayName, custom.displayName);
    assert.equal(detail.conditionReviewEntries[0].canAssessNoAdditionalRestrictions, true);
    pass('RND sees the original condition and the separate relevance option');
    assert.equal(
      (await request(rnd, `/nutritionist/profile-reviews/${member.id}/decision`, 'POST', decision(detail, [custom.id])))
        .status,
      409
    );
    assert.equal(
      (
        await request(
          member,
          `/nutritionist/profile-reviews/${member.id}/decision`,
          'POST',
          decision(detail, [custom.id])
        )
      ).status,
      403
    );
    assert.equal(
      (
        await request(
          admin,
          `/nutritionist/profile-reviews/${member.id}/decision`,
          'POST',
          decision(detail, [custom.id])
        )
      ).status,
      403
    );
    assert.equal((await request(expired, `/nutritionist/profile-reviews/${member.id}/claim`, 'POST', {})).status, 403);
    pass('Claim, role and current credential checks are enforced');
    detail = await ok(request(rnd, `/nutritionist/profile-reviews/${member.id}/claim`, 'POST', {}));
    assert.equal(
      (
        await request(
          other,
          `/nutritionist/profile-reviews/${member.id}/decision`,
          'POST',
          decision(detail, [custom.id])
        )
      ).status,
      409
    );
    const stale = { ...decision(detail, [custom.id]), profileRevision: 0 };
    assert.equal(
      (await request(rnd, `/nutritionist/profile-reviews/${member.id}/decision`, 'POST', stale)).status,
      409
    );
    pass('Competing RND and stale-version decisions cannot record an assessment');
    assert.equal(
      (
        await request(
          rnd,
          `/nutritionist/profile-reviews/${member.id}/decision`,
          'POST',
          decision(detail, [mixedCustom.id])
        )
      ).status,
      422
    );
    assert.equal(
      (
        await request(
          rnd,
          `/nutritionist/profile-reviews/${member.id}/decision`,
          'POST',
          decision(detail, [custom.id, custom.id])
        )
      ).status,
      422
    );
    const malformed = decision(detail, [custom.id]);
    malformed.conditionAssessments[0].reviewedFoodborneIllnessRisk = false;
    assert.equal(
      (await request(rnd, `/nutritionist/profile-reviews/${member.id}/decision`, 'POST', malformed)).status,
      400
    );
    pass('Foreign conditions, duplicates and incomplete attestations are rejected');
    const concurrent = await Promise.all(
      [0, 1].map(() =>
        request(rnd, `/nutritionist/profile-reviews/${member.id}/decision`, 'POST', decision(detail, [custom.id]))
      )
    );
    assert.deepEqual(concurrent.map((result) => result.status).sort(), [200, 409]);
    const signed = concurrent.find((result) => result.status === 200)!.body.data;
    assert.equal(await db.auditEvent.count({ where: { entityId: signed.id, action: 'CLINICAL_PROFILE_REVIEWED' } }), 1);
    pass('Concurrent confirmation retries create one signed decision and one audit record');
    const recorded = await db.safetyProfileEntry.findUniqueOrThrow({ where: { id: custom.id } });
    assert.equal(recorded.originalText, custom.originalText);
    assert.equal(recorded.canonicalCode, null);
    assert.equal(recorded.supportState, 'PENDING_REVIEW');
    assert.equal((recorded.mealPlanningAssessment as any).reviewId, signed.id);
    pass('Condition and support state remain unchanged; assessment records its RND and review');
    const context = await loadUserNutritionContext(db, member.id, 'Missing fixture');
    assert.deepEqual(context.safetyRestrictions.customConditions, []);
    assert.deepEqual(context.declaredSafetyRestrictions.customConditions, [custom.originalText]);
    assert.equal((await MembershipService.state(member.id)).requiresCaseReview, false);
    assert.equal(
      (await ClinicalProfileReviewService.queue()).some((item) => item.userId === member.id),
      false
    );
    pass('Only the assessed condition stops creating case-review requirements');
    const memberProfile = await ok(request(member, '/user/profile'));
    assert.equal(memberProfile.userProfile.otherConditions, custom.originalText);
    assert.equal(
      memberProfile.safetyEntries.find((item: any) => item.id === custom.id).mealPlanningAssessment.result,
      'NO_ADDITIONAL_RESTRICTIONS'
    );
    pass('Member profile retains the diagnosis and exposes the recorded assessment');
    const healthWorkspace = await ClinicalEvidenceService.workspace(member.id);
    assert.equal(healthWorkspace.conditionPlanningAssessments[0].condition, custom.originalText);
    assert.equal(healthWorkspace.availableAreas.includes('OTHER'), true);
    assert.equal(
      (await request(member, '/user/onboarding/profile', 'POST', { mealPlanningAssessment: assessment(custom.id) }))
        .status,
      400
    );
    pass('Member health details remain editable; self-issued assessments are rejected');
    const event = await db.auditEvent.findFirstOrThrow({
      where: { entityId: signed.id, action: 'CLINICAL_PROFILE_REVIEWED' },
    });
    const audit = await ok(request(admin, `/admin/audit-history/${event.id}/review-context`));
    assert.equal(audit.reviewedSnapshot.conditionAssessments[0].rationale, assessment(custom.id).rationale);
    assert.equal((await request(member, `/admin/audit-history/${event.id}/review-context`)).status, 403);
    assert.equal(await db.auditEvent.count({ where: { action: 'ADMIN_REVIEW_SENSITIVE_DETAILS_ACCESSED' } }), 1);
    pass('Admin reads immutable assessment rationale through audited case-scoped access');
    const incompleteDetail = await ok(request(rnd, `/nutritionist/profile-reviews/${incomplete.id}/claim`, 'POST', {}));
    assert.equal(
      (
        await request(
          rnd,
          `/nutritionist/profile-reviews/${incomplete.id}/decision`,
          'POST',
          decision(incompleteDetail, [noDetails.id])
        )
      ).status,
      422
    );
    pass('Relevance attestations cannot bypass missing health details');
    const mixedDetail = await ok(request(rnd, `/nutritionist/profile-reviews/${mixed.id}/claim`, 'POST', {}));
    const heart = mixedDetail.conditionReviewEntries.find((item: any) => item.displayName === 'Heart condition');
    assert.equal(heart.canAssessNoAdditionalRestrictions, false);
    assert.equal(
      (
        await request(
          rnd,
          `/nutritionist/profile-reviews/${mixed.id}/decision`,
          'POST',
          decision(mixedDetail, [heart.id])
        )
      ).status,
      422
    );
    await ok(
      request(
        rnd,
        `/nutritionist/profile-reviews/${mixed.id}/decision`,
        'POST',
        decision(mixedDetail, [mixedCustom.id])
      )
    );
    const mixedContext = await loadUserNutritionContext(db, mixed.id, 'Missing fixture');
    assert.deepEqual(mixedContext.conditions, ['HEART_CONDITION']);
    assert.deepEqual(mixedContext.allergens, ['NUTS']);
    assert.equal((await MembershipService.state(mixed.id)).requiresCaseReview, true);
    pass('Known heart-condition gates and nuts exclusion remain alongside an unrelated condition');
    await ClinicalEvidenceService.saveHealthDetails(member.id, {
      area: 'OTHER',
      expectedSafetyRevision: 1,
      conditionDetails: 'Synthetic condition details',
      medications: 'New treatment requiring assessment',
      dietaryAdvice: 'Unknown',
      recentSymptoms: 'None',
      measurements: '',
    });
    assert.equal(
      (await db.safetyProfileEntry.findUniqueOrThrow({ where: { id: custom.id } })).mealPlanningAssessment,
      null
    );
    assert.equal(await ClinicalProfileReviewService.hasCurrentApproval(member.id), false);
    assert.equal((await MembershipService.state(member.id)).requiresCaseReview, true);
    assert.equal(
      (await ClinicalProfileReviewService.queue()).some((item) => item.userId === member.id),
      true
    );
    pass('Treatment changes invalidate the cache and return the member to profile review');
    const historical = await db.clinicalProfileReview.findUniqueOrThrow({ where: { id: signed.id } });
    assert.equal((historical.profileSnapshot as any).conditionAssessments[0].result, 'NO_ADDITIONAL_RESTRICTIONS');
    pass('Invalidation preserves the signed historical decision and original diagnosis');
    const second = await db.safetyProfileEntry.create({
      data: {
        userId: member.id,
        domain: 'CONDITION',
        displayName: 'Second unrelated condition',
        originalText: 'Second unrelated condition',
        normalizedText: 'second unrelated condition',
        provenance: 'CUSTOM',
        supportState: 'PENDING_REVIEW',
        policyReference: 'SYNTHETIC_UNMAPPED',
      },
    });
    detail = await ok(request(other, `/nutritionist/profile-reviews/${member.id}/claim`, 'POST', {}));
    assert.equal(
      (
        await request(
          other,
          `/nutritionist/profile-reviews/${member.id}/decision`,
          'POST',
          decision(detail, [custom.id])
        )
      ).status,
      422
    );
    assert.equal(
      (await db.safetyProfileEntry.findUniqueOrThrow({ where: { id: custom.id } })).mealPlanningAssessment,
      null
    );
    pass('Assessing one custom condition cannot clear a second unassessed condition');
    await ok(
      request(
        other,
        `/nutritionist/profile-reviews/${member.id}/decision`,
        'POST',
        decision(detail, [custom.id, second.id])
      )
    );
    await db.$transaction(async (tx) => {
      await lockUserProfile(tx, member.id);
      await advanceProfileRevision(tx, member.id, [], false);
    });
    assert.equal(
      (await db.safetyProfileEntry.findUniqueOrThrow({ where: { id: custom.id } })).mealPlanningAssessment,
      null
    );
    assert.equal(await ClinicalProfileReviewService.hasCurrentApproval(member.id), false);
    pass('A new profile version invalidates assessment reuse without deleting history');
    console.log(JSON.stringify({ checks: passed.length, passed }));
  } finally {
    globalThis.fetch = nativeFetch;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

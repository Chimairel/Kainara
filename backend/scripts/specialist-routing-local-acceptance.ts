/** Synthetic HTTP/SQL acceptance; refuses any database except this task-owned local fixture. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { ClinicalEvidenceArea, HealthConditionType, type Role } from '@prisma/client';
import app from '../src/app';
import prisma from '../src/lib/prisma';
import { signAccessToken } from '../src/lib/jwt';
import { ReviewRoutingService } from '../src/services/review-routing.service';
import { ClinicalEvidenceService } from '../src/services/clinical-evidence.service';
import { NutritionistReviewService } from '../src/services/nutritionist-review.service';
import { ClinicalProfileReviewService } from '../src/services/clinical-profile-review.service';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '../src/domain/onboarding.policy';
import { specialistRoutingScenarios } from './helpers/specialist-routing-scenarios';

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55483');
  assert.equal(target.pathname, '/kainara_specialist_routing');
  assert.equal(process.env.NODE_ENV, 'test');
  for (const key of ['GEMINI_API_KEY', 'SMTP_USER', 'BREVO_API_KEY', 'PAYMONGO_SECRET_KEY'])
    assert.equal(process.env[key] ?? '', '');
  assert.equal(await prisma.user.count(), 0, 'Use a fresh task-owned fixture database.');
  const run = randomUUID();
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  let sequence = 0;
  const account = async (role: Role) =>
    prisma.user.create({
      data: {
        role,
        name: `Synthetic ${role} ${++sequence}`,
        email: `${run}-${sequence}@example.invalid`,
        passwordHash: 'unusable-fixture',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        acceptedTermsVersion: CURRENT_TERMS_VERSION,
        acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
      },
    });
  const request = async (
    user: { id: string; email: string; role: Role },
    path: string,
    method = 'GET',
    body?: unknown
  ) => {
    const token = signAccessToken({ userId: user.id, email: user.email, role: user.role });
    const response = await fetch(base + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return {
      status: response.status,
      body: (await response.json()) as { success?: boolean; data?: any; code?: string; error?: string },
    };
  };
  const ok = async (promise: ReturnType<typeof request>) => {
    const result = await promise;
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.success, true);
    return result.body.data;
  };
  const member = async (conditions: HealthConditionType[] = ['HEART_CONDITION']) => {
    const user = await account('USER');
    await prisma.userProfile.create({
      data: {
        userId: user.id,
        age: 26,
        biologicalSex: conditions.includes('PREGNANT') ? 'FEMALE' : 'MALE',
        heightCm: 170,
        weightKg: 65,
        goal: 'MAINTAIN',
        activityLevel: 'SEDENTARY',
        dietaryPreference: 'OMNIVORE',
        dailyCalorieTarget: 2000,
      },
    });
    await prisma.healthCondition.createMany({ data: conditions.map((condition) => ({ userId: user.id, condition })) });
    await prisma.safetyProfileEntry.createMany({
      data: [
        ...conditions.map((condition) => ({ domain: 'CONDITION' as const, canonicalCode: condition })),
        { domain: 'ALLERGY' as const, canonicalCode: 'NONE' },
      ].map((entry) => ({
        ...entry,
        userId: user.id,
        displayName: entry.canonicalCode,
        originalText: entry.canonicalCode,
        normalizedText: entry.canonicalCode.toLowerCase(),
        provenance: 'PREDEFINED' as const,
        supportState: 'SUPPORTED' as const,
        policyReference: 'SYNTHETIC_FIXTURE',
      })),
    });
    await prisma.nutritionReport.create({
      data: {
        userId: user.id,
        profileRevision: 0,
        acknowledgedAt: new Date(),
        generalSummary: 'Synthetic engineering fixture',
        foodsToAvoid: [],
        foodsToLimit: [],
        foodsRecommended: [],
        drinksGuidance: [],
        basedOnConditions: conditions,
        basedOnAllergies: [],
      },
    });
    for (const condition of conditions)
      if (condition !== 'NONE')
        await ClinicalEvidenceService.saveHealthDetails(user.id, {
          area: condition === 'PREGNANT' ? 'PREGNANCY' : (condition as unknown as ClinicalEvidenceArea),
          expectedSafetyRevision: 0,
          conditionDetails: 'Synthetic condition details for software testing.',
          medications: 'None',
          dietaryAdvice: 'Unknown',
          recentSymptoms: 'None',
          measurements: '',
        });
    return user;
  };
  const cycleWithMeals = async (userId: string, days = 7, workKey?: string) => {
    const id = randomUUID();
    const day = new Date(Date.now() + days * 86_400_000);
    const cycle = await prisma.mealPlanCycle.create({
      data: {
        id,
        userId,
        planType: 'WEEKLY',
        startDate: day,
        endDate: new Date(day.getTime() + 6 * 86_400_000),
        shoppingDeadlineAt: day,
        preparationOpensAt: new Date(),
        expectedSlotCount: 2,
        status: 'ACTIVE',
        snapshot: {
          create: {
            userId,
            profileRevision: 0,
            safetyRevision: 0,
            weightKg: 65,
            activityLevel: 'SEDENTARY',
            goal: 'MAINTAIN',
            dailyCalorieTarget: 2000,
            dailyMacroTargets: {},
            planningGeographyLevel: 'NATIONAL',
          },
        },
      },
    });
    const meals = [];
    for (let index = 0; index < 2; index++)
      meals.push(
        await prisma.mealPlan.create({
          data: {
            userId,
            planGroupId: id,
            mealName: 'Synthetic pending plate',
            description: 'Software fixture only',
            mealType: 'LUNCH',
            status: 'PENDING_REVIEW',
            calories: 700,
            proteinG: 35,
            carbsG: 95,
            fatG: 20,
            scheduledDate: new Date(day.getTime() + index * 86_400_000),
            candidateProvenance: 'CERTIFIED_LIBRARY',
            reviewWorkKey: workKey ?? `fixture-${id}`,
            requiresSafetyRevalidation: true,
          },
        })
      );
    return { cycle, meals };
  };
  try {
    const admin = await account('ADMIN');
    const rnds = [];
    for (let index = 0; index < 5; index++) {
      const user = await account('NUTRITIONIST');
      const profile = await prisma.nutritionistProfile.create({
        data: {
          userId: user.id,
          prcLicenseNumber: `${run}-${index}`,
          prcLicenseExpiry: new Date('2031-01-01'),
          isVerified: true,
          specialization: 'Self-declared heart expert',
        },
      });
      rnds.push({ user, profile });
      await ok(
        request(admin, `/admin/review-routing/expertise/${profile.id}`, 'PUT', {
          conditions: index < 4 ? ['HEART_CONDITION'] : ['KIDNEY_DISEASE'],
          experienceYears: index < 4 ? 12 - index : 25,
          evidence: 'Verified synthetic qualification and employment reference.',
        })
      );
    }
    const outsider = rnds[4];
    const specialist = rnds[0];
    assert.equal(
      (
        await request(outsider.user, `/admin/review-routing/expertise/${outsider.profile.id}`, 'PUT', {
          conditions: ['HEART_CONDITION'],
          experienceYears: 25,
          evidence: 'Attempted self-certification fixture.',
        })
      ).status,
      403
    );
    await ok(
      request(outsider.user, '/nutritionist/profile', 'PATCH', {
        specialization: 'Cardiovascular expert',
        verifiedExpertise: ['HEART_CONDITION'],
      })
    );
    assert.deepEqual(
      (await prisma.nutritionistProfile.findUniqueOrThrow({ where: { id: outsider.profile.id } })).verifiedExpertise,
      ['KIDNEY_DISEASE']
    );

    const existing = await member();
    await ok(request(admin, '/admin/review-routing', 'PATCH', { enabled: true }));
    await ReviewRoutingService.resolve({ userId: existing.id });
    assert.equal(
      (await prisma.reviewRoutingEpisode.findFirstOrThrow({ where: { userId: existing.id } })).reason,
      'EXISTING_WORK'
    );
    assert.ok(
      (await ok(request(outsider.user, '/nutritionist/profile-work'))).some(
        (person: any) => person.userId === existing.id
      )
    );

    const patient = await member();
    const initialQueue = await ok(request(specialist.user, '/nutritionist/profile-work'));
    assert.ok(
      initialQueue.some((person: any) => person.userId === patient.id && person.routing.stage === 'SPECIALIST')
    );
    const initial = await prisma.reviewRoutingEpisode.findFirstOrThrow({ where: { userId: patient.id } });
    assert.deepEqual(
      initial.selectedReviewerIds,
      rnds.slice(0, 4).map((rnd) => rnd.profile.id)
    );
    assert.ok(
      !(await ok(request(outsider.user, '/nutritionist/profile-work'))).some(
        (person: any) => person.userId === patient.id
      )
    );
    for (const path of [`/nutritionist/profile-work/${patient.id}`, `/nutritionist/profile-reviews/${patient.id}`])
      assert.equal((await request(outsider.user, path)).status, 404);
    assert.equal(
      (await request(outsider.user, `/nutritionist/profile-reviews/${patient.id}/claim`, 'POST', {})).status,
      404
    );

    const document = await ClinicalEvidenceService.upload({
      userId: patient.id,
      area: 'HEART_CONDITION',
      documentType: 'MEDICAL_ABSTRACT',
      file: {
        buffer: Buffer.from('%PDF-1.7\nsynthetic document'),
        mimetype: 'application/pdf',
        originalname: 'synthetic.pdf',
      },
      consentAccepted: true,
    });
    for (const path of [
      `/nutritionist/clinical-evidence/${document.id}`,
      `/nutritionist/clinical-evidence/${document.id}/file`,
      `/nutritionist/profile-work/${patient.id}/documents/${document.id}`,
      `/nutritionist/profile-work/${patient.id}/documents/${document.id}/file`,
    ])
      assert.equal((await request(outsider.user, path)).status, 404, path);
    await ok(request(specialist.user, `/nutritionist/clinical-evidence/${document.id}`));
    const documentToken = signAccessToken({
      userId: specialist.user.id,
      email: specialist.user.email,
      role: 'NUTRITIONIST',
    });
    const fileResponse = await fetch(base + `/nutritionist/clinical-evidence/${document.id}/file`, {
      headers: { Authorization: `Bearer ${documentToken}` },
    });
    assert.equal(fileResponse.status, 200);
    assert.ok(
      Buffer.from(await fileResponse.arrayBuffer())
        .toString()
        .startsWith('%PDF-1.7')
    );

    await ok(request(specialist.user, `/nutritionist/profile-reviews/${patient.id}/claim`, 'POST', {}));
    const detail = await ok(request(specialist.user, `/nutritionist/profile-reviews/${patient.id}`));
    await ok(
      request(specialist.user, `/nutritionist/profile-reviews/${patient.id}/decision`, 'POST', {
        decision: 'APPROVED',
        notes: 'Synthetic profile review for authorization verification.',
        profileRevision: detail.profileRevision,
        scopeKey: detail.scopeKey,
      })
    );
    assert.equal(await ClinicalProfileReviewService.hasCurrentApproval(patient.id), true);

    const { cycle, meals } = await cycleWithMeals(patient.id);
    await prisma.mealPlanClinicalEvidence.create({
      data: {
        mealPlanId: meals[1].id,
        clinicalDocumentId: document.id,
        documentRevision: document.revision,
        documentSha256: (await prisma.clinicalDocument.findUniqueOrThrow({ where: { id: document.id } })).sha256,
      },
    });
    assert.equal(
      (await request(outsider.user, `/nutritionist/queue/${meals[1].id}/clinical-evidence/${document.id}/file`)).status,
      404
    );

    const specialistQueue = await ok(request(specialist.user, '/nutritionist/queue'));
    assert.ok(specialistQueue.some((meal: any) => meal.id === meals[0].id && meal.routing.stage === 'SPECIALIST'));
    const routedCycle = await prisma.mealPlanCycle.findUniqueOrThrow({
      where: { id: cycle.id },
      include: { reviewRoutingEpisode: true },
    });
    assert.equal(routedCycle.reviewRoutingEpisodeId, initial.id);
    assert.equal(routedCycle.reviewRoutingEpisode!.beganAt.getTime(), initial.beganAt.getTime());
    assert.ok(
      !(await ok(request(outsider.user, '/nutritionist/queue'))).some((meal: any) => meal.userId === patient.id)
    );
    const outsiderCounts = await ok(request(outsider.user, '/nutritionist/review-work-counts'));
    assert.equal(outsiderCounts.case, 0);
    for (const [path, method, body] of [
      [`/nutritionist/queue/${meals[0].id}`, 'GET', undefined],
      [`/nutritionist/queue/${meals[0].id}/claim`, 'POST', {}],
      [`/nutritionist/review/${meals[0].id}`, 'PATCH', { action: 'approve', note: 'Synthetic forbidden approval.' }],
      [
        `/nutritionist/review/${meals[0].id}/regenerate-candidate`,
        'POST',
        { reason: 'Synthetic forbidden regeneration.' },
      ],
    ] as const)
      assert.equal((await request(outsider.user, path, method, body)).status, 404, path);

    // Automatic routing ignores the legacy availability flag (all profiles default to false).
    await ok(request(specialist.user, `/nutritionist/queue/${meals[0].id}/claim`, 'POST', {}));
    await ReviewRoutingService.assertMeal(specialist.profile.id, meals[0].id);
    await ReviewRoutingService.assertMeal(specialist.profile.id, meals[1].id);
    assert.ok(
      (await prisma.reviewRoutingEpisode.findUniqueOrThrow({ where: { id: initial.id } })).selectedReviewerIds.includes(
        rnds[3].profile.id
      )
    );
    await ok(
      request(specialist.user, `/nutritionist/review/${meals[0].id}`, 'PATCH', {
        action: 'approve',
        note: 'Synthetic claimed-case completion.',
      })
    );
    assert.equal((await prisma.mealPlan.findUniqueOrThrow({ where: { id: meals[0].id } })).status, 'APPROVED');
    assert.equal((await prisma.mealPlan.findUniqueOrThrow({ where: { id: meals[1].id } })).status, 'PENDING_REVIEW');

    const afterAssignments = await prisma.notification.count({
      where: { userId: outsider.user.id, title: 'Matching specialist review available' },
    });
    assert.equal(afterAssignments, 0);
    await prisma.reviewRoutingEpisode.update({
      where: { id: initial.id },
      data: { beganAt: new Date(Date.now() - 25 * 3_600_000), opensAt: new Date(Date.now() - 3_600_000) },
    });
    await Promise.all([
      ReviewRoutingService.assertMeal(outsider.profile.id, meals[1].id),
      ReviewRoutingService.assertMeal(rnds[1].profile.id, meals[1].id),
    ]);
    assert.equal((await prisma.reviewRoutingEpisode.findUniqueOrThrow({ where: { id: initial.id } })).stage, 'GENERAL');
    const notifications = await prisma.notification.count({
      where: { userId: outsider.user.id, title: 'Review opened to eligible RNDs' },
    });
    await ReviewRoutingService.assertMeal(outsider.profile.id, meals[1].id);
    assert.equal(
      await prisma.notification.count({ where: { userId: outsider.user.id, title: 'Review opened to eligible RNDs' } }),
      notifications
    );
    assert.equal((await prisma.mealPlan.findUniqueOrThrow({ where: { id: meals[1].id } })).status, 'PENDING_REVIEW');

    const mixed = await member(['HEART_CONDITION', 'DIABETES']);
    await ReviewRoutingService.resolve({ userId: mixed.id });
    assert.equal(
      (await prisma.reviewRoutingEpisode.findFirstOrThrow({ where: { userId: mixed.id } })).reason,
      'EXPERIENCE_PRIORITY'
    );
    const urgent = await member();
    const urgentWork = await cycleWithMeals(urgent.id, 0);
    await ReviewRoutingService.resolve({
      userId: urgent.id,
      cycleId: urgentWork.cycle.id,
      readyAt: urgentWork.meals[0].createdAt,
    });
    assert.equal(
      (await prisma.reviewRoutingEpisode.findFirstOrThrow({ where: { userId: urgent.id } })).reason,
      'DEADLINE_BUFFER'
    );
    const laterCycle = await cycleWithMeals(patient.id, 14);
    await ReviewRoutingService.resolve({
      userId: patient.id,
      cycleId: laterCycle.cycle.id,
      readyAt: laterCycle.meals[0].createdAt,
    });
    assert.notEqual(
      (await prisma.mealPlanCycle.findUniqueOrThrow({ where: { id: laterCycle.cycle.id } })).reviewRoutingEpisodeId,
      initial.id
    );

    // The first observed meal and a later profile/document read use the same episode.
    const mealFirst = await member();
    const firstWork = await cycleWithMeals(mealFirst.id);
    await ReviewRoutingService.resolve({
      userId: mealFirst.id,
      cycleId: firstWork.cycle.id,
      readyAt: firstWork.meals[0].createdAt,
    });
    const firstEpisode = await prisma.reviewRoutingEpisode.findFirstOrThrow({ where: { userId: mealFirst.id } });
    await ReviewRoutingService.assertProfile(rnds[1].profile.id, mealFirst.id);
    assert.equal(await prisma.reviewRoutingEpisode.count({ where: { userId: mealFirst.id } }), 1);
    assert.equal(
      (await prisma.mealPlanCycle.findUniqueOrThrow({ where: { id: firstWork.cycle.id } })).reviewRoutingEpisodeId,
      firstEpisode.id
    );

    // Material evidence changes invalidate claims without starting another waiting window.
    const revised = await member();
    await ok(request(rnds[1].user, `/nutritionist/profile-reviews/${revised.id}/claim`, 'POST', {}));
    const beforeRevision = await prisma.reviewRoutingEpisode.findFirstOrThrow({ where: { userId: revised.id } });
    await ClinicalEvidenceService.saveHealthDetails(revised.id, {
      area: 'HEART_CONDITION',
      expectedSafetyRevision: 0,
      conditionDetails: 'Materially updated synthetic condition details.',
      medications: 'None',
      dietaryAdvice: 'Unknown',
      recentSymptoms: 'None',
      measurements: '',
    });
    await ReviewRoutingService.assertProfile(rnds[1].profile.id, revised.id);
    const afterRevision = await prisma.reviewRoutingEpisode.findUniqueOrThrow({ where: { id: beforeRevision.id } });
    assert.notEqual(afterRevision.scopeKey, beforeRevision.scopeKey);
    assert.equal(afterRevision.beganAt.getTime(), beforeRevision.beganAt.getTime());
    assert.ok(afterRevision.opensAt <= beforeRevision.opensAt);
    assert.equal(
      await prisma.clinicalProfileReview.count({
        where: { userId: revised.id, claimedByNutritionistId: { not: null } },
      }),
      0
    );

    await prisma.userProfile.update({ where: { userId: revised.id }, data: { safetyRevision: { increment: 1 } } });
    await ReviewRoutingService.assertProfile(rnds[1].profile.id, revised.id);
    const safetyReroute = await prisma.reviewRoutingEpisode.findFirstOrThrow({ where: { userId: revised.id } });
    assert.equal(await prisma.reviewRoutingEpisode.count({ where: { userId: revised.id } }), 1);
    assert.equal(safetyReroute.id, beforeRevision.id);
    assert.equal(safetyReroute.beganAt.getTime(), beforeRevision.beganAt.getTime());
    assert.ok(safetyReroute.opensAt <= beforeRevision.opensAt);

    // Revoked expertise and expired licences cannot preserve a specialist claim.
    const revoked = await member();
    await ok(request(rnds[1].user, `/nutritionist/profile-reviews/${revoked.id}/claim`, 'POST', {}));
    await ok(
      request(admin, `/admin/review-routing/expertise/${rnds[1].profile.id}`, 'PUT', {
        conditions: [],
        experienceYears: null,
        evidence: 'Synthetic expertise revocation verification.',
      })
    );
    await assert.rejects(ReviewRoutingService.assertProfile(rnds[1].profile.id, revoked.id), /Review not found/);
    assert.equal(
      await prisma.clinicalProfileReview.count({
        where: { userId: revoked.id, claimedByNutritionistId: rnds[1].profile.id },
      }),
      0
    );
    const expired = await member();
    await ok(request(rnds[2].user, `/nutritionist/profile-reviews/${expired.id}/claim`, 'POST', {}));
    await prisma.nutritionistProfile.update({
      where: { id: rnds[2].profile.id },
      data: { prcLicenseExpiry: new Date('2020-01-01') },
    });
    await assert.rejects(ReviewRoutingService.assertProfile(rnds[2].profile.id, expired.id), /Review not found/);
    assert.equal((await request(rnds[2].user, '/nutritionist/profile-work')).status, 403);
    assert.equal(
      await prisma.clinicalProfileReview.count({
        where: { userId: expired.id, claimedByNutritionistId: rnds[2].profile.id },
      }),
      0
    );
    await prisma.nutritionistProfile.update({
      where: { id: rnds[2].profile.id },
      data: { prcLicenseExpiry: new Date('2031-01-01') },
    });
    const healthy = await member(['NONE']);
    await ReviewRoutingService.resolve({ userId: healthy.id });
    assert.equal(
      (await prisma.reviewRoutingEpisode.findFirstOrThrow({ where: { userId: healthy.id } })).reason,
      'NO_CONDITIONS'
    );
    const healthyPeer = await member(['NONE']);
    const sharedWorkKey = `synthetic-shared-${run}`;
    const healthyWork = await cycleWithMeals(healthy.id, 7, sharedWorkKey);
    const peerWork = await cycleWithMeals(healthyPeer.id, 7, sharedWorkKey);
    const visibleHealthy = (await ok(request(outsider.user, '/nutritionist/queue'))).filter((meal: any) =>
      [healthy.id, healthyPeer.id].includes(meal.userId)
    );
    assert.equal(visibleHealthy.length, 2, 'Routing-enabled grouping keeps different members independent.');
    assert.ok(visibleHealthy.every((meal: any) => meal.coalescedDependentCount === 2));
    await ok(request(outsider.user, `/nutritionist/queue/${healthyWork.meals[0].id}/claim`, 'POST', {}));
    await ok(
      request(outsider.user, `/nutritionist/review/${healthyWork.meals[0].id}`, 'PATCH', {
        action: 'approve',
        note: 'Synthetic member-specific approval.',
      })
    );
    assert.equal(
      (await prisma.mealPlan.findUniqueOrThrow({ where: { id: peerWork.meals[0].id } })).status,
      'PENDING_REVIEW'
    );
    const ungrouped = await NutritionistReviewService.getReviewQueue(undefined, false);
    assert.ok(
      peerWork.meals.every((meal) => ungrouped.some((queued) => queued.id === meal.id)),
      'The routing worker sees every ready source row.'
    );

    const cutover = (await ReviewRoutingService.config()).enabledAt;
    await prisma.reviewRoutingConfig.update({
      where: { id: 'global' },
      data: { enabledAt: new Date(Date.now() - 48 * 3_600_000) },
    });
    const delayedWork = await member();
    const readyThirtyHoursAgo = new Date(Date.now() - 30 * 3_600_000);
    await ReviewRoutingService.resolve({ userId: delayedWork.id, readyAt: readyThirtyHoursAgo });
    const delayedEpisode = await prisma.reviewRoutingEpisode.findFirstOrThrow({ where: { userId: delayedWork.id } });
    assert.equal(delayedEpisode.beganAt.getTime(), readyThirtyHoursAgo.getTime());
    assert.equal(delayedEpisode.reason, 'WINDOW_EXPIRED');
    await prisma.reviewRoutingConfig.update({ where: { id: 'global' }, data: { enabledAt: cutover } });

    await ReviewRoutingService.sweep();

    await prisma.user.update({ where: { id: rnds[1].user.id }, data: { isSuspended: true } });
    await assert.rejects(ReviewRoutingService.assertMeal(rnds[1].profile.id, meals[1].id), /Review not found/);
    assert.equal((await request(rnds[1].user, '/nutritionist/queue')).status, 401);
    const scenarios = await specialistRoutingScenarios({
      admin,
      existingReviewerIds: rnds.map((rnd) => rnd.profile.id),
      account,
      member,
      cycleWithMeals,
      request,
    });
    console.log(`ROUTING_SCENARIO_REPORT ${JSON.stringify(scenarios)}`);
    await ok(request(admin, '/admin/review-routing', 'PATCH', { enabled: false }));
    assert.equal(await prisma.reviewRoutingEpisode.count({ where: { stage: 'SPECIALIST' } }), 0);
    assert.equal((await ReviewRoutingService.config()).enabled, false);
    assert.ok((await prisma.auditEvent.count({ where: { action: 'REVIEW_ROUTING_UPDATED' } })) > 0);
    console.log(
      'PASS: specialist routing HTTP, private-document access, shared clock, claims, approval, fallback, notifications and role controls.'
    );
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await prisma.$disconnect();
  }
}
void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

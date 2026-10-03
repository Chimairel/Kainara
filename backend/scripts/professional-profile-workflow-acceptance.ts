import assert from 'node:assert/strict';

async function main() {
  const target = new URL(process.env.DATABASE_URL || '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55465');
  assert.equal(target.pathname, '/nutrimind_ui_tests');
  assert.equal(process.env.NODE_ENV, 'test');
  const { default: prisma } = await import('../src/lib/prisma');
  const { ClinicalEvidenceService: forms } = await import('../src/services/clinical-evidence.service');
  const { ClinicalProfileReviewService: reviews } = await import('../src/services/clinical-profile-review.service');
  const { AdminService } = await import('../src/services/admin.service');
  const { default: app } = await import('../src/app');
  const { signAccessToken } = await import('../src/lib/jwt');
  const stamp = Date.now();
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  try {
    const admin = await prisma.user.create({
      data: {
        name: 'Synthetic Admin',
        email: `profile-admin-${stamp}@example.test`,
        passwordHash: 'unused fixture',
        role: 'ADMIN',
        emailVerified: true,
      },
    });
    const patient = await prisma.user.create({
      data: {
        name: 'Synthetic Patient',
        email: `profile-patient-${stamp}@example.test`,
        passwordHash: 'unused fixture',
        role: 'USER',
        onboardingDone: true,
        emailVerified: true,
        userProfile: {
          create: {
            revision: 4,
            safetyRevision: 2,
            goal: 'MAINTAIN',
            dietaryPreference: 'OMNIVORE',
            age: 30,
            dailyCalorieTarget: 2000,
          },
        },
        healthConditions: { create: { condition: 'DIABETES' } },
        allergies: { create: { allergen: 'NONE' } },
        safetyProfileEntries: {
          create: [
            {
              domain: 'CONDITION',
              canonicalCode: 'DIABETES',
              displayName: 'Diabetes',
              originalText: 'Diabetes',
              normalizedText: 'diabetes',
              provenance: 'PREDEFINED',
              supportState: 'SUPPORTED',
              policyReference: 'TEST_ONLY',
            },
            {
              domain: 'ALLERGY',
              canonicalCode: 'NONE',
              displayName: 'None',
              originalText: 'None',
              normalizedText: 'none',
              provenance: 'PREDEFINED',
              supportState: 'SUPPORTED',
              policyReference: 'TEST_ONLY',
            },
          ],
        },
      },
    });
    const professionals = await Promise.all(
      ['a', 'b'].map((suffix) =>
        prisma.nutritionistProfile.create({
          data: {
            prcLicenseNumber: `PROFILE-TEST-${stamp}-${suffix}`,
            prcLicenseExpiry: new Date('2030-01-01'),
            isVerified: true,
            user: {
              create: {
                name: `Synthetic Reviewer ${suffix}`,
                email: `profile-rnd-${stamp}-${suffix}@example.test`,
                passwordHash: 'unused fixture',
                role: 'NUTRITIONIST',
                emailVerified: true,
              },
            },
          },
        })
      )
    );
    const expected = (detail: Awaited<ReturnType<typeof reviews.detail>>) => ({
      profileRevision: detail.profileRevision,
      scopeKey: detail.scopeKey,
    });
    assert.equal(await reviews.hasCurrentApproval(patient.id), false);
    await assert.rejects(forms.assertReadyForMealPlanning(patient.id), /Complete the health details/);
    const answers = {
      area: 'DIABETES' as const,
      expectedSafetyRevision: 2,
      conditionDetails: 'Synthetic diabetes history supplied for review.',
      medications: 'Unknown',
      dietaryAdvice: 'None reported',
      recentSymptoms: 'None reported',
      measurements: '',
    };
    await forms.saveHealthDetails(patient.id, answers);
    assert.equal((await forms.assertReadyForMealPlanning(patient.id))[0].state, 'READY');
    assert.equal(await reviews.hasCurrentApproval(patient.id), false, 'A complete form is not automatic confirmation.');
    const competing = await Promise.allSettled(
      professionals.map((professional) => reviews.claim(professional.id, patient.id))
    );
    assert.equal(competing.filter((result) => result.status === 'fulfilled').length, 1);
    const winner = professionals[competing.findIndex((result) => result.status === 'fulfilled')];
    const other = professionals.find((professional) => professional.id !== winner.id)!;
    let detail = await reviews.detail(patient.id, winner.id);
    assert.equal(detail.claim.mine, true);
    assert.equal(detail.healthDetails[0].responses && typeof detail.healthDetails[0].responses, 'object');
    await assert.rejects(
      reviews.decide(other.id, patient.id, 'APPROVED', 'Synthetic review', undefined, expected(detail)),
      /Claim this profile/
    );
    await reviews.decide(
      winner.id,
      patient.id,
      'REQUEST_DETAILS',
      'Please clarify your medication details.',
      'DIABETES',
      expected(detail)
    );
    assert.equal((await reviews.status(patient.id)).detailsRequest?.area, 'DIABETES');
    // Acquiring another claim must not hide the previous request or its notes.
    await reviews.claim(other.id, patient.id);
    assert.equal((await reviews.status(patient.id)).detailsRequest?.notes, 'Please clarify your medication details.');
    await reviews.claim(other.id, patient.id, true);
    const changed = { ...answers, medications: 'None currently reported' };
    await forms.saveHealthDetails(patient.id, changed);
    await assert.rejects(
      reviews.decide(winner.id, patient.id, 'APPROVED', 'Synthetic stale decision', undefined, expected(detail)),
      /profile changed/
    );
    await reviews.claim(winner.id, patient.id);
    detail = await reviews.detail(patient.id, winner.id);
    await reviews.decide(
      winner.id,
      patient.id,
      'APPROVED',
      'Reviewed the current submitted health details.',
      undefined,
      expected(detail)
    );
    assert.equal(await reviews.hasCurrentApproval(patient.id), true);
    const confirmed = await prisma.clinicalProfileReview.findFirstOrThrow({
      where: { userId: patient.id, status: 'APPROVED' },
    });
    const formBefore = await prisma.clinicalContextResponse.findFirstOrThrow({ where: { userId: patient.id } });
    await forms.saveHealthDetails(patient.id, changed);
    assert.equal(
      (await prisma.clinicalContextResponse.findUniqueOrThrow({ where: { id: formBefore.id } })).revision,
      formBefore.revision,
      'PostgreSQL JSON key ordering does not invalidate an unchanged form.'
    );
    assert.equal(await reviews.hasCurrentApproval(patient.id), true);
    await assert.rejects(
      forms.saveHealthDetails(patient.id, { ...changed, expectedSafetyRevision: 1 }),
      /profile changed/
    );
    await forms.saveHealthDetails(patient.id, {
      ...changed,
      recentSymptoms: 'New symptoms reported in synthetic fixture',
    });
    assert.equal(await reviews.hasCurrentApproval(patient.id), false);
    assert.deepEqual(
      (await prisma.clinicalProfileReview.findUniqueOrThrow({ where: { id: confirmed.id } })).profileSnapshot,
      confirmed.profileSnapshot,
      'Old confirmed context is preserved.'
    );
    await reviews.claim(winner.id, patient.id);
    await prisma.session.create({
      data: {
        userId: winner.userId,
        sessionToken: `synthetic-session-${stamp}`,
        expires: new Date(Date.now() + 3600000),
      },
    });
    const token = signAccessToken({
      userId: winner.userId,
      email: `profile-rnd-${stamp}@example.test`,
      role: 'NUTRITIONIST',
    });
    const endpoint = `${base}/nutritionist/profile-reviews/${patient.id}`;
    const authorized = () => fetch(endpoint, { headers: { authorization: `Bearer ${token}` } });
    assert.equal((await authorized()).status, 200);
    await AdminService.setUserSuspension(admin.id, winner.userId, true, 'Synthetic contract ended');
    assert.equal((await authorized()).status, 401, 'A previously issued token loses access immediately.');
    assert.equal(await prisma.session.count({ where: { userId: winner.userId } }), 0);
    assert.equal(
      await prisma.clinicalProfileReview.count({ where: { userId: patient.id, claimedByNutritionistId: winner.id } }),
      0
    );
    assert.equal(
      (await prisma.clinicalProfileReview.findUniqueOrThrow({ where: { id: confirmed.id } })).reviewerId,
      winner.id
    );
    await reviews.claim(other.id, patient.id);
    await AdminService.setUserSuspension(admin.id, winner.userId, false);
    assert.equal((await authorized()).status, 200);
    assert.equal(
      await prisma.auditEvent.count({
        where: { entityId: winner.userId, action: { in: ['USER_SUSPENDED', 'USER_REINSTATED'] } },
      }),
      2
    );
    console.log(
      'PASS: real PostgreSQL health forms, competing claims, current-context confirmation, stale/no-op saves, preserved reviews, revocation, old-token denial and restoration.'
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import assert from 'node:assert/strict';

async function main() {
  const target = new URL(process.env.DATABASE_URL || '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55473');
  assert.equal(target.pathname, '/nutrimind_onboarding_tests');
  assert.equal(process.env.NODE_ENV, 'test');
  const { default: prisma } = await import('../src/lib/prisma');
  const { SafetyIntakeService: safety } = await import('../src/services/safety-intake.service');
  const { ClinicalEvidenceService: forms } = await import('../src/services/clinical-evidence.service');
  const { ClinicalProfileReviewService: reviews } = await import('../src/services/clinical-profile-review.service');
  const { UserProfileService: profiles } = await import('../src/services/user-profile.service');
  const stamp = Date.now();
  try {
    const member = await prisma.user.create({
      data: {
        name: 'Synthetic Onboarding Member',
        email: `onboarding-${stamp}@example.test`,
        passwordHash: 'unused synthetic fixture',
        role: 'USER',
        emailVerified: true,
        onboardingDone: false,
        tosAccepted: true,
        acceptedTermsVersion: '2026-09-27',
        acceptedPrivacyVersion: '2026-09-27',
        userProfile: {
          create: {
            age: 30,
            biologicalSex: 'MALE',
            heightCm: 170,
            weightKg: 70,
            targetWeightKg: 70,
            activityLevel: 'SEDENTARY',
            goal: 'MAINTAIN',
            dietaryPreference: 'OMNIVORE',
            ricePreference: 'FLEXIBLE',
            foodCulture: 'Filipino',
            shoppingDayOfWeek: 6,
            dailyCalorieTarget: 2000,
          },
        },
      },
    });
    await safety.replaceDomains(
      member.id,
      ['CONDITION'],
      [{ domain: 'CONDITION', value: 'NONE', provenance: 'PREDEFINED' }]
    );
    await safety.replaceDomains(
      member.id,
      ['CONDITION'],
      [{ domain: 'CONDITION', value: 'HEART_CONDITION', provenance: 'PREDEFINED' }]
    );
    let workspace = await forms.workspace(member.id);
    const answers = {
      conditionDetails: 'Synthetic user-provided heart condition details',
      medications: 'None',
      dietaryAdvice: 'Unknown',
      recentSymptoms: 'None',
      measurements: '',
    };
    await forms.saveHealthDetails(member.id, {
      area: 'HEART_CONDITION',
      expectedSafetyRevision: workspace.safetyRevision,
      ...answers,
    });
    const before = await prisma.clinicalContextResponse.findUniqueOrThrow({
      where: { userId_area: { userId: member.id, area: 'HEART_CONDITION' } },
    });
    await safety.replaceDomains(
      member.id,
      ['ALLERGY', 'INTOLERANCE', 'AVOIDED_INGREDIENT'],
      [
        { domain: 'ALLERGY', value: 'NUTS', provenance: 'PREDEFINED' },
        { domain: 'INTOLERANCE', value: 'SOY', provenance: 'PREDEFINED' },
        { domain: 'AVOIDED_INGREDIENT', value: 'SESAME', provenance: 'PREDEFINED' },
      ]
    );
    workspace = await forms.workspace(member.id);
    assert.equal(
      await forms.nextOnboardingDetailsPath(member.id, ['ALLERGY', 'INTOLERANCE', 'AVOIDED_INGREDIENT']),
      '/onboarding/allergy-details'
    );
    assert.equal(
      (await profiles.getUserProfileDetails(member.id))?.onboardingStatus.nextPath,
      '/onboarding/allergy-details'
    );
    await assert.rejects(
      () => profiles.completeOnboarding(member.id),
      (error: unknown) =>
        error instanceof Error && (error as { errorCode?: string }).errorCode === 'ONBOARDING_INCOMPLETE'
    );
    assert.deepEqual(
      workspace.requirements.map((item) => [item.area, item.state]),
      [
        ['HEART_CONDITION', 'READY'],
        ['FOOD_ALLERGY', 'CONTEXT_REQUIRED'],
      ]
    );
    const after = await prisma.clinicalContextResponse.findUniqueOrThrow({ where: { id: before.id } });
    assert.equal(after.revision, before.revision + 1);
    assert.deepEqual(after.responses, {
      ...answers,
      formVersion: 'HEALTH_DETAILS_V1',
      safetyRevision: workspace.safetyRevision,
    });
    assert.equal(await prisma.clinicalProfileReview.count({ where: { userId: member.id, status: 'APPROVED' } }), 0);
    assert.equal(
      await prisma.auditEvent.count({
        where: { entityId: before.id, action: 'ONBOARDING_CONDITION_DETAILS_RETAINED' },
      }),
      1
    );
    await forms.saveHealthDetails(member.id, {
      area: 'FOOD_ALLERGY',
      expectedSafetyRevision: workspace.safetyRevision,
      ...answers,
      conditionDetails: 'Synthetic nut allergy and reaction details',
    });
    assert.ok((await forms.workspace(member.id)).requirements.every((item) => item.state === 'READY'));
    assert.equal((await profiles.completeOnboarding(member.id)).onboardingDone, true);
    const reviewer = await prisma.nutritionistProfile.create({
      data: {
        prcLicenseNumber: `ONBOARDING-TEST-${stamp}`,
        prcLicenseExpiry: new Date('2030-01-01'),
        isVerified: true,
        user: {
          create: {
            name: 'Synthetic Reviewer',
            email: `onboarding-rnd-${stamp}@example.test`,
            passwordHash: 'unused fixture',
            role: 'NUTRITIONIST',
            emailVerified: true,
          },
        },
      },
    });
    await reviews.claim(reviewer.id, member.id);
    const detail = await reviews.detail(member.id, reviewer.id);
    assert.equal(detail.needsClarification, false);
    await reviews.decide(
      reviewer.id,
      member.id,
      'APPROVED',
      'Reviewed synthetic condition and allergy statements.',
      undefined,
      { profileRevision: detail.profileRevision, scopeKey: detail.scopeKey }
    );
    assert.equal(await reviews.hasCurrentApproval(member.id), true);
    const approved = await prisma.clinicalProfileReview.findFirstOrThrow({
      where: { userId: member.id, status: 'APPROVED' },
    });
    await safety.replaceDomains(
      member.id,
      ['ALLERGY'],
      [{ domain: 'ALLERGY', value: 'EGGS', provenance: 'PREDEFINED' }]
    );
    assert.ok((await forms.workspace(member.id)).requirements.every((item) => item.state !== 'READY'));
    assert.equal(await reviews.hasCurrentApproval(member.id), false);
    assert.deepEqual(
      (await prisma.clinicalProfileReview.findUniqueOrThrow({ where: { id: approved.id } })).profileSnapshot,
      approved.profileSnapshot
    );
    assert.equal(
      await prisma.auditEvent.count({
        where: { entityId: before.id, action: 'ONBOARDING_CONDITION_DETAILS_RETAINED' },
      }),
      1
    );
    console.log(
      'PASS: sequential onboarding condition/allergy forms, retained user statements, separate allergy requirement, real profile confirmation and unchanged completed-member invalidation.'
    );
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

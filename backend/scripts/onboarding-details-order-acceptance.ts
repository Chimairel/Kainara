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
    await safety.replaceDomains(member.id, ['ALLERGY', 'INTOLERANCE', 'AVOIDED_INGREDIENT'], [
      { domain: 'ALLERGY', value: 'NUTS', provenance: 'PREDEFINED' },
      { domain: 'INTOLERANCE', value: 'SOY', provenance: 'PREDEFINED' },
    ]);
    const workspace = await forms.workspace(member.id);
    assert.deepEqual(workspace.contexts, []);
    assert.deepEqual(workspace.requirements, []);
    await assert.rejects(() => forms.saveHealthDetails(member.id, { area: 'HEART_CONDITION',
      expectedSafetyRevision: workspace.safetyRevision, conditionDetails: 'Unrequested test answer',
      medications: 'None', dietaryAdvice: 'Unknown', recentSymptoms: 'None', measurements: '' }),
      (error: unknown) => error instanceof Error && (error as { errorCode?: string }).errorCode === 'HEALTH_DETAILS_NOT_REQUESTED');
    assert.equal((await profiles.getUserProfileDetails(member.id))?.onboardingStatus.nextPath, '/onboarding/tos');
    assert.equal((await profiles.completeOnboarding(member.id)).onboardingDone, true);
    assert.equal(await prisma.clinicalContextResponse.count({ where: { userId: member.id } }), 0);
    assert.equal(await reviews.hasCurrentApproval(member.id), false);

    console.log(
      'PASS: condition and allergy declarations complete onboarding without fabricated health details; initial detail writes require an RND request; clinical profile approval remains separate.'
    );
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

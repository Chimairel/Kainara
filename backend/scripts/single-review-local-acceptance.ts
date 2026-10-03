import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

async function main() {
  const target = new URL(process.env.DATABASE_URL || '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55473');
  assert.equal(target.pathname, '/single_review_tests');
  assert.equal(process.env.NODE_ENV, 'test');
  process.env.MEMBERSHIP_ENABLED = 'false';
  const { default: prisma } = await import('../src/lib/prisma');
  const { SafetyIntakeService: intake } = await import('../src/services/safety-intake.service');
  const { ClinicalEvidenceService: forms } = await import('../src/services/clinical-evidence.service');
  const { ClinicalProfileReviewService: profiles } = await import('../src/services/clinical-profile-review.service');
  const { NutritionistReviewService: reviews } = await import('../src/services/nutritionist-review.service');
  const { approveMealPlan } = await import('../src/services/nutritionist-approval.service');
  const { MealPlanCycleService: cycles } = await import('../src/services/meal-plan-cycle.service');
  const { ConditionClearanceService: clearances, enforceClearanceCircuitBreakers } =
    await import('../src/services/condition-clearance.service');
  const { certifiedLibraryMealInclude, isCertifiedLibraryMealCompatible, isProfileApprovedLibraryMealCompatible } =
    await import('../src/services/meal-library-candidate-query.service');
  const { listMealApprovals, listDueProfileApprovals, flagMealApproval } =
    await import('../src/services/meal-approval-lifecycle.service');
  const { MEAL_LIBRARY_SAFETY_POLICY_VERSION } = await import('../src/domain/meal-library-safety-evidence.policy');
  const { MEAL_PLAN_SAFETY_POLICY_VERSION } = await import('../src/domain/meal-plan-production-safety.policy');
  const { mealApprovalSafetyScope } = await import('../src/domain/meal-approval-scope.policy');
  const { createFixturePlanCycle } = await import('./helpers/plan-cycle-fixture');
  const stamp = randomUUID();
  try {
    const reviewer = await prisma.nutritionistProfile.create({
      data: {
        prcLicenseNumber: `SINGLE-${stamp}`,
        prcLicenseExpiry: new Date('2035-01-01'),
        isVerified: true,
        canLeadReview: false,
        user: {
          create: {
            name: 'Synthetic Reviewer',
            email: `single-rnd-${stamp}@example.test`,
            passwordHash: 'unused fixture',
            role: 'NUTRITIONIST',
            emailVerified: true,
          },
        },
      },
    });
    const member = await prisma.user.create({
      data: {
        name: 'Synthetic Member',
        email: `single-member-${stamp}@example.test`,
        passwordHash: 'unused fixture',
        emailVerified: true,
        onboardingDone: false,
        userProfile: {
          create: {
            age: 30,
            biologicalSex: 'MALE',
            heightCm: 170,
            weightKg: 70,
            activityLevel: 'SEDENTARY',
            goal: 'MAINTAIN',
            dietaryPreference: 'OMNIVORE',
            foodCulture: 'Filipino',
            shoppingDayOfWeek: 6,
            dailyCalorieTarget: 2000,
          },
        },
      },
    });
    await intake.replaceDomains(
      member.id,
      ['CONDITION'],
      [{ domain: 'CONDITION', value: 'HEART_CONDITION', provenance: 'PREDEFINED' }]
    );
    await intake.replaceDomains(
      member.id,
      ['ALLERGY', 'INTOLERANCE', 'AVOIDED_INGREDIENT'],
      [{ domain: 'ALLERGY', value: 'NONE', provenance: 'PREDEFINED' }]
    );
    const workspace = await forms.workspace(member.id);
    await forms.saveHealthDetails(member.id, {
      area: 'HEART_CONDITION',
      expectedSafetyRevision: workspace.safetyRevision,
      conditionDetails: 'Synthetic heart condition context',
      medications: 'None',
      dietaryAdvice: 'Unknown',
      recentSymptoms: 'None',
      measurements: '',
    });
    await profiles.claim(reviewer.id, member.id);
    const detail = await profiles.detail(member.id, reviewer.id);
    await profiles.decide(reviewer.id, member.id, 'APPROVED', 'Reviewed synthetic condition statements.', undefined, {
      profileRevision: detail.profileRevision,
      scopeKey: detail.scopeKey,
    });
    const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId: member.id } });
    const cycle = await createFixturePlanCycle(prisma, {
      id: `single-${stamp}`,
      userId: member.id,
      status: 'ACTIVE',
      expectedSlotCount: 3,
    });
    await prisma.mealPlanCycleSnapshot.create({
      data: {
        planGroupId: cycle.id,
        userId: member.id,
        profileRevision: profile.revision,
        safetyRevision: profile.safetyRevision,
        weightKg: 70,
        activityLevel: 'SEDENTARY',
        goal: 'MAINTAIN',
        dailyCalorieTarget: 2000,
        dailyMacroTargets: { proteinG: 70, carbsG: 270, fatG: 65 },
        planningGeographyLevel: 'NATIONAL',
      },
    });
    const signature = 'a'.repeat(64);
    const serving = 'b'.repeat(64);
    const planData = {
      userId: member.id,
      planGroupId: cycle.id,
      mealType: 'LUNCH' as const,
      mealName: 'Synthetic reviewed dish',
      calories: 800,
      proteinG: 35,
      carbsG: 105,
      fatG: 27,
      scheduledDate: cycle.startDate,
      highRiskReviewRequired: true,
      baseRecipeSignature: signature,
      composedServingSignature: serving,
      candidateProvenance: 'RAW_RECIPE_CORPUS' as const,
      safetyPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
      status: 'PENDING_REVIEW' as const,
    };
    const plan = await prisma.mealPlan.create({ data: planData });
    await assert.rejects(approveMealPlan(reviewer.id, plan.id), /active claim/);
    await reviews.getReviewCardDetails(reviewer.id, plan.id, true);
    assert.deepEqual(await approveMealPlan(reviewer.id, plan.id, 'Reviewed exact synthetic plate.'), { success: true });
    const approved = await prisma.mealPlan.findUniqueOrThrow({
      where: { id: plan.id },
      include: { reviewDecisions: true },
    });
    assert.equal(approved.status, 'APPROVED');
    assert.equal(approved.reviewApprovalCount, 1);
    assert.equal(approved.reviewDecisions.length, 1);
    assert.ok((await cycles.getClearedMealPlanIds(member.id, cycle.id)).includes(plan.id));
    await assert.rejects(approveMealPlan(reviewer.id, plan.id), /Only PENDING_REVIEW/);

    // An old first approval must not prevent its original, non-lead reviewer
    // from claiming and explicitly finishing the pending plate.
    const legacy = await prisma.mealPlan.create({
      data: {
        ...planData,
        reviewApprovalCount: 1,
        firstApprovedByNutritionistId: reviewer.id,
        firstApprovedAt: new Date(),
        reviewDecisions: {
          create: {
            nutritionistProfileId: reviewer.id,
            stage: 'PRIMARY',
            decision: 'APPROVE',
            evidenceSnapshot: { legacyPartialReview: true },
          },
        },
      },
    });
    assert.ok((await reviews.getReviewQueue(reviewer.id)).some((item) => item.id === legacy.id));
    await reviews.getReviewCardDetails(reviewer.id, legacy.id, true);
    await approveMealPlan(reviewer.id, legacy.id, 'Explicit completion of historical partial review.');
    assert.ok((await cycles.getClearedMealPlanIds(member.id, cycle.id)).includes(legacy.id));
    assert.equal(await prisma.mealPlanReviewDecision.count({ where: { mealPlanId: legacy.id } }), 2);

    const food = await prisma.foodItem.create({
      data: {
        name: 'Synthetic chicken',
        category: 'Meat',
        source: 'FNRI',
        calories: 100,
        proteinG: 20,
        carbsG: 0,
        fatG: 2,
      },
    });
    const meal = await prisma.mealLibrary.create({
      data: {
        mealName: 'Synthetic evidence dish',
        mealType: 'LUNCH',
        calories: 500,
        proteinG: 25,
        carbsG: 60,
        fatG: 18,
        sodiumMg: 100,
        dietaryTags: ['OMNIVORE'],
        recipeSignature: signature,
        status: 'APPROVED',
        safetyReviewedByNutritionistId: reviewer.id,
        verifiedByNutritionistId: reviewer.id,
        safetyEvidenceStatus: 'COMPLETE',
        safetyEvidenceOrigin: 'NUTRITIONIST_REVIEW',
        nutritionEvidenceSource: 'FNRI_RECONCILED',
        safetyEvidenceRevision: 1,
        certifiedEvidenceRevision: 1,
        safetyPolicyVersion: MEAL_LIBRARY_SAFETY_POLICY_VERSION,
        safetyReviewedAt: new Date(),
        conditionDeclarationState: 'NOT_REVIEWED',
        allergenDeclarationState: 'REVIEWED_NONE_DECLARED',
        crossContactAssessment: 'ASSESSED_NO_KNOWN_RISK',
        ingredients: {
          create: {
            position: 0,
            ingredientName: food.name,
            category: 'Meat',
            foodItemId: food.id,
            dataSource: 'FNRI',
            quantity: 100,
            unit: 'g',
          },
        },
      },
    });
    const clearance = await clearances.submitManualDecision({
      nutritionistProfileId: reviewer.id,
      mealLibraryId: meal.id,
      condition: 'HEART_CONDITION',
      userScopeId: member.id,
      decision: 'APPROVE',
      rationale: 'Synthetic scoped condition decision.',
    });
    assert.equal(clearance.state, 'ACTIVE');
    assert.equal(clearance.auditDueAt, null);
    assert.equal(clearance.decisions.length, 1);
    await prisma.mealConditionClearance.update({
      where: { id: clearance.id },
      data: { auditDueAt: new Date('2020-01-01') },
    });
    assert.deepEqual(await enforceClearanceCircuitBreakers(), { suspendedClearances: 0, suspendedPolicies: 0 });
    let candidate = await prisma.mealLibrary.findUniqueOrThrow({
      where: { id: meal.id },
      include: certifiedLibraryMealInclude,
    });
    assert.ok(
      isCertifiedLibraryMealCompatible(candidate, ['HEART_CONDITION'], [], {
        userId: member.id,
        dietaryPreference: 'OMNIVORE',
        otherConditions: null,
        otherAllergies: null,
      })
    );
    assert.equal((await clearances.getGovernanceQueue(reviewer.id, 'audit')).clearances.length, 0);

    const scope = mealApprovalSafetyScope({ conditions: [], allergens: ['EGGS'] });
    const approval = await prisma.mealLibraryProfileApproval.create({
      data: {
        mealLibraryId: meal.id,
        safetyScopeKey: scope.key,
        scopeSnapshot: { allergens: ['EGGS'] },
        sourceProvenance: 'CERTIFIED_LIBRARY',
        recipeSignature: signature,
        evidenceRevision: 1,
        reviewerNutritionistId: reviewer.id,
        reviewPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
        reviewDueAt: new Date('2020-01-01'),
      },
    });
    candidate = await prisma.mealLibrary.findUniqueOrThrow({
      where: { id: meal.id },
      include: certifiedLibraryMealInclude,
    });
    assert.ok(
      isProfileApprovedLibraryMealCompatible(candidate, [], ['EGGS'], {
        dietaryPreference: 'OMNIVORE',
        otherConditions: null,
        otherAllergies: null,
      })
    );
    assert.equal((await listDueProfileApprovals(reviewer.id)).length, 0);
    assert.equal(
      (await listMealApprovals(meal.id))[0].approvals.find((item) => item.id === approval.id)?.status,
      'ACTIVE'
    );
    await flagMealApproval({
      nutritionistProfileId: reviewer.id,
      mealLibraryId: meal.id,
      kind: 'PROFILE',
      approvalId: approval.id,
      reason: 'Synthetic manual flag must continue to block reuse.',
    });
    candidate = await prisma.mealLibrary.findUniqueOrThrow({
      where: { id: meal.id },
      include: certifiedLibraryMealInclude,
    });
    assert.equal(
      isProfileApprovedLibraryMealCompatible(candidate, [], ['EGGS'], {
        dietaryPreference: 'OMNIVORE',
        otherConditions: null,
        otherAllergies: null,
      }),
      false
    );
    assert.equal((await listDueProfileApprovals(reviewer.id)).length, 1);
    await clearances.suspendClearance(reviewer.id, clearance.id, 'Synthetic manual suspension');
    assert.equal(
      (await prisma.mealConditionClearance.findUniqueOrThrow({ where: { id: clearance.id } })).state,
      'SUSPENDED'
    );
    const peer = await prisma.nutritionistProfile.create({
      data: {
        prcLicenseNumber: `SINGLE-PEER-${stamp}`,
        prcLicenseExpiry: new Date('2035-01-01'),
        isVerified: true,
        user: {
          create: {
            name: 'Synthetic Peer',
            email: `single-peer-${stamp}@example.test`,
            passwordHash: 'unused fixture',
            role: 'NUTRITIONIST',
            emailVerified: true,
          },
        },
      },
    });
    assert.equal(peer.canLeadReview, false);
    const { flagWholeMeal, releaseWholeMeal } = await import('../src/services/meal-wide-flag.service');
    await flagWholeMeal(reviewer.id, meal.id, 'Synthetic disputed whole-meal flag.');
    await assert.rejects(
      releaseWholeMeal(reviewer.id, meal.id, 'Synthetic self-resolution is blocked.'),
      /different nutritionist/
    );
    await releaseWholeMeal(peer.id, meal.id, 'Synthetic uninvolved nutritionist release findings.');
    const renewed = await clearances.submitManualDecision({
      nutritionistProfileId: reviewer.id,
      mealLibraryId: meal.id,
      condition: 'HEART_CONDITION',
      userScopeId: member.id,
      decision: 'APPROVE',
      rationale: 'Synthetic review after manual suspension.',
    });
    assert.equal(renewed.state, 'ACTIVE');
    const disputed = await prisma.mealPlan.create({
      data: {
        ...planData,
        status: 'DISPUTED',
        reviewDecisions: {
          create: {
            nutritionistProfileId: reviewer.id,
            stage: 'PRIMARY',
            decision: 'APPROVE',
            evidenceSnapshot: { legacyDispute: true },
          },
        },
      },
    });
    const { resolveMealPlanDispute } = await import('../src/services/nutritionist-dispute.service');
    await assert.rejects(
      resolveMealPlanDispute(reviewer.id, disputed.id, 'APPROVE', 'Synthetic self resolution.'),
      /did not submit/
    );
    await resolveMealPlanDispute(
      peer.id,
      disputed.id,
      'APPROVE',
      'Synthetic independent resolution with no lead role.'
    );
    assert.equal((await prisma.mealPlan.findUniqueOrThrow({ where: { id: disputed.id } })).status, 'APPROVED');
    await prisma.nutritionistProfile.update({ where: { id: reviewer.id }, data: { isVerified: false } });
    assert.equal((await enforceClearanceCircuitBreakers()).suspendedClearances, 1);
    assert.equal(
      (await prisma.mealConditionClearance.findUniqueOrThrow({ where: { id: renewed.id } })).suspensionReason,
      'REVIEWER_ELIGIBILITY_LAPSED'
    );
    console.log(
      'PASS: one non-lead case/condition approval, active claims, historical partial completion, no scheduled expiry or audit sampling, manual flags, equal nutritionist permissions, independent legacy dispute resolution and reviewer revocation.'
    );
  } finally {
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

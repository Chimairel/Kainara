import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import {
  ActivityLevel, AllergenType, ClinicalDocumentReviewDecision, ClinicalDocumentType,
  ClinicalEvidenceArea, ClinicalFactCode, DietaryPreference, Goal, HealthConditionType,
  PlanType, Role,
} from '@prisma/client';
import prisma from '../src/lib/prisma';
import { AdminMealAuthoringService } from '../src/services/admin-meal-authoring.service';
import { ClinicalEvidenceService } from '../src/services/clinical-evidence.service';
import { ClinicalProfileReviewService } from '../src/services/clinical-profile-review.service';
import { MealBaseVerificationService } from '../src/services/meal-base-verification.service';
import { MealPlanCycleService } from '../src/services/meal-plan-cycle.service';
import { generate7DayPlan } from '../src/services/meal-plan-composition.service';
import { NutritionistReviewService } from '../src/services/nutritionist-review.service';
import { queryEligibleLibraryMeals } from '../src/services/meal-library-candidate-query.service';
import { flagMealApproval, recheckProfileApproval } from '../src/services/meal-approval-lifecycle.service';
import { flagWholeMeal, releaseWholeMeal } from '../src/services/meal-wide-flag.service';
import { getManilaDateKey, getManilaMidnight } from '../src/domain/meal-plan-cycle.policy';

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1'].includes(url.hostname) ||
      process.env.CASE_FLOW_DISPOSABLE_DB !== '1') {
    throw new Error('Run the case approval journey only in a disposable local database.');
  }
  const marker = randomUUID();
  const rnd = await prisma.nutritionistProfile.findFirstOrThrow({
    where: { user: { email: 'nutritionist@gmail.com' } }, include: { user: true },
  });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@gmail.com' } });
  const food = await prisma.foodItem.findFirstOrThrow({ where: { source: 'FNRI' } });

  // Meal-only verification is independent of admission-quality nutrition evidence.
  const draft = await AdminMealAuthoringService.create(admin.id, {
    mealName: `Fixture verified meal ${marker}`, mealType: 'LUNCH',
    summary: 'A fictional cooked food for the meal-verification queue.',
    instructions: 'Cook the ingredient thoroughly and serve a measured portion.',
    nutritionBasis: 'Fictional per-serving data for an isolated workflow test.',
    nutritionServingDescription: 'One test serving',
    calories: 500, proteinG: 20, carbsG: 65, fatG: 17,
    sodiumMg: null, sugarG: null, fiberG: null, potassiumMg: null,
    phosphorusMg: null, saturatedFatG: null,
    ingredients: [{ foodItemId: food.id, gramsPerServing: 100 }],
  });
  assert.ok((await MealBaseVerificationService.list(rnd.id)).some((row) => row.id === draft.id));
  await MealBaseVerificationService.claim(rnd.id, 'LIBRARY_MEAL', draft.id);
  await MealBaseVerificationService.decide(rnd.id, 'LIBRARY_MEAL', draft.id,
    'VERIFIED', 'Fictional meal-only verification for the isolated acceptance run.');
  assert.ok(!(await MealBaseVerificationService.list(rnd.id)).some((row) => row.id === draft.id));
  assert.equal((await prisma.mealLibrary.findUniqueOrThrow({ where: { id: draft.id } })).safetyEvidenceStatus,
    'INCOMPLETE', 'Meal verification alone must not make an admin draft planning-ready.');

  const cases = [
    { label: 'healthy-omni', condition: HealthConditionType.NONE, allergy: AllergenType.NONE, diet: DietaryPreference.OMNIVORE },
    { label: 'healthy-vegetarian', condition: HealthConditionType.NONE, allergy: AllergenType.NONE, diet: DietaryPreference.VEGETARIAN },
    { label: 'hypertension', condition: HealthConditionType.HYPERTENSION, allergy: AllergenType.NONE, diet: DietaryPreference.OMNIVORE },
    { label: 'diabetes-eggs', condition: HealthConditionType.DIABETES, allergy: AllergenType.EGGS, diet: DietaryPreference.OMNIVORE },
    { label: 'eggs-only', condition: HealthConditionType.NONE, allergy: AllergenType.EGGS, diet: DietaryPreference.OMNIVORE },
  ] as const;
  const users = new Map<string, string>();
  const passwordHash = await bcrypt.hash('CaseFlow123!', 12);
  for (const item of cases) {
    const user = await prisma.user.create({ data: {
      email: `cf-${item.label}-${marker}@example.com`,
      name: `Case flow ${item.label}`, passwordHash, role: Role.USER,
      emailVerified: true, onboardingDone: true, tosAccepted: true,
      userProfile: { create: {
        age: 30, biologicalSex: 'FEMALE', heightCm: 160, weightKg: 60,
        goal: Goal.MAINTAIN, activityLevel: ActivityLevel.LIGHTLY_ACTIVE,
        dietaryPreference: item.diet, dailyCalorieTarget: 1200,
      } },
      healthConditions: { create: { condition: item.condition } },
      allergies: { create: { allergen: item.allergy } },
    } });
    users.set(item.label, user.id);
  }

  const diabetesId = users.get('diabetes-eggs')!;
  await prisma.clinicalContextResponse.create({ data: {
    userId: diabetesId, area: ClinicalEvidenceArea.DIABETES,
    responses: { medicationRisk: 'INSULIN', recurrentHypoglycemia: false },
  } });
  assert.equal((await ClinicalEvidenceService.requirementsForUser(diabetesId))[0].state,
    'DOCUMENT_REVIEW_REQUIRED');
  await assert.rejects(ClinicalEvidenceService.assertReadyForMealPlanning(diabetesId));
  const document = await ClinicalEvidenceService.upload({
    userId: diabetesId, area: ClinicalEvidenceArea.DIABETES,
    documentType: ClinicalDocumentType.MEDICAL_ABSTRACT,
    file: { buffer: Buffer.from('%PDF-1.7\nfictional acceptance document'),
      mimetype: 'application/pdf', originalname: 'fictional-diabetes.pdf' },
    consentAccepted: true,
  });
  assert.ok((await ClinicalEvidenceService.queue()).some((row) => row.id === document.id));
  const claimedDocument = await ClinicalEvidenceService.claimDetail(rnd.id, document.id);
  assert.deepEqual(claimedDocument.user.allergies, ['EGGS']);
  assert.equal((await ClinicalEvidenceService.fileForClaimedReview(rnd.id, rnd.userId, document.id))
    .buffer.toString(), '%PDF-1.7\nfictional acceptance document');
  await ClinicalEvidenceService.review({
    nutritionistProfileId: rnd.id, actorUserId: rnd.userId, documentId: document.id,
    decision: ClinicalDocumentReviewDecision.SUFFICIENT,
    rationale: 'Fictional medication context confirmed for workflow testing only.',
    validUntil: new Date(Date.now() + 30 * 86_400_000),
    confirmedFacts: [{ code: ClinicalFactCode.DIABETES_MEDICATION, valueText: 'INSULIN' }],
  });
  assert.equal((await ClinicalEvidenceService.requirementsForUser(diabetesId))[0].state, 'READY');

  const day = getManilaMidnight(getManilaDateKey(new Date()));
  const pendingProfiles = await ClinicalProfileReviewService.queue();
  for (const item of cases.filter((entry) => entry.condition !== HealthConditionType.NONE || entry.allergy !== AllergenType.NONE)) {
    const userId = users.get(item.label)!;
    assert.ok(pendingProfiles.some((entry) => entry.userId === userId), `${item.label} missing from profile queue.`);
    await assert.rejects(generate7DayPlan(userId, PlanType.WEEKLY, 1, day), /awaiting nutritionist review/);
    const detail = await ClinicalProfileReviewService.detail(userId);
    assert.equal(detail.conditions.includes(item.condition), item.condition !== HealthConditionType.NONE);
    assert.equal(detail.allergies.includes(item.allergy), item.allergy !== AllergenType.NONE);
    if (item.label === 'diabetes-eggs') assert.ok(detail.documents.some((entry) => entry.id === document.id));
    await ClinicalProfileReviewService.decide(rnd.id, userId, 'APPROVED',
      'Fictional profile context reviewed for isolated workflow testing.');
    await ClinicalProfileReviewService.assertReadyForMealPlanning(userId);
  }
  assert.ok(!(await ClinicalProfileReviewService.queue()).some((entry) => [...users.values()].includes(entry.userId)));
  const outcomes: Record<string, unknown> = {};
  for (const item of cases) {
    const userId = users.get(item.label)!;
    const cycleId = await generate7DayPlan(userId, PlanType.WEEKLY, 7, day);
    const meals = await prisma.mealPlan.findMany({ where: { planGroupId: cycleId }, orderBy: { mealType: 'asc' } });
    assert.equal(meals.length, 21, `${item.label} should have a complete three-meal, seven-day plan.`);
    for (const mealType of ['BREAKFAST', 'LUNCH', 'DINNER'] as const) {
      const slots = meals.filter((meal) => meal.mealType === mealType)
        .sort((left, right) => left.scheduledDate.getTime() - right.scheduledDate.getTime());
      assert.equal(slots.length, 7, `${item.label} is missing a ${mealType.toLowerCase()} slot.`);
      for (let index = 1; index < slots.length; index += 1) {
        const previousUse = slots.slice(0, index).reverse().find((slot) =>
          slot.libraryMealId === slots[index].libraryMealId);
        if (previousUse) {
          const daysApart = Math.round((slots[index].scheduledDate.getTime() -
            previousUse.scheduledDate.getTime()) / 86_400_000);
          assert.ok(daysApart >= 3, `${item.label} repeats ${mealType} before two intervening days.`);
        }
      }
    }
    const restricted = item.condition !== HealthConditionType.NONE || item.allergy !== AllergenType.NONE;
    assert.ok(meals.every((meal) => meal.status === (restricted ? 'PENDING_REVIEW' : 'APPROVED')),
      `${item.label} received the wrong initial case-approval state.`);
    assert.ok(meals.every((meal) => meal.libraryMealId && meal.baseRecipeSignature));
    if (restricted) {
      assert.ok(meals.every((meal) => meal.reviewApprovalCount === 0 && !meal.profileApprovalId));
      assert.equal((await MealPlanCycleService.getClearedMealPlanIds(userId, cycleId)).length, 0);
      if (item.label === 'eggs-only') {
        // A legacy auto-approved allergy row with only a stored count must not
        // survive the new read-time case-decision check.
        await prisma.mealPlan.update({ where: { id: meals[1].id }, data: {
          status: 'APPROVED', requiresSafetyRevalidation: false, reviewApprovalCount: 1,
        } });
        assert.ok(!(await MealPlanCycleService.getClearedMealPlanIds(userId, cycleId)).includes(meals[1].id));
        await prisma.mealPlan.update({ where: { id: meals[1].id }, data: {
          status: 'PENDING_REVIEW', requiresSafetyRevalidation: true, reviewApprovalCount: 0,
        } });
      }
      const queue = await NutritionistReviewService.getReviewQueue(rnd.id);
      assert.ok(queue.some((row) => row.userId === userId));
      const selected = meals[0];
      const detail = await NutritionistReviewService.getReviewCardDetails(rnd.id, selected.id, true);
      assert.ok(detail.claimStatus.claimedByMe);
      assert.equal(detail.user.conditions.includes(item.condition), item.condition !== HealthConditionType.NONE);
      assert.equal(detail.user.allergies.includes(item.allergy), item.allergy !== AllergenType.NONE);
      if (item.label === 'diabetes-eggs')
        assert.ok(detail.clinicalEvidence.documents.some((row) => row.id === document.id));
      await NutritionistReviewService.approveMealPlan(rnd.id, selected.id,
        'Fictional case decision after checking recorded profile and ingredients.');
      const approved = await prisma.mealPlan.findUniqueOrThrow({
        where: { id: selected.id }, include: { reviewDecisions: true },
      });
      assert.equal(approved.status, 'APPROVED');
      assert.equal(approved.reviewDecisions.filter((row) => row.decision === 'APPROVE').length, 1);
      assert.ok((await MealPlanCycleService.getClearedMealPlanIds(userId, cycleId)).includes(selected.id),
        `${item.label} was not actionable after its recorded case decision.`);
      if (item.label === 'eggs-only') {
        assert.ok(approved.profileApprovalId, 'Exact allergy case approval should publish reusable scope.');
        const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: {
          safetyProfileEntries: true, userProfile: true,
        } });
        const reusable = await queryEligibleLibraryMeals({
          mealType: selected.mealType, userConditions: [item.condition], userAllergens: [item.allergy],
          profile: { ...user.userProfile!, userId, safetyEntries: user.safetyProfileEntries },
        });
        assert.ok(reusable.some((meal) => meal.id === approved.libraryMealId));
        const sameCaseOtherUser = await queryEligibleLibraryMeals({
          mealType: selected.mealType, userConditions: ['NONE'], userAllergens: ['EGGS'],
          profile: { ...user.userProfile!, userId: `another-user-${marker}`, safetyEntries: [] },
        });
        assert.ok(sameCaseOtherUser.some((meal) => meal.id === approved.libraryMealId));
        const differentCase = await queryEligibleLibraryMeals({
          mealType: selected.mealType, userConditions: ['DIABETES'], userAllergens: ['EGGS'],
          profile: { ...user.userProfile!, userId: `another-user-${marker}`, safetyEntries: [] },
        });
        assert.ok(!differentCase.some((meal) => meal.id === approved.libraryMealId));
      }
    } else {
      assert.ok((await MealPlanCycleService.getClearedMealPlanIds(userId, cycleId)).length > 0);
    }
    outcomes[item.label] = { saved: meals.length, initial: restricted ? 'PENDING_REVIEW' : 'APPROVED',
      profileReviewed: restricted, caseReviewed: restricted };
  }
  const lead1 = await prisma.nutritionistProfile.findFirstOrThrow({
    where: { user: { email: 'nutritionist.lead1@gmail.com' } },
  });
  const lead2 = await prisma.nutritionistProfile.findFirstOrThrow({
    where: { user: { email: 'nutritionist.lead2@gmail.com' } },
  });
  const hypertensionId = users.get('hypertension')!;
  const highRiskSlots = await prisma.mealPlan.findMany({
    where: { userId: hypertensionId, status: 'PENDING_REVIEW' },
    orderBy: { id: 'asc' }, take: 2,
  });
  assert.equal(highRiskSlots.length, 2, 'Two pending meals are needed to test independent review and dispute.');
  const highRiskCycleId = highRiskSlots[0].planGroupId!;
  for (const slot of highRiskSlots) {
    await prisma.mealPlan.update({ where: { id: slot.id }, data: { highRiskReviewRequired: true } });
    await NutritionistReviewService.getReviewCardDetails(rnd.id, slot.id, true);
    const first = await NutritionistReviewService.approveMealPlan(rnd.id, slot.id,
      'Fictional first high-risk decision for isolated workflow testing.');
    assert.equal(first.awaitingSecondReview, true);
    assert.ok(!(await MealPlanCycleService.getClearedMealPlanIds(hypertensionId, highRiskCycleId)).includes(slot.id),
      'A first high-risk decision must not make the slot actionable.');
    await assert.rejects(NutritionistReviewService.getReviewCardDetails(rnd.id, slot.id, true),
      /Lead review|different nutritionist/i);
  }
  await NutritionistReviewService.getReviewCardDetails(lead1.id, highRiskSlots[0].id, true);
  await NutritionistReviewService.approveMealPlan(lead1.id, highRiskSlots[0].id,
    'Independent fictional second decision.');
  assert.ok((await MealPlanCycleService.getClearedMealPlanIds(hypertensionId, highRiskCycleId))
    .includes(highRiskSlots[0].id), 'Two independent approvals should release the case.');

  await NutritionistReviewService.getReviewCardDetails(lead1.id, highRiskSlots[1].id, true);
  await NutritionistReviewService.rejectMealPlan(lead1.id, highRiskSlots[1].id,
    'Independent fictional reviewer disagrees.');
  assert.equal((await prisma.mealPlan.findUniqueOrThrow({ where: { id: highRiskSlots[1].id } })).status,
    'DISPUTED');
  assert.ok(!(await MealPlanCycleService.getClearedMealPlanIds(hypertensionId, highRiskCycleId))
    .includes(highRiskSlots[1].id), 'A disputed slot must remain blocked.');
  await assert.rejects(NutritionistReviewService.resolveMealPlanDispute(lead1.id, highRiskSlots[1].id,
    'APPROVE', 'The disputing reviewer cannot adjudicate.'), /did not submit/i);
  await NutritionistReviewService.resolveMealPlanDispute(lead2.id, highRiskSlots[1].id,
    'APPROVE', 'Independent fictional lead adjudication.');
  assert.ok((await MealPlanCycleService.getClearedMealPlanIds(hypertensionId, highRiskCycleId))
    .includes(highRiskSlots[1].id), 'Independent lead resolution should release the case.');
  outcomes['high-risk-governance'] = { independentApproval: 'released', dispute: 'blocked then released' };

  const eggPlan = await prisma.mealPlan.findFirstOrThrow({
    where: { userId: users.get('eggs-only')!, status: 'APPROVED', profileApprovalId: { not: null } },
  });
  await prisma.mealLibraryProfileApproval.update({ where: { id: eggPlan.profileApprovalId! },
    data: { reviewDueAt: new Date(Date.now() - 86_400_000) } });
  assert.ok(!(await MealPlanCycleService.getClearedMealPlanIds(eggPlan.userId, eggPlan.planGroupId!))
    .includes(eggPlan.id), 'An overdue approval must not remain actionable.');
  await recheckProfileApproval({ nutritionistProfileId: lead1.id,
    mealLibraryId: eggPlan.libraryMealId!, approvalId: eggPlan.profileApprovalId!,
    rationale: 'Fictional scheduled approval recheck in isolated acceptance.' });
  assert.ok((await MealPlanCycleService.getClearedMealPlanIds(eggPlan.userId, eggPlan.planGroupId!))
    .includes(eggPlan.id), 'A current rechecked approval should become actionable again.');
  await flagMealApproval({ nutritionistProfileId: lead1.id,
    mealLibraryId: eggPlan.libraryMealId!, kind: 'PROFILE', approvalId: eggPlan.profileApprovalId!,
    reason: 'Fictional scoped approval flag for isolated lifecycle testing.' });
  assert.ok(!(await MealPlanCycleService.getClearedMealPlanIds(eggPlan.userId, eggPlan.planGroupId!))
    .includes(eggPlan.id), 'A scoped flag must block its approved plan slot.');
  await recheckProfileApproval({ nutritionistProfileId: lead2.id,
    mealLibraryId: eggPlan.libraryMealId!, approvalId: eggPlan.profileApprovalId!,
    rationale: 'Fictional scoped approval recheck after flag resolution.' });
  assert.equal((await prisma.mealLibraryProfileApproval.findUniqueOrThrow({
    where: { id: eggPlan.profileApprovalId! },
  })).flaggedAt, null);
  assert.ok(!(await MealPlanCycleService.getClearedMealPlanIds(eggPlan.userId, eggPlan.planGroupId!))
    .includes(eggPlan.id), 'A recheck must not silently restore a previously invalidated plan slot.');

  const healthyPlan = await prisma.mealPlan.findFirstOrThrow({
    where: { userId: users.get('healthy-omni')!, status: 'APPROVED', libraryMealId: { not: null } },
  });
  await flagWholeMeal(rnd.id, healthyPlan.libraryMealId!,
    'Fictional whole-meal flag for isolated lifecycle testing.');
  assert.ok(!(await MealPlanCycleService.getClearedMealPlanIds(healthyPlan.userId, healthyPlan.planGroupId!))
    .includes(healthyPlan.id), 'A whole-meal flag must block its plan slots.');
  assert.equal(await prisma.mealPlan.count({ where: { libraryMealId: healthyPlan.libraryMealId!,
    status: 'APPROVED', requiresSafetyRevalidation: false } }), 0);
  await releaseWholeMeal(lead1.id, healthyPlan.libraryMealId!,
    'Independent fictional whole-meal release after review.');
  assert.ok(!(await MealPlanCycleService.getClearedMealPlanIds(healthyPlan.userId, healthyPlan.planGroupId!))
    .includes(healthyPlan.id), 'Meal release must not silently restore old plan slots.');
  outcomes['approval-lifecycle'] = { scopedFlag: 'blocked and rechecked',
    scheduledDue: 'blocked and rechecked', wholeMealFlag: 'blocked across plans' };
  await prisma.user.create({ data: {
    email: `cf-profile-ui-${marker}@example.com`, name: 'Case flow profile UI', passwordHash,
    role: Role.USER, emailVerified: true, onboardingDone: true, tosAccepted: true,
    userProfile: { create: { age: 30, biologicalSex: 'FEMALE', heightCm: 160, weightKg: 60,
      goal: Goal.MAINTAIN, activityLevel: ActivityLevel.LIGHTLY_ACTIVE,
      dietaryPreference: DietaryPreference.OMNIVORE, dailyCalorieTarget: 1200 } },
    healthConditions: { create: { condition: HealthConditionType.NONE } },
    allergies: { create: { allergen: AllergenType.EGGS } },
  } });
  console.log(JSON.stringify({ passed: true, runId: marker, mealOnlyVerification: 'separate from planning evidence',
    profileDocument: 'claimed and reviewed before diabetes case', outcomes }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());

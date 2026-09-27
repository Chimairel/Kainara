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
import { MealBaseVerificationService } from '../src/services/meal-base-verification.service';
import { MealPlanCycleService } from '../src/services/meal-plan-cycle.service';
import { generate7DayPlan } from '../src/services/meal-plan-composition.service';
import { NutritionistReviewService } from '../src/services/nutritionist-review.service';
import { queryEligibleLibraryMeals } from '../src/services/meal-library-candidate-query.service';
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
  const outcomes: Record<string, unknown> = {};
  for (const item of cases) {
    const userId = users.get(item.label)!;
    const cycleId = await generate7DayPlan(userId, PlanType.WEEKLY, 1, day);
    const meals = await prisma.mealPlan.findMany({ where: { planGroupId: cycleId }, orderBy: { mealType: 'asc' } });
    assert.ok(meals.length > 0, `${item.label} should have saved a base recipe candidate.`);
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
      caseReviewed: restricted };
  }
  console.log(JSON.stringify({ passed: true, mealOnlyVerification: 'separate from planning evidence',
    profileDocument: 'claimed and reviewed before diabetes case', outcomes }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());

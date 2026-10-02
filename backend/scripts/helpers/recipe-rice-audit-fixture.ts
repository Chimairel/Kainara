import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import type { FoodItem } from '@prisma/client';
import prisma from '../../src/lib/prisma';
import { savePreparedCorpusMeal } from '../../src/services/meal-plan-corpus-persistence.service';
import { replaceRetiredPlanMeals } from '../../src/services/retired-plan-repair.service';
import { getManilaDateKey, getManilaMidnight } from '../../src/domain/meal-plan-cycle.policy';
import { GroceryService } from '../../src/services/grocery.service';
import { NUTRITION_GUIDANCE_POLICY_VERSION } from '../../src/domain/deterministic-nutrition-report.policy';
import { adaptUserSafetyRestrictions } from '../../src/domain/structured-restriction.adapter';

export async function verifyRawRiceAndRetiredRepair(reviewerId: string, food: FoodItem, rice: FoodItem) {
  const database = new URL(process.env.DATABASE_URL ?? '');
  assert.ok(['localhost', '127.0.0.1'].includes(database.hostname) && database.pathname === '/recipe_rice_acceptance');
  const run = randomUUID();
  const user = await prisma.user.create({
    data: {
      name: 'Audit repair fixture',
      email: `audit-repair-${run}@example.invalid`,
      passwordHash: 'disabled',
      role: 'USER',
      onboardingDone: true,
      emailVerified: true,
      tosAccepted: true,
      userProfile: {
        create: {
          age: 25,
          biologicalSex: 'MALE',
          weightKg: 65,
          heightCm: 168,
          activityLevel: 'SEDENTARY',
          goal: 'MAINTAIN',
          dailyCalorieTarget: 2000,
          dietaryPreference: 'OMNIVORE',
          planningReportVersion: 1,
        },
      },
      safetyProfileEntries: {
        create: ['CONDITION', 'ALLERGY'].map((domain) => ({
          domain: domain as 'CONDITION' | 'ALLERGY',
          canonicalCode: 'NONE',
          displayName: 'None',
          originalText: 'None',
          normalizedText: 'none',
          provenance: 'PREDEFINED',
          supportState: 'SUPPORTED',
          policyReference: 'acceptance',
        })),
      },
    },
  });
  const userId = user.id;
  const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId } });
  await prisma.nutritionReportVersion.create({
    data: {
      userId,
      version: 1,
      profileRevision: profile.revision,
      acknowledgedAt: new Date(),
      policyVersion: NUTRITION_GUIDANCE_POLICY_VERSION,
      content: {},
      profileSnapshot: { profile: JSON.parse(JSON.stringify(profile)) },
    },
  });
  const today = getManilaMidnight(getManilaDateKey(new Date()));
  const nutrition = { calories: 400, proteinG: 30, carbsG: 10, fatG: 20 };
  const source = await prisma.rawRecipeCandidate.create({
    data: {
      sourceRecordId: `raw-rice-audit-${run}`,
      sourceName: 'PANLASANG_PINOY',
      sourceUrl: 'https://panlasangpinoy.com/acceptance-fixture/',
      recipeName: `Chicken audit fixture ${run}`,
      normalizedName: `chicken audit fixture ${run}`,
      contentSignature: createHash('sha256').update(run).digest('hex'),
      category: 'Main dish',
      cuisines: [],
      dietaryTags: ['OMNIVORE'],
      mealType: 'BREAKFAST',
      ingredients: [{ name: food.name, quantity: 100, unit: 'g', foodItemId: food.id }],
      publishedNutrition: nutrition,
      ...nutrition,
      applicableMealTypes: { create: [{ mealType: 'BREAKFAST' }, { mealType: 'DINNER' }] },
    },
  });
  const cycle = await prisma.mealPlanCycle.create({
    data: {
      id: `audit-repair-${run}`,
      cycleRevision: 2,
      userId,
      planType: 'WEEKLY',
      startDate: today,
      endDate: new Date(today.getTime() + 86400000),
      preparationOpensAt: today,
      shoppingDeadlineAt: today,
      expectedSlotCount: 3,
      status: 'ACTIVE',
      snapshot: {
        create: {
          userId,
          profileRevision: profile.revision,
          safetyRevision: profile.safetyRevision,
          nutritionReportVersion: profile.planningReportVersion,
          weightKg: profile.weightKg!,
          activityLevel: profile.activityLevel!,
          goal: profile.goal!,
          dailyCalorieTarget: profile.dailyCalorieTarget!,
          dailyMacroTargets: {},
          planningGeographyLevel: 'NATIONAL',
        },
      },
    },
  });
  const libraryCount = await prisma.mealLibrary.count();
  const kept = await prisma.$transaction((tx) =>
    savePreparedCorpusMeal(tx, {
      userId,
      planGroupId: cycle.id,
      planType: 'WEEKLY',
      autoGeneralBase: true,
      sourceEvidence: source,
      highRiskReviewRequired: false,
      userConditions: [],
      userAllergens: [],
      planConditions: [],
      otherConditions: null,
      otherAllergies: null,
      safetyEntries: [],
      selectionEvidence: { servingScale: 1 },
      riceFood: rice,
      meal: {
        ...nutrition,
        mealType: 'DINNER',
        mealName: source.recipeName,
        description: 'Fixture published serving',
        scheduledDate: today,
        aiConfidenceFlag: 'CAUTION',
        rawCandidateId: source.id,
        servingScale: 1,
        pairedRiceG: 150,
        candidateProvenance: 'RAW_RECIPE_CORPUS',
        ingredientsData: [
          {
            ingredientName: food.name,
            category: 'PROTEIN',
            foodItemId: food.id,
            dataSource: 'SOURCE_RECIPE',
            quantity: 100,
            unit: 'g',
          },
        ],
      },
    })
  );
  assert.equal(kept.calories, 595);
  assert.equal(kept.carbsG, 52);
  assert.equal(await prisma.mealLibrary.count(), libraryCount);
  const list = await GroceryService.generateGroceryList(userId, undefined, cycle.id);
  const purchased = list.groceryItems.find((item) => item.ingredientName === food.name)!;
  assert.ok(purchased);
  await prisma.groceryItem.update({ where: { id: purchased.id }, data: { purchasedQuantity: 40 } });
  await prisma.mealPlanCycle.update({ where: { id: cycle.id }, data: { shoppingStartedAt: new Date() } });
  const log = await prisma.mealLog.create({
    data: {
      userId,
      mealPlanId: kept.id,
      mealName: kept.mealName,
      mealType: kept.mealType,
      status: 'DONE',
      source: 'SYSTEM_GENERATED',
      dataSource: 'SYSTEM',
      calories: kept.calories,
      proteinG: kept.proteinG,
      carbsG: kept.carbsG,
      fatG: kept.fatG,
    },
  });
  const retired = await prisma.mealLibrary.create({
    data: {
      mealName: `Retired fixture ${run}`,
      mealType: 'BREAKFAST',
      status: 'ARCHIVED',
      safetyInvalidationReason: 'SEEDED_FIXTURE_RETIRED',
      calories: 600,
      proteinG: 20,
      carbsG: 30,
      fatG: 15,
    },
  });
  const old = await prisma.mealPlan.create({
    data: {
      userId,
      planGroupId: cycle.id,
      libraryMealId: retired.id,
      mealName: retired.mealName,
      mealType: 'BREAKFAST',
      scheduledDate: today,
      status: 'APPROVED',
      requiresSafetyRevalidation: true,
      calories: retired.calories,
      proteinG: retired.proteinG,
      carbsG: retired.carbsG,
      fatG: retired.fatG,
    },
  });
  const countAfterFixture = await prisma.mealLibrary.count();
  const usage = await prisma.membershipUsage.count({ where: { userId } });
  await assert.rejects(replaceRetiredPlanMeals('someone-else', cycle.id));
  const repairs = await Promise.all([
    replaceRetiredPlanMeals(userId, cycle.id),
    replaceRetiredPlanMeals(userId, cycle.id),
  ]);
  assert.equal(
    repairs.reduce((sum, repair) => sum + repair.replaced, 0),
    1
  );
  assert.ok(repairs.every((repair) => repair.awaitingReplacement === 0));
  assert.equal((await prisma.mealPlan.findUniqueOrThrow({ where: { id: old.id } })).status, 'CANCELLED');
  assert.deepEqual(await prisma.mealLog.findUniqueOrThrow({ where: { id: log.id } }), log);
  assert.deepEqual(await prisma.mealPlan.findUniqueOrThrow({ where: { id: kept.id } }), kept);
  const replaced = await prisma.mealPlan.findFirstOrThrow({
    where: { userId, planGroupId: cycle.id, mealType: 'BREAKFAST', status: 'APPROVED' },
    include: { servingComponents: true },
  });
  assert.equal(replaced.calories, 595);
  assert.equal(replaced.servingComponents.filter((item) => item.componentType === 'COOKED_RICE').length, 1);
  assert.equal(await prisma.mealLibrary.count(), countAfterFixture);
  assert.equal(await prisma.membershipUsage.count({ where: { userId } }), usage);
  const updatedList = await prisma.groceryList.findUniqueOrThrow({
    where: { id: list.id },
    include: { groceryItems: true },
  });
  assert.equal(updatedList.groceryItems.find((item) => item.ingredientName === food.name)?.purchasedQuantity, 40);
  assert.equal(updatedList.groceryItems.find((item) => item.ingredientName === rice.name)?.quantity, 300);
  assert.deepEqual(await replaceRetiredPlanMeals(userId, cycle.id), { replaced: 0, awaitingReplacement: 0 });
  // Explicit synthetic case approval is confined to this disposable database.
  await prisma.safetyProfileEntry.updateMany({
    where: { userId, domain: 'ALLERGY' },
    data: { canonicalCode: 'EGGS', displayName: 'Eggs', originalText: 'Eggs', normalizedText: 'eggs' },
  });
  const entries = await prisma.safetyProfileEntry.findMany({ where: { userId } });
  const restrictions = adaptUserSafetyRestrictions({ safetyEntries: entries });
  await prisma.clinicalProfileReview.create({
    data: {
      id: randomUUID(),
      userId,
      reviewerId,
      status: 'APPROVED',
      profileRevision: profile.revision,
      policyVersion: 'NUTRIMIND_PROFILE_REVIEW_V1',
      reasonCodes: [],
      profileSnapshot: {
        safetyRevision: profile.safetyRevision,
        conditions: restrictions.conditions,
        allergies: restrictions.allergies,
        customConditions: restrictions.customConditions,
        customFoodRestrictions: restrictions.customFoodRestrictions,
      },
    },
  });
  await prisma.membershipAccount.upsert({
    where: { userId },
    create: { userId, createdAt: new Date(Date.now() - 40 * 86400000), trialStartedAt: new Date() },
    update: { createdAt: new Date(Date.now() - 40 * 86400000), trialStartedAt: new Date() },
  });
  const caseTarget = await prisma.mealPlan.create({
    data: {
      userId,
      planGroupId: cycle.id,
      libraryMealId: retired.id,
      mealName: retired.mealName,
      mealType: 'DINNER',
      scheduledDate: today,
      status: 'APPROVED',
      requiresSafetyRevalidation: true,
      calories: 600,
      proteinG: 20,
      carbsG: 30,
      fatG: 15,
    },
  });
  const notifications = await prisma.notification.count({ where: { userId: { not: userId }, type: 'REVIEW_REQUEST' } });
  assert.deepEqual(await replaceRetiredPlanMeals(userId, cycle.id), { replaced: 1, awaitingReplacement: 0 });
  assert.equal((await prisma.mealPlan.findUniqueOrThrow({ where: { id: caseTarget.id } })).status, 'CANCELLED');
  const caseReplacement = await prisma.mealPlan.findFirstOrThrow({
    where: { userId, planGroupId: cycle.id, mealType: 'DINNER', status: 'PENDING_REVIEW' },
  });
  assert.equal(caseReplacement.requiresSafetyRevalidation, true);
  assert.equal(caseReplacement.calories, 595);
  assert.equal(
    await prisma.membershipUsage.count({
      where: { userId, feature: 'PLAN_REVIEW', resultEntityId: cycle.id, completedAt: { not: null } },
    }),
    1
  );
  assert.ok(
    (await prisma.notification.count({ where: { userId: { not: userId }, type: 'REVIEW_REQUEST' } })) > notifications
  );
  await prisma.membershipAccount.update({
    where: { userId },
    data: { trialStartedAt: new Date(Date.now() - 30 * 86400000) },
  });
  assert.deepEqual(await replaceRetiredPlanMeals(userId, cycle.id), { replaced: 0, awaitingReplacement: 0 });
  const next = await prisma.mealPlanCycle.create({
    data: {
      userId,
      id: `expired-repair-${run}`,
      cycleRevision: 3,
      planType: 'WEEKLY',
      startDate: new Date(today.getTime() + 7 * 86400000),
      endDate: new Date(today.getTime() + 13 * 86400000),
      preparationOpensAt: today,
      shoppingDeadlineAt: today,
      status: 'PREPARING',
      expectedSlotCount: 21,
      snapshot: {
        create: {
          userId,
          profileRevision: profile.revision,
          safetyRevision: profile.safetyRevision,
          nutritionReportVersion: 1,
          weightKg: profile.weightKg!,
          activityLevel: profile.activityLevel!,
          goal: profile.goal!,
          dailyCalorieTarget: 2000,
          dailyMacroTargets: {},
          planningGeographyLevel: 'NATIONAL',
        },
      },
    },
  });
  await assert.rejects(replaceRetiredPlanMeals(userId, next.id), /Health membership/);
  console.log(
    'PASS: restricted replacements stay pending, reserve one review episode, notify reviewers and reject new case work after expiry.'
  );
  console.log(
    'PASS: raw published dish plus rice, no library growth, targeted retirement repair, unchanged consumed meal/history/purchases, no membership allowance and idempotent replay.'
  );
}

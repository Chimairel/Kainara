import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MealPlanCycleStatus, MealPlanStatus, MealType, PlanType } from '@prisma/client';
import prisma from '../src/lib/prisma';
import { GroceryService } from '../src/services/grocery.service';
import { MealPlanCycleService } from '../src/services/meal-plan-cycle.service';
import { libraryBaseRevisionKey } from '../src/services/meal-base-admission.service';

const day = 86_400_000;

async function main() {
  const run = randomUUID();
  let userId: string | null = null;
  let libraryMealId: string | null = null;
  try {
    const user = await prisma.user.create({
      data: {
        name: 'Batch 5 Grocery Fixture',
        email: `batch5-${run}@example.invalid`,
        passwordHash: 'disabled',
        emailVerified: true,
        safetyProfileEntries: { create: [
          {
            domain: 'CONDITION', canonicalCode: 'NONE', displayName: 'No diagnosed condition',
            originalText: 'None', normalizedText: 'none', provenance: 'PREDEFINED',
            supportState: 'SUPPORTED', policyReference: 'TEST_DECLARATION',
          },
          {
            domain: 'ALLERGY', canonicalCode: 'NONE', displayName: 'No declared allergy',
            originalText: 'None', normalizedText: 'none', provenance: 'PREDEFINED',
            supportState: 'SUPPORTED', policyReference: 'TEST_DECLARATION',
          },
        ] },
        userProfile: {
          create: {
            age: 30,
            biologicalSex: 'FEMALE',
            heightCm: 160,
            weightKg: 60,
            targetWeightKg: 60,
            goal: 'MAINTAIN',
            activityLevel: 'LIGHTLY_ACTIVE',
            dietaryPreference: 'OMNIVORE',
            dailyCalorieTarget: 1900,
            shoppingDayOfWeek: 6,
          },
        },
      },
    });
    userId = user.id;
    const recipeSignature = randomUUID().replaceAll('-', '');
    const libraryMeal = await prisma.mealLibrary.create({
      data: {
        mealName: `Batch 5 cleared meal ${run}`,
        mealType: MealType.BREAKFAST,
        calories: 450,
        proteinG: 25,
        carbsG: 50,
        fatG: 15,
        recipeSignature,
        status: 'APPROVED',
        safetyEvidenceStatus: 'COMPLETE',
      },
    });
    libraryMealId = libraryMeal.id;
    await prisma.mealBaseVerification.create({
      data: {
        targetKind: 'LIBRARY_MEAL', targetId: libraryMeal.id,
        revisionKey: libraryBaseRevisionKey(recipeSignature, libraryMeal.description),
        status: 'VERIFIED',
      },
    });

    const now = new Date();
    const progressiveId = `batch5-progressive-${run}`;
    const startDate = new Date(now.getTime() + 2 * day);
    await prisma.mealPlanCycle.create({
      data: {
        id: progressiveId,
        userId: user.id,
        planType: PlanType.WEEKLY,
        startDate,
        endDate: new Date(startDate.getTime() + 6 * day),
        preparationOpensAt: new Date(now.getTime() - day),
        shoppingDeadlineAt: new Date(now.getTime() + day),
        expectedSlotCount: 2,
        status: MealPlanCycleStatus.UNDER_REVIEW,
      },
    });
    const cleared = await prisma.mealPlan.create({
      data: {
        planGroupId: progressiveId,
        userId: user.id,
        libraryMealId: libraryMeal.id,
        status: MealPlanStatus.APPROVED,
        planType: PlanType.WEEKLY,
        mealType: MealType.BREAKFAST,
        mealName: libraryMeal.mealName,
        calories: 450,
        proteinG: 25,
        carbsG: 50,
        fatG: 15,
        scheduledDate: startDate,
        reviewedAt: now,
        requiresSafetyRevalidation: false,
        safetyPolicyVersion: 'MEAL_PLAN_SAFETY_V2',
        baseRecipeSignature: recipeSignature,
        composedServingSignature: recipeSignature,
        ingredients: { create: { ingredientName: 'Chicken', category: 'Meat', quantity: 500, unit: 'g' } },
      },
    });
    const pending = await prisma.mealPlan.create({
      data: {
        planGroupId: progressiveId,
        userId: user.id,
        libraryMealId: libraryMeal.id,
        status: MealPlanStatus.PENDING_REVIEW,
        planType: PlanType.WEEKLY,
        mealType: MealType.LUNCH,
        mealName: 'Pending candidate',
        calories: 450,
        proteinG: 25,
        carbsG: 50,
        fatG: 15,
        scheduledDate: startDate,
        requiresSafetyRevalidation: false,
        safetyPolicyVersion: 'MEAL_PLAN_SAFETY_V2',
        baseRecipeSignature: recipeSignature,
        composedServingSignature: recipeSignature,
        ingredients: { create: { ingredientName: 'Brown rice', category: 'Grain', quantity: 300, unit: 'g' } },
      },
    });
    const delayedCompeting = await prisma.mealPlan.create({
      data: {
        planGroupId: progressiveId,
        userId: user.id,
        libraryMealId: libraryMeal.id,
        status: MealPlanStatus.PENDING_REVIEW,
        planType: PlanType.WEEKLY,
        mealType: MealType.BREAKFAST,
        mealName: 'Delayed competing candidate',
        calories: 450,
        proteinG: 25,
        carbsG: 50,
        fatG: 15,
        scheduledDate: startDate,
        requiresSafetyRevalidation: false,
        safetyPolicyVersion: 'MEAL_PLAN_SAFETY_V2',
        baseRecipeSignature: recipeSignature,
        composedServingSignature: recipeSignature,
        ingredients: { create: { ingredientName: 'Late salt', category: 'Seasoning', quantity: 5, unit: 'g' } },
      },
    });

    const preview = await GroceryService.getCycleProjection(user.id, progressiveId, now);
    assert.equal(preview.coverage.clearedSlotCount, 1);
    assert.equal(preview.coverage.unresolvedSlotCount, 1);
    assert.equal(preview.actionability.canCheckItems, true);
    assert.equal(preview.actionability.canExportPdf, false);
    assert.deepEqual(
      preview.groceryList?.groceryItems.map((item) => item.ingredientName),
      ['Chicken']
    );
    const previewChickenId = preview.groceryList!.groceryItems[0].id;
    const previewChecked = await GroceryService.toggleGroceryItem(user.id, previewChickenId);
    assert.equal(previewChecked.isChecked, true);
    assert.equal((await prisma.mealPlanCycle.findUniqueOrThrow({ where: { id: progressiveId } })).shoppingStartedAt, null);

    await prisma.mealPlan.update({
      where: { id: pending.id },
      data: { status: MealPlanStatus.APPROVED, reviewedAt: now },
    });
    await prisma.groceryList.updateMany({ where: { planGroupId: progressiveId }, data: { isStale: true } });
    const ready = await GroceryService.getCycleProjection(user.id, progressiveId, now);
    assert.equal(ready.coverage.clearedSlotCount, 2);
    assert.equal(ready.actionability.canCheckItems, true);
    assert.equal(ready.actionability.canExportPdf, true);
    assert.deepEqual(ready.groceryList?.groceryItems.map((item) => item.ingredientName).sort(), [
      'Brown rice',
      'Chicken',
    ]);
    assert.equal(ready.groceryList?.groceryItems.find((item) => item.id === previewChickenId)?.isChecked, true);

    const readyIds = ready.groceryList!.groceryItems.map((item) => item.id);
    await assert.rejects(
      GroceryService.setGroceryItemsChecked(user.id, [...readyIds, 'another-list-item'], true),
      /Shopping list changed/
    );
    assert.equal(await prisma.groceryItem.count({ where: { id: { in: readyIds }, isChecked: true } }), 1);
    const checked = await GroceryService.setGroceryItemsChecked(user.id, readyIds, true);
    assert.equal(checked.length, 2);
    assert.ok(checked.every((item) => item.isChecked && item.purchasedQuantity === item.quantity));
    const unchecked = await GroceryService.toggleGroceryItem(user.id, readyIds[0]);
    assert.equal(unchecked.isChecked, false);
    assert.equal(unchecked.purchasedQuantity, 0);

    assert.ok((await prisma.mealPlanCycle.findUniqueOrThrow({ where: { id: progressiveId } })).shoppingStartedAt);
    await prisma.mealPlan.update({
      where: { id: delayedCompeting.id },
      data: { status: MealPlanStatus.APPROVED, reviewedAt: new Date(now.getTime() + 1_000) },
    });
    await prisma.groceryList.updateMany({ where: { planGroupId: progressiveId }, data: { isStale: true } });
    const frozen = await GroceryService.getCycleProjection(user.id, progressiveId, new Date(now.getTime() + 2_000));
    assert.equal(frozen.actionability.canCheckItems, true);
    assert.equal(frozen.groceryList?.isStale, false);
    assert.equal(
      frozen.groceryList?.groceryItems.some((item) => item.ingredientName === 'Late salt'),
      false
    );

    const incompleteId = `batch5-incomplete-${run}`;
    const incompleteStart = new Date(now.getTime() + 3 * day);
    await prisma.mealPlanCycle.create({
      data: {
        id: incompleteId,
        userId: user.id,
        planType: PlanType.WEEKLY,
        startDate: incompleteStart,
        endDate: new Date(incompleteStart.getTime() + 6 * day),
        preparationOpensAt: new Date(now.getTime() - 2 * day),
        shoppingDeadlineAt: new Date(now.getTime() - 1_000),
        expectedSlotCount: 2,
        status: MealPlanCycleStatus.UNDER_REVIEW,
      },
    });
    await prisma.mealPlan.create({
      data: {
        planGroupId: incompleteId,
        userId: user.id,
        libraryMealId: libraryMeal.id,
        status: MealPlanStatus.APPROVED,
        planType: PlanType.WEEKLY,
        mealType: MealType.BREAKFAST,
        mealName: libraryMeal.mealName,
        calories: 450,
        proteinG: 25,
        carbsG: 50,
        fatG: 15,
        scheduledDate: incompleteStart,
        reviewedAt: now,
        requiresSafetyRevalidation: false,
        safetyPolicyVersion: 'MEAL_PLAN_SAFETY_V2',
        baseRecipeSignature: recipeSignature,
        composedServingSignature: recipeSignature,
        ingredients: { create: { ingredientName: 'Eggs', category: 'Protein', quantity: 6, unit: 'piece' } },
      },
    });
    const incomplete = await GroceryService.getCycleProjection(user.id, incompleteId, now);
    assert.equal(incomplete.cycle.status, MealPlanCycleStatus.INCOMPLETE_AT_DEADLINE);
    assert.equal(incomplete.actionability.requiresIncompleteAcknowledgment, true);
    assert.equal(incomplete.actionability.canExportPdf, false);
    await MealPlanCycleService.acknowledgeIncompleteCycle(user.id, incompleteId, now);
    const accepted = await GroceryService.getCycleProjection(user.id, incompleteId, now);
    assert.equal(accepted.actionability.isIncomplete, true);
    assert.equal(accepted.actionability.canCheckItems, true);
    assert.equal(accepted.actionability.canExportPdf, true);

    // A missed cutoff remains audit history, but a later complete, unfrozen
    // list must become usable without accepting a partial subset.
    const lateCompleteId = `batch5-late-complete-${run}`;
    const lateStart = new Date(now.getTime() + 4 * day);
    await prisma.mealPlanCycle.create({
      data: {
        id: lateCompleteId,
        userId: user.id,
        planType: PlanType.WEEKLY,
        startDate: lateStart,
        endDate: new Date(lateStart.getTime() + 6 * day),
        preparationOpensAt: new Date(now.getTime() - 2 * day),
        shoppingDeadlineAt: new Date(now.getTime() - 1_000),
        expectedSlotCount: 2,
        status: MealPlanCycleStatus.UNDER_REVIEW,
      },
    });
    const lateMeal = {
      planGroupId: lateCompleteId,
      userId: user.id,
      libraryMealId: libraryMeal.id,
      planType: PlanType.WEEKLY,
      mealName: libraryMeal.mealName,
      calories: 450,
      proteinG: 25,
      carbsG: 50,
      fatG: 15,
      scheduledDate: lateStart,
      requiresSafetyRevalidation: false,
      safetyPolicyVersion: 'MEAL_PLAN_SAFETY_V2',
      baseRecipeSignature: recipeSignature,
      composedServingSignature: recipeSignature,
    };
    await prisma.mealPlan.create({
      data: {
        ...lateMeal,
        status: MealPlanStatus.APPROVED,
        mealType: MealType.BREAKFAST,
        reviewedAt: now,
        ingredients: { create: { ingredientName: 'Eggs', category: 'Protein', quantity: 6, unit: 'piece' } },
      },
    });
    const latePending = await prisma.mealPlan.create({
      data: {
        ...lateMeal,
        status: MealPlanStatus.PENDING_REVIEW,
        mealType: MealType.LUNCH,
        ingredients: { create: { ingredientName: 'Rice', category: 'Grain', quantity: 300, unit: 'g' } },
      },
    });
    const latePartial = await GroceryService.getCycleProjection(user.id, lateCompleteId, now);
    assert.equal(latePartial.actionability.requiresIncompleteAcknowledgment, true);
    await prisma.mealPlan.update({
      where: { id: latePending.id },
      data: { status: MealPlanStatus.APPROVED, reviewedAt: new Date(now.getTime() + 1_000) },
    });
    await prisma.groceryList.updateMany({ where: { planGroupId: lateCompleteId }, data: { isStale: true } });
    const lateComplete = await GroceryService.getCycleProjection(user.id, lateCompleteId, new Date(now.getTime() + 2_000));
    assert.equal(lateComplete.cycle.deadlineOutcome, 'INCOMPLETE');
    assert.equal(lateComplete.coverage.unresolvedSlotCount, 0);
    assert.equal(lateComplete.actionability.requiresIncompleteAcknowledgment, false);
    assert.equal(lateComplete.actionability.canCheckItems, true);
    const lateItemId = lateComplete.groceryList!.groceryItems[0].id;
    assert.equal((await GroceryService.toggleGroceryItem(user.id, lateItemId)).isChecked, true);
    assert.equal((await GroceryService.toggleGroceryItem(user.id, lateItemId)).isChecked, false);
    assert.ok((await prisma.mealPlanCycle.findUniqueOrThrow({ where: { id: lateCompleteId } })).shoppingStartedAt);

    assert.ok(cleared.id);
    console.log('[Batch 5 acceptance] PASS');
  } finally {
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    if (libraryMealId) {
      await prisma.mealBaseVerification.deleteMany({ where: { targetKind: 'LIBRARY_MEAL', targetId: libraryMealId } }).catch(() => undefined);
      await prisma.mealLibrary.delete({ where: { id: libraryMealId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[Batch 5 acceptance] FAIL', error);
  process.exitCode = 1;
});

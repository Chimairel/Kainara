import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import type { FoodItem } from '@prisma/client';
import prisma from '../../src/lib/prisma';
import { MealSwapService } from '../../src/services/meal-swap.service';
import { serializeActionableMeal } from '../../src/services/meal-plan-presentation.service';
import { proposeRiceRole } from '../../src/domain/recipe-rice-role.policy';

/** Mutations are confined to the same guarded disposable acceptance database. */
export async function verifySourcePlateSwaps(
  userId: string,
  slotId: string,
  cycleId: string,
  food: FoodItem,
  rice: FoodItem
) {
  const database = new URL(process.env.DATABASE_URL ?? '');
  assert.ok(['127.0.0.1', 'localhost'].includes(database.hostname) && database.pathname === '/recipe_rice_acceptance');
  const libraryCount = await prisma.mealLibrary.count();
  const originalSlot = await prisma.mealPlan.findUniqueOrThrow({
    where: { id: slotId },
    include: { servingComponents: true },
  });
  const originalRice = originalSlot.servingComponents.find((c) => c.componentType === 'COOKED_RICE')!.quantityG!;
  const run = randomUUID();
  const makeSource = async (name: string, category: string, calories: number) =>
    prisma.rawRecipeCandidate.create({
      data: {
        sourceRecordId: `${name}-${run}`,
        sourceName: 'PANLASANG_PINOY',
        sourceUrl: `https://panlasangpinoy.com/${name}/`,
        sourceImageUrl: `https://panlasangpinoy.com/wp-content/uploads/${name}.jpg`,
        recipeName: `${name} ${run}`,
        normalizedName: `${name} ${run}`,
        category,
        riceRole: proposeRiceRole({ name, category, ingredients: [{ name: food.name }] }).riceRole,
        riceRoleReviewStatus: 'PROPOSED',
        cuisines: [],
        dietaryTags: ['OMNIVORE'],
        mealType: 'BREAKFAST',
        applicableMealTypes: { create: [{ mealType: 'BREAKFAST' }] },
        contentSignature: createHash('sha256')
          .update(name + run)
          .digest('hex'),
        ingredients: [{ name: food.name, quantity: 100, unit: 'g', foodItemId: food.id }],
        calories,
        proteinG: 30,
        carbsG: 20,
        fatG: 15,
        publishedNutrition: { calories, proteinG: 30, carbsG: 20, fatG: 15 },
      },
    });
  const paired = await makeSource('Chicken swap fixture', 'Main dish', 550);
  const standalone = await makeSource('Salad swap fixture', 'Salad', 600);
  const unavailable = await makeSource('Archived swap fixture', 'Main dish', 550);
  await prisma.rawRecipeCandidate.update({ where: { id: unavailable.id }, data: { status: 'RETIRED' } });
  const { swapOptions: options } = await MealSwapService.getEligibleSwapOptions(userId, slotId);
  const pairedOption = options.find((item) => item.id === `source:${paired.id}`)!;
  assert.ok(pairedOption, 'An eligible published source is offered even without a certified library variant.');
  assert.equal(pairedOption.reuseBasis, 'PANLASANG_GENERAL_BASE');
  assert.ok(pairedOption.calories >= 510 && pairedOption.calories <= 690);
  assert.ok([75, 150, 225].includes(pairedOption.pairedRiceG!));
  assert.ok(Number.isFinite(pairedOption.nutritionFitScore));
  assert.ok(!('canFavorite' in pairedOption));
  assert.ok(!options.some((item) => item.id === `source:${unavailable.id}`));
  const list = await prisma.groceryList.findFirstOrThrow({
    where: { userId, planGroupId: cycleId },
    include: { groceryItems: true },
  });
  const riceItem = list.groceryItems.find((item) => item.ingredientName === rice.name)!;
  assert.equal(riceItem.quantity, 150 + originalRice);
  await prisma.groceryItem.update({ where: { id: riceItem.id }, data: { purchasedQuantity: 260 } });
  let preview = await MealSwapService.getSwapPreview(userId, slotId, pairedOption.id);
  assert.equal(preview.originalCalories, originalSlot.calories);
  assert.equal(preview.newCalories, pairedOption.calories);
  assert.equal(preview.pairedRiceG, pairedOption.pairedRiceG);
  assert.equal(preview.nutritionAnalysis.target!.proteinG, 62.5);
  const reportTargets = preview.nutritionAnalysis.target;
  assert.ok(preview.riceFoodItemId);
  const riceRevision = (await prisma.foodItem.findUniqueOrThrow({ where: { id: preview.riceFoodItemId } }))
    .compositionRevision;
  await prisma.foodItem.update({
    where: { id: preview.riceFoodItemId },
    data: { compositionRevision: { increment: 1 } },
  });
  await assert.rejects(
    MealSwapService.swapMeal(
      userId,
      slotId,
      pairedOption.id,
      true,
      true,
      preview.previewToken,
      preview.requestKey,
      true
    ),
    /changed.*fresh preview|safety revalidation/
  );
  assert.equal(await prisma.swapLog.count({ where: { mealPlanId: slotId } }), 0);
  assert.equal(
    (await prisma.groceryItem.findUniqueOrThrow({ where: { id: riceItem.id } })).quantity,
    150 + originalRice
  );
  // Restore only this disposable fixture's revision so its old rice plate is actionable again.
  await prisma.foodItem.update({ where: { id: preview.riceFoodItemId }, data: { compositionRevision: riceRevision } });
  await prisma.rawRecipeCandidate.update({
    where: { id: paired.id },
    data: {
      contentSignature: createHash('sha256')
        .update(run + 'source revision changed')
        .digest('hex'),
    },
  });
  await assert.rejects(
    MealSwapService.swapMeal(
      userId,
      slotId,
      pairedOption.id,
      true,
      true,
      preview.previewToken,
      preview.requestKey,
      true
    ),
    /changed.*fresh preview/
  );
  preview = await MealSwapService.getSwapPreview(userId, slotId, pairedOption.id);
  const execute = () =>
    MealSwapService.swapMeal(
      userId,
      slotId,
      pairedOption.id,
      true,
      true,
      preview.previewToken,
      preview.requestKey,
      true
    );
  await execute();
  await execute();
  const saved = await prisma.mealPlan.findUniqueOrThrow({
    where: { id: slotId },
    include: {
      ingredients: true,
      servingComponents: true,
      sourceRawRecipeCandidate: true,
    },
  });
  assert.equal(saved.calories, preview.newCalories);
  assert.equal(saved.carbsG, preview.replacement.carbsG);
  assert.equal(saved.proteinG, preview.replacement.proteinG);
  assert.equal(saved.fatG, preview.replacement.fatG);
  const base = saved.servingComponents.find((component) => component.componentType === 'BASE_RECIPE')!;
  const side = saved.servingComponents.find((component) => component.componentType === 'COOKED_RICE')!;
  for (const nutrient of ['calories', 'proteinG', 'carbsG', 'fatG'] as const) {
    assert.ok(
      Math.abs(saved[nutrient] - base[nutrient] - side[nutrient]) < 0.001,
      `${nutrient} includes both the scaled dish and measured rice exactly once.`
    );
    assert.ok(Math.abs(side[nutrient] - (rice[nutrient] * side.quantityG!) / 100) < 0.001);
  }
  assert.equal(saved.sourceRawRecipeCandidateId, paired.id);
  assert.equal(saved.libraryMealId, null);
  assert.deepEqual(
    saved.servingComponents.filter((item) => item.componentType === 'COOKED_RICE').map((item) => item.quantityG),
    [preview.pairedRiceG]
  );
  const presented = serializeActionableMeal(saved);
  assert.equal(presented.image?.url, new URL(paired.sourceImageUrl!).toString());
  assert.equal(
    await prisma.swapLog.count({ where: { mealPlanId: slotId, requestKey: `${userId}:${preview.requestKey}` } }),
    1
  );
  const riceAfter = await prisma.groceryItem.findUniqueOrThrow({ where: { id: riceItem.id } });
  assert.equal(
    riceAfter.quantity,
    150 + preview.pairedRiceG!,
    'The projection replaces the old side with the fresh macro-ranked rice side, alongside unchanged dinner rice.'
  );
  assert.equal(riceAfter.purchasedQuantity, 260, 'Purchased rice survives a smaller requirement.');
  const noRicePreview = await MealSwapService.getSwapPreview(userId, slotId, `source:${standalone.id}`);
  assert.deepEqual(noRicePreview.nutritionAnalysis.target, reportTargets, 'Swaps do not redefine report targets.');
  assert.equal(noRicePreview.pairedRiceG, null);
  await MealSwapService.swapMeal(
    userId,
    slotId,
    `source:${standalone.id}`,
    true,
    true,
    noRicePreview.previewToken,
    noRicePreview.requestKey,
    true
  );
  assert.equal(
    await prisma.mealPlanServingComponent.count({ where: { mealPlanId: slotId, componentType: 'COOKED_RICE' } }),
    0
  );
  assert.equal((await prisma.groceryItem.findUniqueOrThrow({ where: { id: riceItem.id } })).quantity, 150);
  assert.equal(await prisma.mealLibrary.count(), libraryCount, 'No composed-plate library entries are created.');
  await assert.rejects(MealSwapService.getSwapPreview('wrong-owner', slotId, `source:${paired.id}`));
  await prisma.safetyProfileEntry.updateMany({
    where: { userId, domain: 'ALLERGY' },
    data: {
      canonicalCode: 'EGGS',
      displayName: 'Eggs',
      originalText: 'Eggs',
      normalizedText: 'eggs',
    },
  });
  await assert.rejects(
    MealSwapService.getSwapPreview(userId, slotId, `source:${paired.id}`),
    /health or allergy profile|safety revalidation/
  );
  await prisma.safetyProfileEntry.updateMany({
    where: { userId, domain: 'ALLERGY' },
    data: {
      canonicalCode: 'NONE',
      displayName: 'None',
      originalText: 'None',
      normalizedText: 'none',
    },
  });
  console.log(
    'PASS: source whole-plate swaps, fresh half-cup rice, exact image, no library growth, idempotence, grocery rice/purchases and restricted-profile rejection.'
  );
  await prisma.rawRecipeCandidate.updateMany({
    where: { id: { in: [paired.id, standalone.id] } },
    data: { status: 'RETIRED' },
  });
}

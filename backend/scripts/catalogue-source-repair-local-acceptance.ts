import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { planCatalogueSourceRepair, applyCatalogueSourceRepair } from '../src/services/catalogue-source-repair.service';
import { createSourceIngredientFnriMatcher } from '../src/domain/source-ingredient-fnri-match.policy';
import { projectRawRecipeCandidate } from '../src/services/panlasang-recipe-candidate.provider';
import { classifyMealIngredients } from '../src/domain/meal-ingredient-classification.policy';

const target = new URL(process.env.DATABASE_URL || '');
assert.equal(target.hostname, '127.0.0.1');
assert.equal(target.port, '55478');
assert.equal(target.pathname, '/kainara_catalogue_repair');
const db = new PrismaClient();
async function main() {
  const before = JSON.parse(await readFile('../.codex-runtime/catalogue-reference-snapshot.json', 'utf8'));
  const rows = await db.rawRecipeCandidate.findMany({ include: { applicableMealTypes: true } });
  let remaining = 0;
  for (const row of rows) {
    const original = before.recipes.find((item: { id: string }) => item.id === row.id);
    if (!original) continue; // Preserve synthetic probes from earlier runs.
    for (const field of ['calories', 'proteinG', 'carbsG', 'fatG', 'originalServings'] as const)
      assert.equal(row[field], original[field], `${row.recipeName}: preserve ${field}`);
    const oldIngredients = original.ingredients;
    (row.ingredients as Array<{ quantity: number }>).forEach((item, index) =>
      assert.equal(item.quantity, oldIngredients[index].quantity)
    );
    if (
      planCatalogueSourceRepair(
        row,
        row.applicableMealTypes.map((item) => item.mealType)
      )
    )
      remaining++;
  }
  assert.equal(remaining, 0, 'Repair must be idempotent across all recipes.');
  const omelet = rows.find((row) => row.recipeName === 'Eggplant and Ground Chicken Omelet')!;
  const projected = projectRawRecipeCandidate(omelet);
  assert.ok(classifyMealIngredients(projected.ingredients).detectedAllergens.includes('EGGS'));
  assert.ok(projected.ingredients.some((item) => item.name === 'eggs (beaten)' && item.quantity === 1.5));
  assert.equal(rows.find((row) => row.recipeName === 'Tortilla Espanola')?.status, 'RETIRED');
  assert.equal(rows.find((row) => row.recipeName === 'Shrimp and Vegetable Fried Rice Recipe')?.status, 'RETIRED');
  assert.deepEqual(
    rows.find((row) => row.recipeName === 'Recipe for Barbecue Chicken Marinade')?.applicableMealTypes,
    []
  );
  console.log(
    'PASS: whole-catalogue idempotence, unchanged nutrition/quantities, restored egg projection, source holds and component slot removal'
  );

  const marker = randomUUID();
  const source = await db.rawRecipeCandidate.create({
    data: {
      sourceRecordId: `synthetic-repair-${marker}`,
      recipeName: `Synthetic egg recovery software fixture ${marker}`,
      normalizedName: `synthetic egg recovery ${marker}`,
      contentSignature: marker.replace(/-/gu, '').padEnd(64, 'a'),
      sourceUrl: `https://example.invalid/${marker}`,
      cuisines: [],
      dietaryTags: ['OMNIVORE', 'VEGAN'],
      mealType: 'BREAKFAST',
      ingredients: [{ name: '(beaten)', unit: 'eggs', quantity: 1.5, excludedFromPlanning: true }],
      calories: 300,
      proteinG: 20,
      carbsG: 15,
      fatG: 10,
      publishedNutrition: { calories: 300 },
    },
  });
  const variant = await db.mealLibrary.create({
    data: {
      sourceRawRecipeCandidateId: source.id,
      mealName: source.recipeName,
      mealType: 'BREAKFAST',
      description: source.sourceUrl,
      calories: 300,
      proteinG: 20,
      carbsG: 15,
      fatG: 10,
      safetyEvidenceStatus: 'INCOMPLETE',
      ingredients: {
        create: { position: 0, ingredientName: '(beaten)', unit: 'eggs', quantity: 1.5, dataSource: 'SOURCE_RECIPE' },
      },
    },
  });
  const user = await db.user.create({
    data: {
      name: 'Synthetic catalogue repair fixture',
      email: `catalogue-${marker}@example.invalid`,
      passwordHash: 'NON_LOGIN_SOFTWARE_FIXTURE',
    },
  });
  const now = new Date();
  const cycle = await db.mealPlanCycle.create({
    data: {
      id: marker,
      userId: user.id,
      planType: 'WEEKLY',
      startDate: now,
      endDate: now,
      preparationOpensAt: now,
      shoppingDeadlineAt: now,
      expectedSlotCount: 3,
    },
  });
  const plans: Array<{ id: string }> = [];
  for (const status of ['PENDING_REVIEW', 'APPROVED', 'APPROVED'] as const)
    plans.push(
      await db.mealPlan.create({
        data: {
          userId: user.id,
          planGroupId: cycle.id,
          status,
          requiresSafetyRevalidation: false,
          sourceRawRecipeCandidateId: source.id,
          libraryMealId: variant.id,
          mealType: 'BREAKFAST',
          mealName: source.recipeName,
          calories: 300,
          proteinG: 20,
          carbsG: 15,
          fatG: 10,
          scheduledDate: now,
        },
      })
    );
  await db.mealLog.create({
    data: {
      userId: user.id,
      mealPlanId: plans[2].id,
      source: 'SYSTEM_GENERATED',
      status: 'DONE',
      mealName: source.recipeName,
      calories: 300,
      proteinG: 20,
      carbsG: 15,
      fatG: 10,
      dataSource: 'SYSTEM',
    },
  });
  const matcher = createSourceIngredientFnriMatcher(
    await db.foodItem.findMany({ where: { source: 'FNRI' }, select: { id: true, name: true } }),
    []
  );
  await db.$transaction((tx) =>
    applyCatalogueSourceRepair(tx, source, planCatalogueSourceRepair(source, [])!, matcher)
  );
  const result = await db.mealPlan.findMany({ where: { id: { in: plans.map((plan) => plan.id) } } });
  assert.equal(result.find((plan) => plan.id === plans[0].id)?.status, 'CANCELLED');
  assert.equal(result.find((plan) => plan.id === plans[1].id)?.status, 'CANCELLED');
  assert.equal(result.find((plan) => plan.id === plans[2].id)?.status, 'APPROVED');
  assert.equal((await db.mealLog.findUniqueOrThrow({ where: { mealPlanId: plans[2].id } })).status, 'DONE');
  const updated = await db.mealLibrary.findUniqueOrThrow({
    where: { id: variant.id },
    include: { ingredients: true, safetyReviews: true },
  });
  assert.equal(updated.ingredients[0].ingredientName, 'eggs (beaten)');
  assert.equal(updated.safetyEvidenceStatus, 'STALE');
  assert.equal(updated.certifiedEvidenceRevision, null);
  assert.equal(updated.safetyReviews[0].outcome, 'INVALIDATED');
  const appliedSource = await db.rawRecipeCandidate.findUniqueOrThrow({ where: { id: source.id } });
  await assert.rejects(
    db.$transaction((tx) => applyCatalogueSourceRepair(tx, source, planCatalogueSourceRepair(source, [])!, matcher)),
    /Concurrent source edit/u
  );
  assert.equal(
    (await db.mealLibrary.findUniqueOrThrow({ where: { id: variant.id } })).safetyEvidenceRevision,
    updated.safetyEvidenceRevision
  );
  assert.equal(
    (await db.rawRecipeCandidate.findUniqueOrThrow({ where: { id: source.id } })).contentSignature,
    appliedSource.contentSignature
  );
  console.log(
    'PASS: actual database invalidation cancels unconsumed proposals, preserves consumed history, restores imported library ingredients and grants no approval'
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

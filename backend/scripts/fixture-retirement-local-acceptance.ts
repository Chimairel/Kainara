import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import prisma from '../src/lib/prisma';
import { retireFixtureCatalogue } from '../src/services/retire-fixture-catalogue.service';
import { admittedLibraryBaseIds, libraryBaseRevisionKey } from '../src/services/meal-base-admission.service';
import { buildBaseServingPersistence, composePlanWithPairedRice } from '../src/services/meal-plan-serving.service';
import { getManilaDateKey, getManilaMidnight } from '../src/domain/meal-plan-cycle.policy';

async function main() {
  const db = new URL(process.env.DATABASE_URL ?? '');
  assert.ok(['localhost', '127.0.0.1'].includes(db.hostname) && db.pathname === '/recipe_rice_acceptance');
  await retireFixtureCatalogue();
  const tag = randomUUID();
  const user = await prisma.user.create({
    data: { email: `retire-${tag}@example.invalid`, name: 'Fixture tester', passwordHash: 'disabled' },
  });
  const meal = await prisma.mealLibrary.create({
    data: {
      mealName: `Seeded bowl ${tag}`,
      mealType: 'BREAKFAST',
      calories: 300,
      proteinG: 20,
      carbsG: 10,
      fatG: 15,
      recipeSignature: 'a'.repeat(32) + tag.replace(/-/gu, ''),
      ingredients: { create: { ingredientName: 'Chicken', quantity: 100, unit: 'g', position: 0, dataSource: 'FNRI' } },
      safetyReviews: {
        create: {
          outcome: 'CERTIFIED',
          evidenceRevision: 1,
          reasonCode: 'NUTRIMIND_COMMON_LIBRARY_V4',
          evidenceSnapshot: {},
        },
      },
    },
    include: { ingredients: true },
  });
  await prisma.mealBaseVerification.create({
    data: {
      targetKind: 'LIBRARY_MEAL',
      targetId: meal.id,
      revisionKey: libraryBaseRevisionKey(meal.recipeSignature!, null),
      status: 'VERIFIED',
    },
  });
  const now = new Date();
  const cycle = await prisma.mealPlanCycle.create({
    data: {
      id: `retire-${tag}`,
      userId: user.id,
      planType: 'WEEKLY',
      startDate: getManilaMidnight(getManilaDateKey(now)),
      endDate: new Date(now.getTime() + 7 * 86400000),
      preparationOpensAt: now,
      shoppingDeadlineAt: now,
      expectedSlotCount: 1,
      status: 'ACTIVE',
    },
  });
  const plan = await prisma.mealPlan.create({
    data: {
      userId: user.id,
      planGroupId: cycle.id,
      libraryMealId: meal.id,
      mealName: meal.mealName,
      mealType: meal.mealType,
      calories: meal.calories,
      proteinG: meal.proteinG,
      carbsG: meal.carbsG,
      fatG: meal.fatG,
      scheduledDate: getManilaMidnight(getManilaDateKey(new Date())),
      status: 'APPROVED',
      requiresSafetyRevalidation: false,
      ...buildBaseServingPersistence({ ...meal, evidenceSource: 'TEST' }),
    },
  });
  const rice = await prisma.foodItem.create({
    data: {
      name: 'Rice, well-milled, boiled',
      source: 'FNRI',
      calories: 130,
      proteinG: 2.5,
      carbsG: 28,
      fatG: 0.3,
    },
  });
  await prisma.$transaction((tx) =>
    composePlanWithPairedRice(tx, { mealPlanId: plan.id, cookedRiceG: 150, fnriRiceFoodItemId: rice.id })
  );
  const plate = await prisma.mealPlan.findUniqueOrThrow({
    where: { id: plan.id },
    include: { servingComponents: true },
  });
  assert.equal(plate.calories, 495);
  assert.equal(plate.servingComponents.filter((c) => c.componentType === 'COOKED_RICE').length, 1);
  assert.equal(
    (await prisma.mealLibrary.findUniqueOrThrow({ where: { id: meal.id } })).riceRoleReviewStatus,
    'NOT_REVIEWED'
  );
  const genuine = await prisma.mealLibrary.create({
    data: {
      mealName: `Genuine recipe ${tag}`,
      mealType: 'LUNCH',
      calories: 300,
      proteinG: 20,
      carbsG: 10,
      fatG: 15,
    },
  });
  const result = await retireFixtureCatalogue();
  assert.equal(result.archivedRecipes, 1);
  assert.equal(result.affectedPlans, 1);
  assert.equal(result.affectedUsers, 1);
  const archived = await prisma.mealLibrary.findUniqueOrThrow({ where: { id: meal.id } });
  assert.equal(archived.status, 'ARCHIVED');
  assert.equal((await admittedLibraryBaseIds([archived])).size, 0);
  assert.equal((await prisma.mealPlan.findUniqueOrThrow({ where: { id: plan.id } })).requiresSafetyRevalidation, true);
  assert.equal((await prisma.mealLibrary.findUniqueOrThrow({ where: { id: genuine.id } })).status, 'APPROVED');
  assert.equal(await prisma.notification.count({ where: { userId: user.id } }), 1);
  assert.equal(await prisma.mealBaseVerification.count({ where: { targetId: meal.id } }), 1);
  assert.equal((await retireFixtureCatalogue()).archivedRecipes, 0);
  assert.equal(await prisma.notification.count({ where: { userId: user.id } }), 1);
  console.log(
    'PASS: legacy rice persistence, targeted retirement, preserved history, user notification and idempotent replay.'
  );
}
main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

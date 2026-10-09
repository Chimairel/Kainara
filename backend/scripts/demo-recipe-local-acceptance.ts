/** Create-only recipe import acceptance on one fresh task-owned loopback database. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { Role } from '@prisma/client';
import app from '../src/app';
import db from '../src/lib/prisma';
import { signAccessToken } from '../src/lib/jwt';
import { loadFoodNutrientSources } from './helpers/food-nutrient-source-loader';
import { databaseTarget } from './helpers/dev-test-account-config';
import { DEMO_STANDARD_PORTIONS } from '../src/domain/demo-standard-portions.policy';
import { evaluateApprovedConditionRules } from '../src/services/condition-rule.service';
import { calculateLibraryNutritionEvidence } from '../src/services/nutritionist-library-nutrition-evidence.service';
import { admittedLibraryBaseIds } from '../src/services/meal-base-admission.service';

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55488');
  assert.equal(target.pathname, '/kainara_recipe_preparation');
  assert.equal(process.env.NODE_ENV, 'test');
  for (const key of ['GEMINI_API_KEY', 'SMTP_USER', 'BREVO_API_KEY', 'PAYMONGO_SECRET_KEY'])
    assert.equal(process.env[key] ?? '', '');
  assert.equal(await db.user.count(), 0);
  assert.equal(await db.rawRecipeCandidate.count(), 0, 'Use a fresh fixture database.');
  const directory = path.resolve('.local/backups/recipe-preparation-fixture');
  await mkdir(directory, { recursive: true });
  const sources = await loadFoodNutrientSources();
  const ids = new Set(DEMO_STANDARD_PORTIONS.flatMap((r) => r.ingredients.map((i) => String(i[0]))));
  for (const row of sources.usda.filter((f) => ids.has(f.sourceRecordId))) {
    const { evidence, ...composition } = row;
    await db.foodItem.create({
      data: {
        ...composition,
        id: `USDA_FDC_${row.sourceRecordId}`,
        sourceNutrientEvidence: JSON.parse(JSON.stringify(evidence)),
      },
    });
  }
  for (const [index, row] of DEMO_STANDARD_PORTIONS.entries())
    await db.rawRecipeCandidate.create({
      data: {
        sourceRecordId: `original-${index}`,
        recipeName: row.sourceName,
        normalizedName: row.sourceName.toLowerCase(),
        sourceUrl: `https://example.test/recipe-${index}`,
        contentSignature: createHash('sha256').update(row.sourceName).digest('hex'),
        cuisines: [],
        dietaryTags: ['OMNIVORE'],
        ingredients: [{ name: 'original unmeasured ingredient' }],
        mealType: 'LUNCH',
        calories: 400,
        proteinG: 30,
        carbsG: 20,
        fatG: 10,
        originalServings: 4,
      },
    });
  const originals = await db.rawRecipeCandidate.findMany({ orderBy: { id: 'asc' } });
  const lineage = await db.mealReviewLineage.create({ data: { key: `source:${originals[0].id}`, state: 'PUBLISHED' } });
  const parent = await db.mealLibrary.create({
    data: {
      id: 'original-meal',
      mealName: originals[0].recipeName,
      mealType: 'LUNCH',
      calories: 400,
      proteinG: 30,
      carbsG: 20,
      fatG: 10,
      sourceRawRecipeCandidateId: originals[0].id,
      recipeSignature: 'original-signature',
      reviewLineageId: lineage.id,
    },
  });
  const backupFile = path.join(directory, 'before.dump');
  const dump = execFileSync('docker', [
    'exec',
    'codex-rnd-canvas-20261009',
    'pg_dump',
    '-U',
    'postgres',
    '-Fc',
    '-d',
    'kainara_recipe_preparation',
  ]);
  await writeFile(backupFile, dump);
  const checksum = createHash('sha256').update(dump).digest('hex');
  const run = (apply = false) =>
    execFileSync(
      process.execPath,
      [
        path.resolve('node_modules/tsx/dist/cli.mjs'),
        'scripts/prepare-demo-recipe-catalogue.ts',
        '--collection-only',
        ...(apply
          ? [
              '--apply',
              '--confirm-target',
              databaseTarget(process.env.DATABASE_URL!, process.env).token,
              '--verified-backup',
              backupFile,
              '--backup-sha256',
              checksum,
            ]
          : []),
      ],
      {
        env: { ...process.env, DEMO_PREPARATION_REPORT: path.join(directory, 'report.json') },
        encoding: 'utf8',
        maxBuffer: 2000000,
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );
  run();
  assert.equal(await db.rawRecipeCandidate.count(), 7);
  assert.equal(await db.auditEvent.count(), 0);
  const report = JSON.parse(await readFile(path.join(directory, 'report.json'), 'utf8'));
  assert.equal(report.standardDemoRecipes, 7);
  await db.mealLibrary.update({ where: { id: parent.id }, data: { status: 'FLAGGED' } });
  run();
  assert.equal(JSON.parse(await readFile(path.join(directory, 'report.json'), 'utf8')).standardDemoRecipes, 6);
  await db.mealLibrary.update({ where: { id: parent.id }, data: { status: 'APPROVED' } });
  await db.$executeRawUnsafe(
    `CREATE FUNCTION fail_demo_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic atomic rollback'; END $$`
  );
  await db.$executeRawUnsafe(
    `CREATE TRIGGER fail_demo_fixture BEFORE INSERT ON "MealLibrary" FOR EACH ROW EXECUTE FUNCTION fail_demo_fixture()`
  );
  assert.throws(() => run(true));
  assert.equal(await db.rawRecipeCandidate.count(), 7);
  assert.equal(await db.conditionRulePolicyVersion.count(), 0);
  assert.equal(await db.auditEvent.count(), 0);
  await db.$executeRawUnsafe(`DROP TRIGGER fail_demo_fixture ON "MealLibrary"`);
  run(true);
  const meals = await db.mealLibrary.findMany({
    where: { sourceRawRecipeCandidate: { sourceName: 'DEMO_STANDARD_PORTION' } },
    include: { ingredients: { include: { foodItem: true } } },
  });
  assert.equal(meals.length, 7);
  const derived = meals.find((m) => m.parentMealId === parent.id)!;
  assert.ok(derived);
  assert.equal(derived.recipeFamilyId, parent.id);
  assert.equal(derived.reviewLineageId, parent.reviewLineageId);
  assert.equal(await db.rawRecipeCandidate.count(), 14);
  for (const meal of meals) {
    assert.equal(meal.safetyEvidenceStatus, 'INCOMPLETE');
    assert.equal(meal.verifiedByNutritionistId, null);
    assert.equal(meal.certifiedEvidenceRevision, null);
    for (const field of ['sodiumMg', 'sugarG', 'fiberG', 'potassiumMg', 'phosphorusMg', 'saturatedFatG'] as const)
      assert.ok(Number.isFinite(meal[field]));
    const calculated = calculateLibraryNutritionEvidence(
      meal.ingredients.map((i) => ({ foodItemId: i.foodItemId!, gramsPerServing: i.quantity! })),
      meal.ingredients.map((i) => i.foodItem!)
    );
    for (const field of [
      'calories',
      'proteinG',
      'carbsG',
      'fatG',
      'sodiumMg',
      'sugarG',
      'fiberG',
      'potassiumMg',
      'phosphorusMg',
      'saturatedFatG',
    ] as const)
      assert.equal(meal[field], calculated[field]);
    assert.ok(meal.ingredients.every((i) => i.unit === 'g' && i.quantity! > 0 && i.foodItemId));
  }
  assert.deepEqual(
    await db.rawRecipeCandidate.findMany({ where: { id: { in: originals.map((r) => r.id) } }, orderBy: { id: 'asc' } }),
    originals
  );
  assert.equal(await db.conditionRulePolicyVersion.count({ where: { state: 'DRAFT', automationAllowed: false } }), 5);
  assert.equal(
    await db.conditionNutrientRule.count({
      where: { active: false, reviewStatus: 'DRAFT', approvedByNutritionistId: null },
    }),
    3
  );
  const evaluation = await evaluateApprovedConditionRules({
    conditions: ['HEART_CONDITION', 'HYPERTENSION'],
    ingredientNames: [],
    nutrients: { sodiumMg: 0 },
    dailyTotals: { sodiumMg: 1000, calories: 2000, saturatedFatG: 10 },
  });
  assert.equal(evaluation.nutrientEvaluations.length, 0);
  assert.equal(evaluation.uncoveredConditions.length, 2);
  const audits = await db.auditEvent.count();
  run(true);
  assert.equal(await db.auditEvent.count(), audits);
  assert.equal(await db.mealLibrary.count(), 8);
  const recipe = await db.rawRecipeCandidate.findFirstOrThrow({
    where: { sourceRecordId: { startsWith: 'DEMO_PREPARATION:' } },
  });
  const recorded = recipe.publishedNutrition;
  await db.rawRecipeCandidate.update({
    where: { id: recipe.id },
    data: { publishedNutrition: { demoPreparation: { signature: 'changed' } } },
  });
  assert.throws(() => run(true));
  assert.equal(await db.mealLibrary.count(), 8);
  await db.rawRecipeCandidate.update({ where: { id: recipe.id }, data: { publishedNutrition: recorded! } });
  const account = (role: Role) =>
    db.user.create({
      data: {
        name: `Synthetic ${role}`,
        email: `recipe-${role}@example.test`,
        passwordHash: 'NON_LOGIN_FIXTURE',
        role,
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
      },
    });
  const admin = await account('ADMIN'),
    rnd = await account('NUTRITIONIST'),
    member = await account('USER');
  await db.nutritionistProfile.create({
    data: {
      userId: rnd.id,
      isVerified: true,
      prcLicenseNumber: 'SYNTHETIC-ONLY',
      prcLicenseExpiry: new Date('2099-01-01'),
    },
  });
  await db.userProfile.create({
    data: {
      userId: member.id,
      age: 28,
      biologicalSex: 'MALE',
      heightCm: 170,
      weightKg: 65,
      goal: 'MAINTAIN',
      activityLevel: 'SEDENTARY',
      dietaryPreference: 'OMNIVORE',
      dailyCalorieTarget: 2000,
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const request = async (actor: typeof admin, route: string) => {
      const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api${route}`, {
        headers: {
          Authorization: `Bearer ${signAccessToken({ userId: actor.id, email: actor.email, role: actor.role })}`,
        },
      });
      return { status: response.status, body: (await response.json()) as any };
    };
    const adminList = await request(admin, '/admin/library');
    assert.equal(adminList.status, 200);
    assert.equal(adminList.body.data.meals.length, 7);
    const queue = await request(rnd, '/nutritionist/meal-verification');
    assert.equal(queue.status, 200);
    assert.equal(queue.body.data.length, 7);
    assert.equal((await request(member, '/nutritionist/meal-verification')).status, 403);
    const library = await request(member, '/user/meals/compatible-library');
    assert.equal(library.status, 409, 'Incomplete synthetic onboarding remains blocked.');
    assert.equal(
      (
        await admittedLibraryBaseIds(
          await db.mealLibrary.findMany({
            where: { sourceRawRecipeCandidate: { sourceName: 'DEMO_STANDARD_PORTION' } },
            include: { sourceRawRecipeCandidate: true },
          })
        )
      ).size,
      0,
      'No prepared draft receives general member admission.'
    );
  } finally {
    server.close();
    await once(server, 'close');
  }
  console.log(
    JSON.stringify(
      {
        passed: 14,
        coverage: [
          'dry-run immutability',
          'complete seven-recipe collection',
          'forced atomic rollback',
          'ten recalculated totals',
          'positive gram mappings',
          'original preservation',
          'held source exclusion',
          'parent family and lineage preservation',
          'inactive rule drafts',
          'no clinical clearance',
          'idempotent retry',
          'changed draft rejection',
          'admin/RND visibility',
          'member access/eligibility',
        ],
      },
      null,
      2
    )
  );
}
main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : 'Acceptance failed');
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

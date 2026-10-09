import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { loadFoodNutrientSources } from './helpers/food-nutrient-source-loader';
import { databaseTarget } from './helpers/dev-test-account-config';

const target = new URL(process.env.DATABASE_URL ?? '');
assert.equal(target.hostname, '127.0.0.1');
assert.equal(target.port, '55488');
assert.equal(target.pathname, '/kainara_nutrient_completion');
assert.equal(process.env.NODE_ENV, 'test');
const db = new PrismaClient({ log: [] });
const directory = path.resolve('.local/backups/nutrient-completion-fixture');
async function main() {
  assert.equal(await db.foodItem.count(), 0, 'Use a fresh dedicated fixture database.');
  assert.equal(await db.user.count(), 0);
  await mkdir(directory, { recursive: true });
  const sources = await loadFoodNutrientSources();
  const corn = sources.fnri.find((row) => row.sourceRecordId === 'A001')!;
  const chicken = sources.usda.find((row) => row.phosphorus !== null && row.saturatedFat !== null && row.sugar === 0)!;
  for (const [row, id] of [
    [corn, 'corn'],
    [chicken, 'chicken'],
  ] as const)
    await db.foodItem.create({
      data: {
        id,
        name: row.name,
        source: row.source,
        sourceRecordId: row.sourceRecordId,
        calories: row.calories,
        proteinG: row.proteinG,
        carbsG: row.carbsG,
        fatG: row.fatG,
      },
    });
  const recipe = await db.mealLibrary.create({
    data: {
      id: 'draft-corn',
      mealName: 'Measured corn serving',
      mealType: 'BREAKFAST',
      calories: corn.calories,
      proteinG: corn.proteinG,
      carbsG: corn.carbsG,
      fatG: corn.fatG,
      ingredients: {
        create: {
          foodItemId: 'corn',
          ingredientName: corn.name,
          position: 0,
          dataSource: 'FNRI',
          quantity: 100,
          unit: 'g',
        },
      },
    },
  });
  await db.mealLibrary.create({
    data: {
      id: 'unknown-corn',
      mealName: 'Unmeasured corn serving',
      mealType: 'BREAKFAST',
      calories: corn.calories,
      proteinG: corn.proteinG,
      carbsG: corn.carbsG,
      fatG: corn.fatG,
      ingredients: {
        create: {
          foodItemId: 'corn',
          ingredientName: corn.name,
          position: 0,
          dataSource: 'FNRI',
          quantity: 1,
          unit: 'cup',
        },
      },
    },
  });
  await db.mealLibrary.create({
    data: {
      id: 'verified-corn',
      mealName: 'Historically verified serving',
      mealType: 'BREAKFAST',
      calories: corn.calories,
      proteinG: corn.proteinG,
      carbsG: corn.carbsG,
      fatG: corn.fatG,
      safetyEvidenceStatus: 'COMPLETE',
      certifiedEvidenceRevision: 0,
      ingredients: {
        create: {
          foodItemId: 'corn',
          ingredientName: corn.name,
          position: 0,
          dataSource: 'FNRI',
          quantity: 100,
          unit: 'g',
        },
      },
    },
  });
  await db.mealBaseVerification.create({
    data: {
      targetKind: 'LIBRARY_MEAL',
      targetId: 'verified-corn',
      revisionKey: 'fixture-old-revision',
      status: 'VERIFIED',
      rationale: 'Original synthetic decision',
    },
  });
  const decision = await db.mealBaseVerification.findFirstOrThrow({ where: { targetId: 'verified-corn' } });
  const backupFile = path.join(directory, 'before.dump');
  const dump = execFileSync('docker', [
    'exec',
    'codex-rnd-canvas-20261009',
    'pg_dump',
    '-U',
    'postgres',
    '-Fc',
    '-d',
    'kainara_nutrient_completion',
  ]);
  await writeFile(backupFile, dump);
  const checksum = createHash('sha256').update(dump).digest('hex');
  const token = databaseTarget(process.env.DATABASE_URL!, process.env).token;
  const run = (apply = false) =>
    execFileSync(
      process.execPath,
      [
        path.resolve('node_modules/tsx/dist/cli.mjs'),
        'scripts/complete-catalogue-nutrients.ts',
        ...(apply
          ? ['--apply', '--confirm-target', token, '--verified-backup', backupFile, '--backup-sha256', checksum]
          : []),
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, NUTRIENT_AUDIT_REPORT: path.join(directory, 'audit.json') },
        encoding: 'utf8',
        maxBuffer: 2_000_000,
      }
    );
  run();
  const report = JSON.parse(await readFile(path.join(directory, 'audit.json'), 'utf8'));
  assert.equal(report.summary.foodsToEnrich, 2);
  assert.equal(report.summary.libraryMealsToFill, 1);
  assert.equal(
    (await db.foodItem.findUniqueOrThrow({ where: { id: 'corn' } })).phosphorus,
    null,
    'Dry-run must not write.'
  );
  await db.$executeRawUnsafe(
    `CREATE FUNCTION fail_nutrient_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='corn' THEN RAISE EXCEPTION 'Synthetic atomic rollback'; END IF; RETURN NEW; END $$`
  );
  await db.$executeRawUnsafe(
    `CREATE TRIGGER fail_nutrient_fixture BEFORE UPDATE ON "FoodItem" FOR EACH ROW EXECUTE FUNCTION fail_nutrient_fixture()`
  );
  assert.throws(() => run(true));
  assert.equal(await db.auditEvent.count(), 0);
  assert.equal((await db.foodItem.findUniqueOrThrow({ where: { id: 'chicken' } })).sourceNutrientEvidence, null);
  await db.$executeRawUnsafe(`DROP TRIGGER fail_nutrient_fixture ON "FoodItem"`);
  run(true);
  const imported = await db.foodItem.findUniqueOrThrow({ where: { id: 'corn' } });
  assert.equal(imported.sugar, corn.sugar);
  assert.equal(imported.phosphorus, corn.phosphorus);
  assert.equal(imported.saturatedFat, corn.saturatedFat);
  assert.equal(imported.compositionRevision, 1);
  assert.ok((imported.sourceNutrientEvidence as any).entries.some((entry: any) => entry.name === 'Cholesterol (mg)'));
  const completed = await db.mealLibrary.findUniqueOrThrow({ where: { id: recipe.id } });
  assert.equal(completed.phosphorusMg, Math.round(corn.phosphorus! * 10) / 10);
  assert.equal(completed.sugarG, Math.round(corn.sugar! * 10) / 10);
  assert.equal(completed.saturatedFatG, Math.round(corn.saturatedFat! * 10) / 10);
  assert.equal(completed.verifiedByNutritionistId, null);
  assert.equal(completed.safetyEvidenceStatus, 'INCOMPLETE');
  assert.equal(
    (await db.mealLibrary.findUniqueOrThrow({ where: { id: 'unknown-corn' } })).phosphorusMg,
    null,
    'Do not guess cup weights.'
  );
  const reviewed = await db.mealLibrary.findUniqueOrThrow({ where: { id: 'verified-corn' } });
  assert.equal(reviewed.safetyEvidenceStatus, 'STALE');
  assert.equal(reviewed.certifiedEvidenceRevision, null);
  assert.equal(reviewed.phosphorusMg, null, 'Reviewed nutrition stays immutable.');
  assert.deepEqual(
    await db.mealBaseVerification.findUniqueOrThrow({ where: { id: decision.id } }),
    decision,
    'Original decision remains unchanged.'
  );
  const audits = await db.auditEvent.count();
  run(true);
  const repeated = JSON.parse(await readFile(path.join(directory, 'audit.json'), 'utf8'));
  assert.equal(repeated.summary.foodsToEnrich, 0);
  assert.equal(repeated.summary.libraryMealsToFill, 0);
  assert.equal(await db.auditEvent.count(), audits);
  console.log(
    JSON.stringify({
      passed: 12,
      coverage: [
        'dry-run',
        'source completeness',
        'FNRI units/zeros',
        'USDA identity',
        'transaction rollback',
        'measured serving nutrients',
        'unknown household amounts',
        'reviewed value preservation',
        'certification invalidation',
        'immutable original decision',
        'audit',
        'idempotent retry',
      ],
    })
  );
}
main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Fixture failed');
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

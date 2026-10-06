import 'dotenv/config';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import { createSourceIngredientFnriMatcher } from '../src/domain/source-ingredient-fnri-match.policy';
import { applyCatalogueSourceRepair, planCatalogueSourceRepair } from '../src/services/catalogue-source-repair.service';

const apply = process.argv.includes('--apply');
const target = new URL(process.env.DATABASE_URL || '');
const local =
  target.hostname === '127.0.0.1' && target.port === '55478' && target.pathname === '/kainara_catalogue_repair';
const development =
  target.hostname === 'ep-crimson-poetry-ao0sqrvy-pooler.c-2.ap-southeast-1.aws.neon.tech' &&
  target.pathname === '/neondb';
assert.ok(local || development, 'Only the dedicated catalogue fixture or exact development database is permitted.');
assert.ok(
  !apply || process.env.CATALOGUE_REPAIR_TARGET === (local ? 'isolated-catalogue-fixture' : 'development-catalogue'),
  'Applying requires an explicit target acknowledgement.'
);
assert.ok(
  !apply || process.env.CATALOGUE_REPAIR_INDEPENDENT_AUDIT_NOTIFIED === 'true',
  'Notify the independent audit before applying.'
);
const prisma = new PrismaClient();

async function main() {
  const snapshot = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const [rows, foods, aliases] = await Promise.all([
        tx.rawRecipeCandidate.findMany({
          where: { sourceName: 'PANLASANG_PINOY' },
          include: { applicableMealTypes: true },
          orderBy: { id: 'asc' },
        }),
        tx.foodItem.findMany({ where: { source: 'FNRI' }, select: { id: true, name: true } }),
        tx.foodAlias.findMany({
          where: { verifiedAt: { not: null }, foodItem: { source: 'FNRI' } },
          select: { alias: true, foodItemId: true, verifiedAt: true },
        }),
      ]);
      const repairs = rows.flatMap((row) => {
        const repair = planCatalogueSourceRepair(
          row,
          row.applicableMealTypes.map((item) => item.mealType)
        );
        return repair ? [{ row, repair }] : [];
      });
      const sourceIds = repairs.map(({ row }) => row.id);
      const sourceUrls = repairs.map(({ row }) => row.sourceUrl);
      const variants = await tx.mealLibrary.findMany({
        where: {
          OR: [
            { sourceRawRecipeCandidateId: { in: sourceIds } },
            ...sourceUrls.map((url) => ({ authoredByNutritionistId: null, description: { contains: url } })),
          ],
        },
        include: { ingredients: true, applicableMealTypes: true },
      });
      const unconsumedPlans = await tx.mealPlan.count({
        where: {
          OR: [
            { sourceRawRecipeCandidateId: { in: sourceIds } },
            { libraryMealId: { in: variants.map((item) => item.id) } },
          ],
          status: { in: ['APPROVED', 'PENDING_REVIEW'] },
          mealLogs: { none: { status: { in: ['DONE', 'SKIPPED'] } } },
        },
      });
      return { repairs, foods, aliases, variants, unconsumedPlans };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 10_000, timeout: 120_000 }
  );
  const summary = {
    target: local ? 'isolated-catalogue-fixture' : 'development-catalogue',
    mode: apply ? 'apply' : 'dry-run',
    recipes: snapshot.repairs.length,
    recoveredIngredients: snapshot.repairs.reduce((n, item) => n + item.repair.recovered, 0),
    variants: snapshot.variants.length,
    unconsumedPlans: snapshot.unconsumedPlans,
    changes: snapshot.repairs.map(({ row, repair }) => ({
      name: row.recipeName,
      sourceUrl: row.sourceUrl,
      recovered: repair.recovered,
      narrowedSlots: repair.rolesChanged,
      narrowedDietTags: repair.tagsChanged,
      nutritionHold: repair.nutritionHold,
      recoveredNames: repair.after
        .filter((item, index) => item.name !== repair.before[index].name)
        .map((item) => item.name),
    })),
  };
  const root = path.resolve('../.codex-runtime/catalogue-repair');
  await mkdir(root, { recursive: true });
  await writeFile(
    path.join(root, `${summary.target}-${summary.mode}-${Date.now()}.json`),
    JSON.stringify(summary, null, 2)
  );
  console.log(JSON.stringify(summary, null, 2));
  if (!apply || !snapshot.repairs.length) return;
  const backup = path.resolve('../.data-audit-backups');
  await mkdir(backup, { recursive: true });
  // Local backup never goes into version control. Only recipe rows, no members or staff records.
  await writeFile(
    path.join(backup, `catalogue-${summary.target}-${Date.now()}.json`),
    JSON.stringify(
      {
        rows: snapshot.repairs.map((item) => item.row),
        variants: snapshot.variants,
      },
      null,
      2
    )
  );
  const matcher = createSourceIngredientFnriMatcher(snapshot.foods, snapshot.aliases);
  const totals = {
    appliedRecipes: 0,
    restoredLibraryIngredients: 0,
    invalidatedVariants: 0,
    cancelledUnconsumedPlans: 0,
  };
  for (const { row, repair } of snapshot.repairs) {
    const result = await prisma.$transaction((tx) => applyCatalogueSourceRepair(tx, row, repair, matcher), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 30_000,
      timeout: 60_000,
    });
    totals.appliedRecipes++;
    for (const key of ['restoredLibraryIngredients', 'invalidatedVariants', 'cancelledUnconsumedPlans'] as const)
      totals[key] += result[key];
    console.log('APPLIED', row.recipeName);
  }
  console.log(JSON.stringify(totals));
}
main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Catalogue repair failed');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

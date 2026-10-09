/** Guarded source-evidence completion; dry run is the default. No guessed amounts or approvals. */
import 'dotenv/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { Prisma, PrismaClient, type FoodItem } from '@prisma/client';
import { databaseTarget, assertWriteTarget } from './helpers/dev-test-account-config';
import { loadFoodNutrientSources } from './helpers/food-nutrient-source-loader';
import {
  OPTIONAL_FOOD_NUTRIENTS,
  planFoodNutrientEnrichment,
  type SourceFood,
} from '../src/domain/food-nutrient-source.policy';
import { MEAL_EXTENDED_NUTRIENTS, publishedServingNutrientFill } from '../src/domain/meal-nutrient-completion.policy';
import { calculateLibraryNutritionEvidence } from '../src/services/nutritionist-library-nutrition-evidence.service';

const reason = 'SOURCE_NUTRIENT_EVIDENCE_COMPLETED';
const db = new PrismaClient({ log: [] });
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const target = databaseTarget(process.env.DATABASE_URL ?? '', process.env);
// A target token cannot authorize another remote database accidentally.
if (!target.local && target.label !== 'ep-crimson-poetry-ao0sqrvy-pooler.c-2.ap-southeast-1.aws.neon.tech:5432/neondb')
  throw new Error('Only the confirmed development database or a local fixture is permitted.');
if (apply) assertWriteTarget(target, args);

async function main() {
  const sources = await loadFoodNutrientSources();
  const snapshot = await db.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      // SELECT * also supports auditing before the additive migration is applied.
      const foods = await tx.$queryRaw<FoodItem[]>`SELECT * FROM "FoodItem" ORDER BY id`;
      const raw = await tx.rawRecipeCandidate.findMany({ orderBy: { id: 'asc' } });
      const meals = await tx.mealLibrary.findMany({
        include: { ingredients: { orderBy: { position: 'asc' } }, reviewLineage: true },
        orderBy: { id: 'asc' },
      });
      const used = await tx.mealPlan.findMany({
        where: { libraryMealId: { not: null } },
        select: { libraryMealId: true },
        distinct: ['libraryMealId'],
      });
      const reviewed = await tx.mealBaseVerification.findMany({
        where: { status: 'VERIFIED' },
        select: { targetKind: true, targetId: true },
      });
      return { foods, raw, meals, used, reviewed };
    },
    { isolationLevel: 'RepeatableRead', timeout: 60000, maxWait: 10000 }
  );
  const sourceIds = new Map(
    [...sources.fnri, ...sources.usda].map((row) => [`${row.source}:${row.sourceRecordId}`, row])
  );
  const fnriNames = new Map<string, SourceFood[]>();
  for (const row of sources.fnri) fnriNames.set(row.name, [...(fnriNames.get(row.name) ?? []), row]);
  const patches: Array<{ before: FoodItem; plan: ReturnType<typeof planFoodNutrientEnrichment> }> = [];
  const conflicts: { name: string; source: string; issue: string }[] = [];
  for (const food of snapshot.foods) {
    const exactCompositions =
      food.source === 'FNRI'
        ? (fnriNames.get(food.name) ?? []).filter((row) =>
            (['calories', 'proteinG', 'carbsG', 'fatG'] as const).every(
              (key) => Math.abs(food[key] - row[key]) < 0.000001
            )
          )
        : [];
    const source = food.sourceRecordId
      ? sourceIds.get(`${food.source}:${food.sourceRecordId}`)
      : exactCompositions.length === 1
        ? exactCompositions[0]
        : null;
    if (!source) {
      conflicts.push({ name: food.name, source: food.source, issue: 'No unique matching source identity' });
      continue;
    }
    try {
      const plan = planFoodNutrientEnrichment(food, source);
      if (plan.changed) patches.push({ before: food, plan });
    } catch (error) {
      conflicts.push({ name: food.name, source: food.source, issue: (error as Error).message });
    }
  }
  const proposedFoods = new Map(snapshot.foods.map((food) => [food.id, { ...food }]));
  for (const { before, plan } of patches) proposedFoods.set(before.id, { ...before, ...plan.values });
  const used = new Set(snapshot.used.map((row) => row.libraryMealId));
  const reviewed = new Set(snapshot.reviewed.map((row) => `${row.targetKind}:${row.targetId}`));
  const rawIds = new Map(snapshot.raw.map((row) => [row.id, row]));
  const rawUrls = new Map(snapshot.raw.map((row) => [row.sourceUrl, row]));
  const mealPatches: Array<{
    before: (typeof snapshot.meals)[number];
    values: Record<string, number>;
    method: string;
  }> = [];
  let preservedReviewedOrUsed = 0;
  for (const meal of snapshot.meals) {
    if (
      used.has(meal.id) ||
      reviewed.has(`LIBRARY_MEAL:${meal.id}`) ||
      reviewed.has(`GENERATED_RECIPE:${meal.recipeSignature}`) ||
      (meal.sourceRawRecipeCandidateId && reviewed.has(`RAW_RECIPE:${meal.sourceRawRecipeCandidateId}`)) ||
      meal.verifiedByNutritionistId ||
      meal.safetyReviewedByNutritionistId ||
      meal.certifiedEvidenceRevision !== null
    ) {
      preservedReviewedOrUsed++;
      continue;
    }
    if (
      meal.authoredByNutritionistId ||
      meal.parentMealId ||
      meal.status !== 'APPROVED' ||
      (meal.reviewLineage && meal.reviewLineage.state !== 'PUBLISHED')
    )
      continue;
    const source =
      rawIds.get(meal.sourceRawRecipeCandidateId ?? '') ??
      rawUrls.get(meal.description?.match(/https:\/\/panlasangpinoy.com\/[^\s]+/u)?.[0] ?? '');
    let values: Record<string, number> = {};
    let method = '';
    if (
      source?.sourceName === 'PANLASANG_PINOY' &&
      source.status === 'AVAILABLE' &&
      Array.isArray(source.ingredients)
    ) {
      const fill = publishedServingNutrientFill(
        {
          ...meal,
          name: meal.mealName,
          ingredients: meal.ingredients.map((item) => ({
            name: item.ingredientName,
            quantity: item.quantity,
            unit: item.unit,
          })),
        },
        {
          name: source.recipeName,
          nutrition: source.publishedNutrition,
          ingredients: source.ingredients.filter((item: any) => item.excludedFromPlanning !== true) as any,
        }
      );
      if (fill) {
        values = fill as Record<string, number>;
        method = 'IDENTICAL_PUBLISHED_SOURCE_SERVING';
      }
    }
    // Never substitute guessed household weights or partial ingredient sums.
    if (
      !Object.keys(values).length &&
      meal.ingredients.length &&
      meal.ingredients.every(
        (item) =>
          item.foodItemId &&
          item.quantity &&
          item.quantity > 0 &&
          ['g', 'gram', 'grams'].includes(item.unit?.toLowerCase() ?? '')
      )
    ) {
      const foods = meal.ingredients.flatMap((item) =>
        proposedFoods.get(item.foodItemId!) ? [proposedFoods.get(item.foodItemId!)!] : []
      );
      if (foods.length === meal.ingredients.length) {
        const calculated = calculateLibraryNutritionEvidence(
          meal.ingredients.map((item) => ({ foodItemId: item.foodItemId!, gramsPerServing: item.quantity! })),
          foods
        );
        if (
          (['calories', 'proteinG', 'carbsG', 'fatG'] as const).every(
            (key) => Math.abs(meal[key] - calculated[key]) <= 0.1
          )
        ) {
          for (const key of MEAL_EXTENDED_NUTRIENTS)
            if (meal[key] === null && calculated[key] !== null) values[key] = calculated[key]!;
          method = 'ALL_MEASURED_INGREDIENTS_PER_SERVING';
        }
      }
    }
    if (Object.keys(values).length) mealPatches.push({ before: meal, values, method });
  }
  const mealValues = new Map(mealPatches.map((patch) => [patch.before.id, patch.values]));
  const recipeGaps = snapshot.raw.map((row) => {
    const nutrition = row.publishedNutrition as Record<string, any> | null;
    const ingredients = Array.isArray(row.ingredients)
      ? (row.ingredients.filter((item: any) => item.excludedFromPlanning !== true) as any[])
      : [];
    return {
      name: row.recipeName,
      sourceUrl: row.sourceUrl,
      status: row.status,
      missingPublishedNutrients: MEAL_EXTENDED_NUTRIENTS.filter((key) => typeof nutrition?.[key] !== 'number'),
      nutritionEstimate:
        nutrition?.dataCompletionAudit?.operations?.includes('CODEX_SIMILAR_RECIPE_ESTIMATE_V1') === true,
      unmeasuredIngredients: ingredients.filter((item) => !(item.quantity > 0) || !item.unit).map((item) => item.name),
      unmappedIngredients: ingredients.filter((item) => !item.foodItemId).map((item) => item.name),
      missingServings: !(row.originalServings && row.originalServings > 0),
    };
  });
  const summary = {
    target: target.label,
    confirmation: target.token,
    mode: apply ? 'APPLY' : 'DRY_RUN',
    sourceFingerprint: sources.fingerprint,
    foods: snapshot.foods.length,
    foodsToEnrich: patches.length,
    nutrientValueChanges: patches.filter((item) => item.plan.nutrientsChanged).length,
    sourceConflicts: conflicts.length,
    recipes: snapshot.raw.length,
    libraryMeals: snapshot.meals.length,
    libraryMealsToFill: mealPatches.length,
    libraryValuesToFill: mealPatches.reduce((sum, item) => sum + Object.keys(item.values).length, 0),
    preservedReviewedOrUsed,
    remainingLibraryGaps: Object.fromEntries(
      MEAL_EXTENDED_NUTRIENTS.map((key) => [
        key,
        snapshot.meals.filter((meal) => (mealValues.get(meal.id)?.[key] ?? meal[key]) === null).length,
      ])
    ),
    recipesWithEstimatedMacros: recipeGaps.filter((row) => row.nutritionEstimate).length,
    unmeasuredIngredients: recipeGaps.reduce((sum, row) => sum + row.unmeasuredIngredients.length, 0),
    unmappedIngredients: recipeGaps.reduce((sum, row) => sum + row.unmappedIngredients.length, 0),
    missingServings: recipeGaps.filter((row) => row.missingServings).length,
    newlyRecordedFoodValues: Object.fromEntries(
      OPTIONAL_FOOD_NUTRIENTS.map((key) => [
        key,
        patches.filter((item) => item.before[key] == null && item.plan[key] !== null).length,
      ])
    ),
    missingFoodNutrientsAfter: Object.fromEntries(
      OPTIONAL_FOOD_NUTRIENTS.map((key) => [
        key,
        [...proposedFoods.values()].filter((food) => food[key] == null).length,
      ])
    ),
  };
  const report = path.resolve(
    process.env.NUTRIENT_AUDIT_REPORT ?? '../docs/verification/CATALOGUE_NUTRIENT_AUDIT_2026-10-09.json'
  );
  await mkdir(path.dirname(report), { recursive: true });
  await writeFile(
    report,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        summary,
        conflicts,
        libraryChanges: mealPatches.map(({ before, values, method }) => ({ name: before.mealName, values, method })),
        recipeGaps,
      },
      null,
      2
    ) + '\n'
  );
  console.log(JSON.stringify(summary, null, 2));
  if (!apply || (!patches.length && !mealPatches.length)) return;
  // Target backup must be supplied and verified before opening the write transaction.
  const backupArg = args.indexOf('--verified-backup');
  const hashArg = args.indexOf('--backup-sha256');
  if (backupArg < 0 || hashArg < 0)
    throw new Error('Apply requires --verified-backup FILE and --backup-sha256 SHA256.');
  const backupBuffer = await readFile(path.resolve(args[backupArg + 1]));
  if (!backupBuffer.length || createHash('sha256').update(backupBuffer).digest('hex') !== args[hashArg + 1])
    throw new Error('Verified database backup fingerprint differs.');
  const backupDirectory = path.resolve('.local/backups');
  await mkdir(backupDirectory, { recursive: true });
  const rollbackFile = path.join(backupDirectory, `nutrient-rows-before-${Date.now()}.json`);
  await writeFile(
    rollbackFile,
    JSON.stringify({
      target: target.label,
      sourceFingerprint: sources.fingerprint,
      foods: patches.map((item) => item.before),
      meals: mealPatches.map((item) => item.before),
    }),
    { flag: 'wx', mode: 0o600 }
  );
  await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(741010)`;
      // Whole update is atomic; row locks/CAS reject a concurrent reference edit.
      for (let offset = 0; offset < patches.length; offset += 150) {
        const batch = patches.slice(offset, offset + 150);
        const payload = batch.map(({ before, plan }) => ({
          id: before.id,
          revision: before.compositionRevision,
          name: before.name,
          source: before.source,
          sourceRecordId: before.sourceRecordId,
          calories: before.calories,
          proteinG: before.proteinG,
          carbsG: before.carbsG,
          fatG: before.fatG,
          oldSugar: before.sugar ?? null,
          oldPhosphorus: before.phosphorus ?? null,
          oldSaturatedFat: before.saturatedFat ?? null,
          oldValues: Object.fromEntries(OPTIONAL_FOOD_NUTRIENTS.map((key) => [key, before[key] ?? null])),
          values: plan.values,
          oldEvidence: before.sourceNutrientEvidence ?? null,
          evidence: plan.evidence,
        }));
        const updated = await tx.$executeRaw`
        UPDATE "FoodItem" AS f SET "sugar"=(p.values->>'sugar')::float8, "phosphorus"=(p.values->>'phosphorus')::float8, "saturatedFat"=(p.values->>'saturatedFat')::float8,
          "fiber"=(p.values->>'fiber')::float8,"sodium"=(p.values->>'sodium')::float8,"potassium"=(p.values->>'potassium')::float8,
          "calcium"=(p.values->>'calcium')::float8,"iron"=(p.values->>'iron')::float8,"vitaminA"=(p.values->>'vitaminA')::float8,"vitaminC"=(p.values->>'vitaminC')::float8,
          "vitaminB1"=(p.values->>'vitaminB1')::float8,"vitaminB2"=(p.values->>'vitaminB2')::float8,"niacin"=(p.values->>'niacin')::float8,"water"=(p.values->>'water')::float8,
          "sourceNutrientEvidence"=p.evidence, "compositionRevision"=f."compositionRevision"+1
        FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS p(id text,revision int,name text,source text,"sourceRecordId" text,calories float8,"proteinG" float8,"carbsG" float8,"fatG" float8,"oldSugar" float8,"oldPhosphorus" float8,"oldSaturatedFat" float8,"oldEvidence" jsonb,"oldValues" jsonb,values jsonb,evidence jsonb)
        WHERE f.id=p.id AND f."compositionRevision"=p.revision
          AND f.name=p.name AND f.source=p.source AND f."sourceRecordId" IS NOT DISTINCT FROM p."sourceRecordId"
          AND f.calories=p.calories AND f."proteinG"=p."proteinG" AND f."carbsG"=p."carbsG" AND f."fatG"=p."fatG"
          AND f."sugar" IS NOT DISTINCT FROM p."oldSugar" AND f."phosphorus" IS NOT DISTINCT FROM p."oldPhosphorus"
          AND f."saturatedFat" IS NOT DISTINCT FROM p."oldSaturatedFat"
          AND jsonb_build_object('fiber',f.fiber,'sodium',f.sodium,'potassium',f.potassium,'calcium',f.calcium,'iron',f.iron,'vitaminA',f."vitaminA",'vitaminC',f."vitaminC",'vitaminB1',f."vitaminB1",'vitaminB2',f."vitaminB2",'niacin',f.niacin,'water',f.water,'sugar',f.sugar,'phosphorus',f.phosphorus,'saturatedFat',f."saturatedFat")=p."oldValues"
          AND f."sourceNutrientEvidence" IS NOT DISTINCT FROM NULLIF(p."oldEvidence",'null'::jsonb)`;
        if (updated !== batch.length) throw new Error('Concurrent food edit; entire update rolled back.');
      }
      const changedFoodIds = patches.map((item) => item.before.id);
      // Keep independent approval history immutable. Revision-bound checks become stale.
      const certified = await tx.mealLibrary.findMany({
        where: { ingredients: { some: { foodItemId: { in: changedFoodIds } } }, safetyEvidenceStatus: 'COMPLETE' },
        select: { id: true, safetyEvidenceRevision: true },
      });
      if (certified.length) {
        const ids = certified.map((item) => item.id);
        await tx.mealLibrary.updateMany({
          where: { id: { in: ids } },
          data: {
            safetyEvidenceStatus: 'STALE',
            certifiedEvidenceRevision: null,
            safetyEvidenceRevision: { increment: 1 },
            safetyInvalidatedAt: new Date(),
            safetyInvalidationReason: reason,
          },
        });
        await tx.mealLibrarySafetyReview.createMany({
          data: certified.map((item) => ({
            mealLibraryId: item.id,
            evidenceRevision: item.safetyEvidenceRevision + 1,
            outcome: 'INVALIDATED',
            reasonCode: reason,
            evidenceSnapshot: { sourceFingerprint: sources.fingerprint },
          })),
        });
        await tx.mealLibraryProfileApproval.updateMany({
          where: { mealLibraryId: { in: ids }, flaggedAt: null },
          data: { flaggedAt: new Date(), flagReason: reason },
        });
        const clearances = await tx.mealConditionClearance.findMany({
          where: { mealLibraryId: { in: ids }, state: { in: ['ACTIVE', 'REVIEW_DUE'] } },
          select: { id: true },
        });
        await tx.mealConditionClearance.updateMany({
          where: { id: { in: clearances.map((item) => item.id) } },
          data: { state: 'SUSPENDED', suspendedAt: new Date(), suspensionReason: reason },
        });
        await tx.mealPlan.updateMany({
          where: {
            status: 'APPROVED',
            OR: [
              { libraryMealId: { in: ids } },
              { clearanceUsages: { some: { clearanceId: { in: clearances.map((item) => item.id) } } } },
            ],
          },
          data: { requiresSafetyRevalidation: true },
        });
      }
      for (const { before, values, method } of mealPatches) {
        // Recheck usage/verification inside the transaction; do not alter a newly reviewed serving.
        const usedNow = await tx.mealPlan.count({ where: { libraryMealId: before.id } });
        const verifiedNow = await tx.mealBaseVerification.count({
          where: {
            status: 'VERIFIED',
            OR: [
              { targetKind: 'LIBRARY_MEAL', targetId: before.id },
              { targetKind: 'GENERATED_RECIPE', targetId: before.recipeSignature ?? '' },
              { targetKind: 'RAW_RECIPE', targetId: before.sourceRawRecipeCandidateId ?? '' },
            ],
          },
        });
        if (usedNow || verifiedNow) throw new Error('Meal was used/reviewed after preview; entire update rolled back.');
        const changed = await tx.mealLibrary.updateMany({
          where: {
            id: before.id,
            updatedAt: before.updatedAt,
            safetyEvidenceRevision: before.safetyEvidenceRevision,
            status: 'APPROVED',
          },
          data: { ...values, safetyEvidenceRevision: { increment: 1 } },
        });
        if (changed.count !== 1) throw new Error('Concurrent meal edit; entire update rolled back.');
        await tx.auditEvent.create({
          data: {
            action: 'MEAL_SOURCE_NUTRIENTS_COMPLETED',
            entityType: 'MealLibrary',
            entityId: before.id,
            metadata: {
              method,
              sourceFingerprint: sources.fingerprint,
              before: Object.fromEntries(Object.keys(values).map((key) => [key, (before as any)[key]])),
              after: values,
              clinicalApprovalGranted: false,
            },
          },
        });
      }
      await tx.auditEvent.create({
        data: {
          action: 'FOOD_SOURCE_NUTRIENTS_COMPLETED',
          entityType: 'FoodItem',
          metadata: {
            ...summary,
            mode: 'APPLY',
            rollbackSnapshot: path.basename(rollbackFile),
            certificationsInvalidated: certified.length,
            clinicalApprovalGranted: false,
          },
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 30000, timeout: 300000 }
  );
  console.log(
    JSON.stringify({ appliedFoods: patches.length, appliedMeals: mealPatches.length, rollbackSnapshot: rollbackFile })
  );
}
main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Nutrient completion failed');
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Prisma, PrismaClient, type RawRecipeCandidate } from '@prisma/client';
import { databaseTarget, assertWriteTarget } from './helpers/dev-test-account-config';
import { createDemoRecipePreparer, type HouseholdFood } from '../src/services/demo-recipe-preparation.service';
import { DEMO_PREPARATION_VERSION } from '../src/domain/demo-recipe-measurement.policy';
import { DEMO_STANDARD_PORTIONS } from '../src/domain/demo-standard-portions.policy';
import {
  DEMO_RULESET_VERSION,
  DEMO_RULE_SOURCES,
  DEMO_RULE_PROPOSALS,
  DEMO_RULE_CAVEATS,
} from '../src/domain/demo-condition-rules.policy';
import { buildMealLibraryRecipeSignature } from '../src/domain/meal-library-signature.policy';
import { buildRawRecipeContentSignature } from '../src/domain/raw-recipe-content-signature.policy';
import { persistDeterministicLibraryClassification } from '../src/services/meal-library-publication.service';
import { classifyMealIngredients } from '../src/domain/meal-ingredient-classification.policy';

const args = process.argv.slice(2),
  apply = args.includes('--apply');
const target = databaseTarget(process.env.DATABASE_URL ?? '', process.env);
if (!target.local && target.label !== 'ep-crimson-poetry-ao0sqrvy-pooler.c-2.ap-southeast-1.aws.neon.tech:5432/neondb')
  throw new Error('Only the confirmed development branch or local fixtures are permitted.');
if (apply) assertWriteTarget(target, args);
const db = new PrismaClient();
// Nutrient source JSON can be large; calculations need only indexed composition fields.
const foodSelect = {
  id: true,
  name: true,
  source: true,
  sourceRecordId: true,
  compositionRevision: true,
  category: true,
  calories: true,
  proteinG: true,
  carbsG: true,
  fatG: true,
  fiber: true,
  sodium: true,
  potassium: true,
  sugar: true,
  phosphorus: true,
  saturatedFat: true,
} satisfies Prisma.FoodItemSelect;
function json(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
async function main() {
  const house = JSON.parse(
    await readFile(path.resolve(__dirname, '../prisma/data/usda-household-portions.json'), 'utf8')
  );
  const snapshot = await db.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const foods = await tx.foodItem.findMany({ select: foodSelect });
      const sources = await tx.rawRecipeCandidate.findMany({
        where: {
          sourceName: 'PANLASANG_PINOY',
          status: 'AVAILABLE',
          NOT: { sourceRecordId: { startsWith: 'DEMO_PREPARATION:' } },
        },
        include: { applicableMealTypes: true, libraryVariants: { include: { reviewLineage: true, flags: true } } },
        orderBy: { id: 'asc' },
      });
      return { foods, sources };
    },
    { isolationLevel: 'RepeatableRead', timeout: 120000 }
  );
  const prepare = createDemoRecipePreparer(
    snapshot.foods as unknown as import('@prisma/client').FoodItem[],
    house.records as HouseholdFood[]
  );
  const byId = new Map(snapshot.foods.map((f) => [f.id, f]));
  const audit = args.includes('--collection-only')
    ? []
    : snapshot.sources.map((row) => ({ name: row.recipeName, ...prepare(row) }));
  const candidates: Array<{
    source: (typeof snapshot.sources)[number];
    result: ReturnType<typeof prepare>;
    ingredients: Array<{ name: string; foodItemId: string; quantity: number; unit: string; demoAssumption: string }>;
  }> = [];
  for (const definition of DEMO_STANDARD_PORTIONS) {
    const source = snapshot.sources.find((s) => s.recipeName === definition.sourceName);
    if (!source) throw new Error(`Source recipe missing: ${definition.sourceName}`);
    if (
      source.libraryVariants.some(
        (v) =>
          v.status === 'FLAGGED' ||
          v.status === 'ARCHIVED' ||
          v.flags.length ||
          (v.reviewLineage && v.reviewLineage.state !== 'PUBLISHED')
      )
    )
      continue;
    const ingredientInputs = definition.ingredients.map(([id, grams]) => {
      const food = byId.get(`USDA_FDC_${id}`);
      if (!food) throw new Error(`Source food missing: ${id}`);
      return {
        name: food.name,
        foodItemId: food.id,
        quantity: grams,
        unit: 'g',
        demoAssumption: 'STANDARDIZED_DEMO_EDIBLE_GRAMS',
      };
    });
    const result = prepare({
      ...source,
      ingredients: json(ingredientInputs) as Prisma.JsonValue,
      originalServings: 1,
    } as RawRecipeCandidate);
    if (!result.complete)
      throw new Error(
        `Incomplete standard portion: ${source.recipeName}: ${result.missingMappings},${result.missingAmounts},${result.missingNutrients}`
      );
    candidates.push({ source, result, ingredients: ingredientInputs });
  }
  const collection = candidates.map(({ source, result }) => ({
    name: source.recipeName,
    signature: result.signature,
    nutrition: result.nutrition,
    ingredients: result.prepared,
    estimated: true,
    clinicalCertification: false,
  }));
  const report = {
    checkedAt: new Date().toISOString(),
    target: target.label,
    confirmation: target.token,
    mode: apply ? 'APPLY' : 'DRY_RUN',
    version: DEMO_PREPARATION_VERSION,
    sourceRecipes: audit.length,
    parsedIngredientEntries: audit.reduce((n, r) => n + r.prepared.length, 0),
    unresolvedMappings: audit.reduce((n, r) => n + r.missingMappings.length, 0),
    unresolvedAmounts: audit.reduce((n, r) => n + r.missingAmounts.length, 0),
    sourceRecipesWithCalculatedTotals: audit.filter((r) => r.nutrition).length,
    sourceRecipesWithCompleteTotals: audit.filter((r) => r.complete).length,
    standardDemoRecipes: collection.length,
    collection,
    rules: DEMO_RULE_PROPOSALS,
    caveats: DEMO_RULE_CAVEATS,
    unresolvedRecipes: audit
      .filter((r) => !r.complete)
      .map((r) => ({
        name: r.name,
        sourceUrl: r.sourceUrl,
        missingMappings: r.missingMappings,
        missingAmounts: r.missingAmounts,
        missingNutrients: r.missingNutrients,
      })),
  };
  const reportFile = path.resolve(
    process.env.DEMO_PREPARATION_REPORT ?? '../docs/verification/DEMO_RECIPE_PREPARATION_2026-10-09.json'
  );
  await mkdir(path.dirname(reportFile), { recursive: true });
  await writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
  console.log(
    JSON.stringify(
      {
        ...report,
        collection: collection.map((r) => ({ name: r.name, nutrition: r.nutrition })),
        unresolvedRecipes: undefined,
      },
      null,
      2
    )
  );
  if (!apply) return;
  const file = args[args.indexOf('--verified-backup') + 1],
    sha = args[args.indexOf('--backup-sha256') + 1];
  if (!args.includes('--verified-backup') || !args.includes('--backup-sha256'))
    throw new Error('A verified full backup and SHA-256 are required.');
  const backup = await readFile(file);
  if (backup.subarray(0, 5).toString() !== 'PGDMP') throw new Error('A PostgreSQL custom-format backup is required.');
  if (createHash('sha256').update(backup).digest('hex') !== sha) throw new Error('Backup checksum mismatch.');
  await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(741010)`;
      let created = 0;
      // All existing recipe, member, reviewer and approval rows remain immutable.
      for (const { source, result, ingredients } of candidates) {
        const recordId = `DEMO_PREPARATION:${source.id}:${DEMO_PREPARATION_VERSION}`;
        const existing = await tx.rawRecipeCandidate.findUnique({ where: { sourceRecordId: recordId } });
        if (existing) {
          const recorded = existing.publishedNutrition as { demoPreparation?: { signature?: string } } | null;
          if (recorded?.demoPreparation?.signature !== result.signature)
            throw new Error('Demo draft content changed; use a new preparation version instead of overwriting.');
          continue;
        }
        const current = await tx.rawRecipeCandidate.findUniqueOrThrow({
          where: { id: source.id },
          include: { libraryVariants: { include: { reviewLineage: true, flags: true } } },
        });
        if (
          current.updatedAt.getTime() !== source.updatedAt.getTime() ||
          current.contentSignature !== source.contentSignature ||
          current.status !== 'AVAILABLE' ||
          current.libraryVariants.some(
            (v) =>
              v.status !== 'APPROVED' || v.flags.length || (v.reviewLineage && v.reviewLineage.state !== 'PUBLISHED')
          )
        )
          throw new Error('Source changed or held after preview; import rolled back.');
        const foodIds = ingredients.map((i) => i.foodItemId);
        const live = await tx.foodItem.findMany({ where: { id: { in: foodIds } }, select: foodSelect });
        if (
          live.length !== new Set(foodIds).size ||
          live.some(
            (f) =>
              f.compositionRevision !== byId.get(f.id)?.compositionRevision ||
              JSON.stringify(f) !== JSON.stringify(byId.get(f.id))
          )
        )
          throw new Error('Composition changed after preview; import rolled back.');
        const name = source.recipeName;
        const n = result.nutrition!;
        const signature = buildRawRecipeContentSignature({
          name,
          category: source.category,
          ingredients,
          nutrition: n,
        });
        const recipe = await tx.rawRecipeCandidate.create({
          data: {
            sourceRecordId: recordId,
            sourceName: 'DEMO_STANDARD_PORTION',
            sourceUrl: source.sourceUrl,
            sourceImageUrl: source.sourceImageUrl,
            sourceVideoUrl: source.sourceVideoUrl,
            recipeName: name,
            normalizedName: name.toLowerCase(),
            contentSignature: signature,
            category: source.category,
            cuisines: source.cuisines as Prisma.InputJsonValue,
            description: source.description ?? source.recipeName,
            mealType: source.mealType,
            riceRole: source.riceRole,
            riceRoleReviewStatus: 'NOT_REVIEWED',
            dietaryTags: classifyMealIngredients(ingredients).compatibleDietaryPreferences,
            ingredients: json(ingredients),
            calories: n.calories,
            proteinG: n.proteinG,
            carbsG: n.carbsG,
            fatG: n.fatG,
            originalServings: 1,
            publishedNutrition: {
              demoPreparation: json({
                ...result,
                standardPortionAssumptions: true,
                originalPublishedNutrition: source.publishedNutrition,
              }),
            },
            applicableMealTypes: {
              create: source.applicableMealTypes.map((t) => ({
                mealType: t.mealType,
                source: 'DETERMINISTIC_CLASSIFIER',
                reviewStatus: 'PROPOSED',
              })),
            },
          },
        });
        const libraryIngredients = ingredients.map((i, position) => ({
          position,
          ingredientName: i.name,
          quantity: i.quantity,
          unit: 'g',
          foodItemId: i.foodItemId,
          dataSource: 'SOURCE_RECIPE' as const,
        }));
        const librarySignature = buildMealLibraryRecipeSignature({
          mealName: name,
          mealType: source.mealType,
          ...n,
          ingredients: libraryIngredients,
        });
        const lineageIds = new Set(source.libraryVariants.map((v) => v.reviewLineageId).filter(Boolean));
        if (lineageIds.size > 1) throw new Error('Ambiguous source lineage; import rolled back.');
        const parent = source.libraryVariants.find((v) => v.reviewLineageId) ?? source.libraryVariants[0] ?? null;
        const meal = await tx.mealLibrary.create({
          data: {
            mealName: name,
            mealType: source.mealType,
            description: recipe.description,
            sourceRawRecipeCandidateId: recipe.id,
            parentMealId: parent?.id,
            reviewLineageId: parent?.reviewLineageId,
            recipeFamilyId: parent?.recipeFamilyId ?? parent?.id,
            derivationKind: 'ADAPTED',
            ...n,
            recipeSignature: librarySignature,
            status: 'APPROVED',
            safetyEvidenceStatus: 'INCOMPLETE',
            safetyEvidenceOrigin: 'LEGACY_UNREVIEWED',
            nutritionEvidenceSource: 'UNKNOWN',
            safetyEvidenceRevision: 1,
            suitableConditions: [],
            allergenFree: [],
            dietaryTags: [],
            nutritionServingDescription: 'Per serving',
            ingredients: { create: libraryIngredients },
            safetyReviews: {
              create: {
                outcome: 'DRAFT_CREATED',
                evidenceRevision: 1,
                reasonCode: DEMO_PREPARATION_VERSION,
                evidenceSnapshot: json(result),
              },
            },
          },
        });
        await persistDeterministicLibraryClassification(tx, meal.id);
        await tx.auditEvent.create({
          data: {
            action: 'DEMO_STANDARD_PORTION_DRAFT_CREATED',
            entityType: 'MealLibrary',
            entityId: meal.id,
            metadata: {
              sourceId: source.id,
              rawRecipeId: recipe.id,
              sourceSignature: source.contentSignature,
              estimated: true,
              clinicalCertification: false,
            },
          },
        });
        created++;
      }
      for (const source of DEMO_RULE_SOURCES)
        await tx.clinicalEvidenceSource.upsert({
          where: { code: source.code },
          update: {},
          create: {
            code: source.code,
            title: source.title,
            issuingOrganization: source.issuingOrganization,
            canonicalUrl: source.canonicalUrl,
            sourceVersion: source.sourceVersion,
            domain: source.domain,
            documentType:
              source.issuingOrganization === 'World Health Organization' ? 'GOVERNMENT_GUIDANCE' : 'GUIDELINE',
            retrievedAt: new Date('2026-10-09'),
            sectionLocator: source.locator,
            population: source.population,
            jurisdiction: 'International population guidance',
            exclusionsAndCaveats: DEMO_RULE_CAVEATS,
          },
        });
      for (const condition of ['HYPERTENSION', 'HEART_CONDITION', 'DIABETES', 'KIDNEY_DISEASE', 'PREGNANT'] as const)
        await tx.conditionRulePolicyVersion.upsert({
          where: { condition_policyVersion: { condition, policyVersion: DEMO_RULESET_VERSION } },
          update: {},
          create: {
            condition,
            policyVersion: DEMO_RULESET_VERSION,
            assuranceTier: ['HEART_CONDITION', 'KIDNEY_DISEASE', 'PREGNANT'].includes(condition)
              ? 'ENHANCED'
              : 'STANDARD',
            automationAllowed: false,
            state: 'DRAFT',
          },
        });
      let newRules = 0;
      for (const proposal of DEMO_RULE_PROPOSALS) {
        const source = DEMO_RULE_SOURCES.find((s) => s.code === proposal.sourceCode)!;
        const evidence = await tx.clinicalEvidenceSource.findUniqueOrThrow({ where: { code: source.code } });
        const identity = {
          condition: proposal.condition,
          nutrient: proposal.nutrient,
          operator: 'LESS_THAN' as const,
          threshold: proposal.threshold,
          basis: proposal.basis,
          policyVersion: DEMO_RULESET_VERSION,
        };
        if (await tx.conditionNutrientRule.findFirst({ where: identity })) continue;
        await tx.conditionNutrientRule.create({
          data: {
            ...identity,
            unit: proposal.unit,
            severity: 'FLAG',
            rationale: 'Population guidance proposed for whole-day screening, requiring diagnosis-specific RND review.',
            sourceTitle: source.title,
            sourceCitation: source.canonicalUrl,
            evidenceSourceId: evidence.id,
            evidenceLocator: source.locator,
            applicablePopulation: source.population,
            requiredInputs: {
              completeDailyTotals: true,
              dailyCalories: proposal.basis === 'PERCENT_OF_DAILY_CALORIES',
              verifiedPreparation: true,
              diagnosisSpecificReview: true,
            },
            exclusionsAndCaveats: DEMO_RULE_CAVEATS,
            evaluationScope: 'DAY',
            authorityOutcome: 'REVIEW_REQUIRED',
            reviewStatus: 'DRAFT',
            active: false,
          },
        });
        newRules++;
      }
      if (created || newRules)
        await tx.auditEvent.create({
          data: {
            action: 'DEMO_RECIPE_PREPARATION_IMPORTED',
            entityType: 'RawRecipeCandidate',
            metadata: {
              version: DEMO_PREPARATION_VERSION,
              created,
              newRules,
              clinicalApprovalGranted: false,
              originalRowsChanged: false,
            },
          },
        });
      console.log(
        JSON.stringify({ createdRecipes: created, createdRuleDrafts: newRules, clinicalApprovalGranted: false })
      );
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120000, maxWait: 10000 }
  );
}
main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : 'Demo preparation failed');
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

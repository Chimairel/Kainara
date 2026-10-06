import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DietaryPreference, MealType, Prisma, PrismaClient } from '@prisma/client';
import { classifyMealIngredients } from '../src/domain/meal-ingredient-classification.policy';
import { proposeMealTypeApplicability } from '../src/domain/meal-applicability.policy';
import { proposeRiceRole } from '../src/domain/recipe-rice-role.policy';
import { buildRawRecipeContentSignature } from '../src/domain/raw-recipe-content-signature.policy';
import { recoverSourceIngredientIdentity } from '../src/domain/source-ingredient-identity-recovery.policy';
import { sourceRecipeNutritionReviewHold } from '../src/domain/source-recipe-review-holds.policy';
import {
  recoverSourceIngredientMeasurement,
  SOURCE_INGREDIENT_RECOVERY_VERSION,
} from '../src/domain/source-ingredient-recovery.policy';
import {
  createSourceIngredientFnriMatcher,
  isInvalidSourceIngredientLabel,
  SOURCE_INGREDIENT_FNRI_MAPPING_VERSION,
} from '../src/domain/source-ingredient-fnri-match.policy';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const DEFAULT_SOURCE = path.resolve(
  'C:/Users/chima/Desktop/Nutrimind/backend/prisma/data/panlasang-pinoy-recipes.json'
);

type RawIngredient = { name?: unknown; quantity?: unknown; unit?: unknown; text?: unknown };
type RawRecipe = {
  id?: unknown;
  name?: unknown;
  sourceUrl?: unknown;
  image?: unknown;
  youtubeUrl?: unknown;
  category?: unknown;
  cuisine?: unknown;
  description?: unknown;
  originalServings?: unknown;
  nutritionPerServing?: Record<string, unknown> | null;
  ingredients1Person?: RawIngredient[];
};

function normalize(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric * 1000) / 1000 : null;
}

function inferMealType(recipe: RawRecipe): MealType {
  const text = `${normalize(recipe.name)} ${normalize(recipe.category)}`;
  if (/\b(breakfast|pancake|omelet|omelette|tapsilog|longsilog|tocilog|french toast)\b/u.test(text)) {
    return MealType.BREAKFAST;
  }
  if (/\b(snack|dessert|cookie|cake|bread|muffin|candy|drink|beverage|shake|smoothie|salad)\b/u.test(text)) {
    return MealType.SNACK;
  }
  return /\b(dinner|supper)\b/u.test(text) ? MealType.DINNER : MealType.LUNCH;
}

async function main() {
  const sourcePath = process.env.PANLASANG_RAW_CORPUS_PATH || DEFAULT_SOURCE;
  const parsed = JSON.parse(await readFile(sourcePath, 'utf8')) as RawRecipe[];
  if (!Array.isArray(parsed)) throw new Error('Raw recipe corpus must be a JSON array.');

  const unique = new Map<string, RawRecipe>();
  let malformed = 0;
  for (const recipe of [...parsed].sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
    if (!normalize(recipe.id) || !normalize(recipe.name) || !String(recipe.sourceUrl ?? '').startsWith('http')) {
      malformed += 1;
      continue;
    }
    recipe.ingredients1Person = (recipe.ingredients1Person ?? []).map(
      (ingredient) => recoverSourceIngredientIdentity(ingredient).ingredient
    );
    const contentSignature = buildRawRecipeContentSignature({
      name: recipe.name,
      category: recipe.category,
      nutrition: recipe.nutritionPerServing,
      ingredients: recipe.ingredients1Person,
    });
    if (!unique.has(contentSignature)) unique.set(contentSignature, recipe);
  }

  const exactDuplicates = parsed.length - malformed - unique.size;
  const summary = { raw: parsed.length, uniqueContent: unique.size, exactDuplicates, malformed, apply: APPLY };
  console.log(JSON.stringify(summary, null, 2));
  if (!APPLY) return;

  const fnriFoods = await prisma.foodItem.findMany({
    where: { source: 'FNRI' },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const verifiedAliases = await prisma.foodAlias.findMany({
    where: { verifiedAt: { not: null }, foodItem: { source: 'FNRI' } },
    select: { alias: true, foodItemId: true, verifiedAt: true },
  });
  const fnriMatcher = createSourceIngredientFnriMatcher(fnriFoods, verifiedAliases);

  const keepSignatures = [...unique.keys()];
  const rows: Prisma.RawRecipeCandidateCreateManyInput[] = [];
  for (const [contentSignature, recipe] of unique) {
    const rawIngredients = recipe.ingredients1Person ?? [];
    const mappedIngredients = rawIngredients.map((ingredient) => {
      const name = String(ingredient.name ?? ingredient.text ?? '').trim();
      const match = fnriMatcher.match(name);
      return {
        name,
        quantity: finite(ingredient.quantity),
        unit: String(ingredient.unit ?? '').trim() || null,
        foodItemId: match?.food.id ?? null,
        fnriFoodName: match?.food.name ?? null,
        fnriMatchMethod: match?.method ?? null,
        fnriMatchStatus: match
          ? 'MATCHED'
          : isInvalidSourceIngredientLabel(name)
            ? 'INVALID_SOURCE_FRAGMENT'
            : 'UNRESOLVED',
        fnriMappingVersion: SOURCE_INGREDIENT_FNRI_MAPPING_VERSION,
        excludedFromPlanning: isInvalidSourceIngredientLabel(name),
      };
    });
    let recoveredMeasurements = 0;
    const ingredients = mappedIngredients.map((ingredient) => {
      const recovered = recoverSourceIngredientMeasurement(ingredient, finite(recipe.originalServings));
      if (recovered.method) recoveredMeasurements++;
      return recovered.ingredient as typeof ingredient;
    });
    const classification = classifyMealIngredients(ingredients);
    const nutrition = recipe.nutritionPerServing ?? null;
    const missingPublishedCore = ['calories', 'proteinG', 'carbsG', 'fatG'].some(
      (key) => finite(nutrition?.[key]) === null
    );
    const recordedNutrition =
      missingPublishedCore || recoveredMeasurements
        ? {
            ...(nutrition ?? {}),
            dataCompletionAudit: {
              actor: 'Codex',
              version: 'CODEX_PANLASANG_DATA_AUDIT_V1',
              recordedAt: new Date().toISOString(),
              operations: [
                ...(missingPublishedCore ? ['MISSING_SOURCE_NUTRITION_RECORDED_AS_NULL'] : []),
                ...(recoveredMeasurements ? [SOURCE_INGREDIENT_RECOVERY_VERSION] : []),
              ],
              note: 'Source measurements recovered only where explicit in the recipe text; absent published nutrients remain unknown.',
            },
          }
        : nutrition;
    const tags = classification.compatibleDietaryPreferences.length
      ? classification.compatibleDietaryPreferences
      : [DietaryPreference.OMNIVORE];
    const sourceRecordId = String(recipe.id);
    const primaryMealType = inferMealType(recipe);
    const riceRole = proposeRiceRole({
      name: String(recipe.name),
      category: recipe.category ? String(recipe.category) : null,
      ingredients,
    });

    rows.push({
      sourceRecordId,
      sourceUrl: String(recipe.sourceUrl),
      sourceImageUrl: recipe.image ? String(recipe.image) : null,
      sourceVideoUrl: recipe.youtubeUrl ? String(recipe.youtubeUrl) : null,
      recipeName: String(recipe.name).trim(),
      normalizedName: normalize(recipe.name),
      contentSignature,
      category: recipe.category ? String(recipe.category) : null,
      cuisines: Array.isArray(recipe.cuisine) ? recipe.cuisine.map(String) : [],
      description: recipe.description ? String(recipe.description) : null,
      mealType: primaryMealType,
      riceRole: riceRole.riceRole,
      riceRoleReviewStatus: riceRole.riceRole ? 'PROPOSED' : 'NOT_REVIEWED',
      includedRiceG: riceRole.includedRiceG,
      dietaryTags: tags,
      ingredients: ingredients as unknown as Prisma.InputJsonValue,
      publishedNutrition: recordedNutrition ? (recordedNutrition as Prisma.InputJsonValue) : Prisma.JsonNull,
      calories: finite(nutrition?.calories),
      proteinG: finite(nutrition?.proteinG),
      carbsG: finite(nutrition?.carbsG),
      fatG: finite(nutrition?.fatG),
      originalServings: finite(recipe.originalServings),
      status: sourceRecipeNutritionReviewHold(String(recipe.sourceUrl)) ? 'RETIRED' : 'AVAILABLE',
    });
  }
  // Upsert by the stable source record rather than only inserting by content
  // signature. Signature versions can become stricter as the indexer learns to
  // represent more source fields; an existing provider record must receive the
  // new signature instead of being silently left stale by skipDuplicates.
  const reviewedLabels = await prisma.rawRecipeCandidate.findMany({
    where: { sourceName: 'PANLASANG_PINOY', riceRoleReviewStatus: 'REVIEWED' },
    select: {
      sourceRecordId: true,
      contentSignature: true,
      riceRole: true,
      riceRoleReviewStatus: true,
      includedRiceG: true,
    },
  });
  const reviewedBySource = new Map(reviewedLabels.map((label) => [label.sourceRecordId, label]));
  for (let offset = 0; offset < rows.length; offset += 50) {
    await Promise.all(
      rows.slice(offset, offset + 50).map((row) => {
        const reviewed = reviewedBySource.get(row.sourceRecordId);
        const label =
          reviewed?.contentSignature === row.contentSignature
            ? {
                riceRole: reviewed.riceRole,
                riceRoleReviewStatus: reviewed.riceRoleReviewStatus,
                includedRiceG: reviewed.includedRiceG,
              }
            : {};
        return prisma.rawRecipeCandidate.upsert({
          where: { sourceRecordId: row.sourceRecordId },
          create: row,
          update: { ...row, ...label },
        });
      })
    );
  }
  await prisma.rawRecipeCandidate.updateMany({
    where: {
      sourceName: 'PANLASANG_PINOY',
      contentSignature: { in: keepSignatures },
      sourceRecordId: { notIn: rows.filter((row) => row.status === 'RETIRED').map((row) => row.sourceRecordId) },
    },
    data: { status: 'AVAILABLE' },
  });
  await prisma.rawRecipeCandidate.updateMany({
    where: { sourceName: 'PANLASANG_PINOY', contentSignature: { notIn: keepSignatures } },
    data: { status: 'RETIRED' },
  });
  const indexed = await prisma.rawRecipeCandidate.findMany({
    where: { sourceName: 'PANLASANG_PINOY', contentSignature: { in: keepSignatures } },
    select: { id: true, recipeName: true, category: true, mealType: true },
  });
  const applicabilityRows: Prisma.RawRecipeApplicableTypeCreateManyInput[] = [];
  for (const candidate of indexed) {
    const applicable = proposeMealTypeApplicability({
      name: candidate.recipeName,
      category: candidate.category,
      primaryMealType: candidate.mealType,
    });
    applicabilityRows.push(
      ...applicable.map((mealType) => ({
        rawRecipeCandidateId: candidate.id,
        mealType,
        source: 'DETERMINISTIC_CLASSIFIER' as const,
        reviewStatus: 'PROPOSED' as const,
      }))
    );
  }
  for (let offset = 0; offset < applicabilityRows.length; offset += 500) {
    await prisma.rawRecipeApplicableType.createMany({
      data: applicabilityRows.slice(offset, offset + 500),
      skipDuplicates: true,
    });
  }
  console.log(`Indexed ${unique.size} content-distinct recipes; retired corpus rows absent from this snapshot.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

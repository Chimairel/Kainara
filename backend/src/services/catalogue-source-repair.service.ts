import { Prisma, type RawRecipeCandidate, type MealType } from '@prisma/client';
import {
  recoverSourceIngredientIdentity,
  SOURCE_IDENTITY_RECOVERY_VERSION,
} from '../domain/source-ingredient-identity-recovery.policy';
import { buildRawRecipeContentSignature } from '../domain/raw-recipe-content-signature.policy';
import { buildMealLibraryRecipeSignature } from '../domain/meal-library-signature.policy';
import { effectiveRecipeMealTypes } from '../domain/meal-applicability.policy';
import {
  classifyMealIngredients,
  MEAL_INGREDIENT_CLASSIFICATION_VERSION,
} from '../domain/meal-ingredient-classification.policy';
import {
  createSourceIngredientFnriMatcher,
  SOURCE_INGREDIENT_FNRI_MAPPING_VERSION,
} from '../domain/source-ingredient-fnri-match.policy';
import { suspendMealClearancesForEvidenceChange } from './condition-clearance.service';
import { sourceRecipeNutritionReviewHold } from '../domain/source-recipe-review-holds.policy';

export const CATALOGUE_REPAIR_REASON = 'SOURCE_IDENTITY_OR_MEAL_ROLE_CORRECTED';
type Ingredient = Record<string, unknown> & { name: string; quantity?: number | null; unit?: string | null };
function ingredients(value: Prisma.JsonValue): Ingredient[] {
  if (!Array.isArray(value)) throw new Error('Recipe ingredients must be an array.');
  return value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.name !== 'string')
      throw new Error('Malformed source ingredient; manual review required.');
    return item as Ingredient;
  });
}

export function planCatalogueSourceRepair(row: RawRecipeCandidate, declared: readonly MealType[]) {
  const before = ingredients(row.ingredients);
  const recovered = before.map((item) => recoverSourceIngredientIdentity(item));
  const after = recovered.map((result) => result.ingredient);
  const count = recovered.filter((result) => result.recovered).length;
  const types = effectiveRecipeMealTypes(row.recipeName, row.category, declared);
  const rolesChanged = [...declared].sort().join() !== [...types].sort().join();
  const classification = classifyMealIngredients(after.filter((item) => item.excludedFromPlanning !== true));
  const oldTags = Array.isArray(row.dietaryTags)
    ? row.dietaryTags.filter((tag): tag is string => typeof tag === 'string')
    : [];
  // Narrow incorrect diet claims only. Never infer new eligibility or allergen absence.
  const tags = oldTags.filter((tag) => classification.compatibleDietaryPreferences.some((value) => value === tag));
  const tagsChanged = oldTags.join() !== tags.join();
  const nutritionHold = sourceRecipeNutritionReviewHold(row.sourceUrl);
  const heldAlready = nutritionHold && row.status === 'RETIRED';
  if (!count && !rolesChanged && !tagsChanged && (!nutritionHold || heldAlready)) return null;
  const signature = count
    ? buildRawRecipeContentSignature({
        name: row.recipeName,
        category: row.category,
        ingredients: after,
        nutrition: { calories: row.calories, proteinG: row.proteinG, carbsG: row.carbsG, fatG: row.fatG },
      })
    : row.contentSignature;
  return { before, after, recovered: count, types, rolesChanged, tags, tagsChanged, signature, nutritionHold };
}

export async function applyCatalogueSourceRepair(
  tx: Prisma.TransactionClient,
  row: RawRecipeCandidate,
  repair: NonNullable<ReturnType<typeof planCatalogueSourceRepair>>,
  matcher: ReturnType<typeof createSourceIngredientFnriMatcher<{ id: string; name: string }>>
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(741010)`;
  // Serialize with source-plan persistence; its final signature check observes this change.
  await tx.$queryRaw`SELECT id FROM "RawRecipeCandidate" WHERE id = ${row.id} FOR UPDATE`;
  const now = new Date();
  const updatedIngredients = repair.after.map((ingredient, index) => {
    if (ingredient.name === repair.before[index].name) return ingredient;
    const match = matcher.match(ingredient.name);
    return {
      ...ingredient,
      foodItemId: match?.food.id ?? null,
      fnriFoodName: match?.food.name ?? null,
      fnriMatchMethod: match?.method ?? null,
      fnriMatchStatus: match ? 'MATCHED' : 'UNRESOLVED',
      fnriMappingVersion: SOURCE_INGREDIENT_FNRI_MAPPING_VERSION,
    };
  });
  const nutrition =
    row.publishedNutrition && typeof row.publishedNutrition === 'object' && !Array.isArray(row.publishedNutrition)
      ? row.publishedNutrition
      : {};
  const priorAudit =
    nutrition.dataCompletionAudit &&
    typeof nutrition.dataCompletionAudit === 'object' &&
    !Array.isArray(nutrition.dataCompletionAudit)
      ? nutrition.dataCompletionAudit
      : {};
  const priorOperations = Array.isArray(priorAudit.operations) ? priorAudit.operations : [];
  const claimed = await tx.rawRecipeCandidate.updateMany({
    where: { id: row.id, updatedAt: row.updatedAt, contentSignature: row.contentSignature },
    data: {
      ingredients: updatedIngredients as Prisma.InputJsonValue,
      contentSignature: repair.signature,
      dietaryTags: repair.tags,
      ...(repair.nutritionHold ? { status: 'RETIRED' as const } : {}),
      publishedNutrition: {
        ...nutrition,
        dataCompletionAudit: {
          ...priorAudit,
          version: 'CODEX_PANLASANG_DATA_AUDIT_V1',
          actor: 'Codex',
          recordedAt: now.toISOString(),
          operations: [
            ...new Set([
              ...priorOperations,
              ...(repair.recovered ? [SOURCE_IDENTITY_RECOVERY_VERSION] : []),
              ...(repair.rolesChanged ? ['MAIN_MEAL_APPLICABILITY_NARROWED'] : []),
              ...(repair.tagsChanged ? ['DIETARY_TAGS_NARROWED'] : []),
              ...(repair.nutritionHold ? ['SOURCE_NUTRITION_REVIEW_REQUIRED'] : []),
            ]),
          ],
          note: 'Source food tokens restored; quantities and nutrition unchanged. No clinical certification granted.',
          ...(repair.nutritionHold ? { nutritionHold: repair.nutritionHold } : {}),
        },
      } as Prisma.InputJsonValue,
    },
  });
  if (claimed.count !== 1) throw new Error('Concurrent source edit; transaction rolled back.');
  if (repair.rolesChanged) {
    await tx.rawRecipeApplicableType.deleteMany({ where: { rawRecipeCandidateId: row.id } });
    if (repair.types.length)
      await tx.rawRecipeApplicableType.createMany({
        data: repair.types.map((mealType) => ({
          rawRecipeCandidateId: row.id,
          mealType,
          source: 'DETERMINISTIC_CLASSIFIER',
          reviewStatus: 'PROPOSED',
        })),
      });
  }
  const variants = await tx.mealLibrary.findMany({
    where: {
      OR: [
        { sourceRawRecipeCandidateId: row.id },
        { authoredByNutritionistId: null, mealName: row.recipeName, description: { contains: row.sourceUrl } },
      ],
    },
    include: { ingredients: true, applicableMealTypes: true },
  });
  let restoredLibraryIngredients = 0;
  for (const variant of variants) {
    // Source imports may be restored; nutritionist-authored derivatives keep their ingredients.
    const sourceImport =
      variant.authoredByNutritionistId === null &&
      variant.mealName === row.recipeName &&
      variant.description?.includes(row.sourceUrl);
    const corrected = variant.ingredients.map((item) => {
      if (!sourceImport) return item;
      const recovered = recoverSourceIngredientIdentity({
        name: item.ingredientName,
        quantity: item.quantity,
        unit: item.unit,
      });
      if (!recovered.recovered) return item;
      const food = matcher.match(recovered.ingredient.name);
      restoredLibraryIngredients++;
      return {
        ...item,
        ingredientName: recovered.ingredient.name,
        unit: recovered.ingredient.unit,
        foodItemId: food?.food.id ?? null,
      };
    });
    const classification = classifyMealIngredients(
      corrected.map((item) => ({ name: item.ingredientName, category: item.category }))
    );
    const oldTags = Array.isArray(variant.dietaryTags) ? variant.dietaryTags : [];
    const signature = buildMealLibraryRecipeSignature({ ...variant, ingredients: corrected });
    const claimedLibrary = await tx.mealLibrary.updateMany({
      where: { id: variant.id, updatedAt: variant.updatedAt, safetyEvidenceRevision: variant.safetyEvidenceRevision },
      data: {
        recipeSignature: signature,
        safetyEvidenceRevision: { increment: 1 },
        safetyEvidenceStatus: 'STALE',
        certifiedEvidenceRevision: null,
        safetyInvalidatedAt: now,
        safetyInvalidationReason: CATALOGUE_REPAIR_REASON,
        ingredientClassificationStatus: classification.status,
        ingredientClassificationVersion: MEAL_INGREDIENT_CLASSIFICATION_VERSION,
        ingredientClassifiedAt: now,
        ingredientClassificationFindings: classification as unknown as Prisma.InputJsonValue,
        dietaryTags: oldTags.filter((tag) =>
          classification.compatibleDietaryPreferences.some((value) => value === tag)
        ) as Prisma.InputJsonValue,
      },
    });
    if (claimedLibrary.count !== 1) throw new Error('Concurrent library edit; transaction rolled back.');
    for (let index = 0; index < corrected.length; index++) {
      const item = corrected[index];
      if (item.ingredientName === variant.ingredients[index].ingredientName) continue;
      await tx.mealLibraryIngredient.update({
        where: { id: item.id },
        data: {
          ingredientName: item.ingredientName,
          unit: item.unit,
          foodItemId: item.foodItemId,
        },
      });
    }
    const types = effectiveRecipeMealTypes(
      variant.mealName,
      sourceImport ? row.category : null,
      variant.applicableMealTypes.map((item) => item.mealType)
    );
    await tx.mealLibraryApplicableType.deleteMany({ where: { mealLibraryId: variant.id, mealType: { notIn: types } } });
    await tx.mealLibraryProfileApproval.updateMany({
      where: { mealLibraryId: variant.id, flaggedAt: null },
      data: { flaggedAt: now, flagReason: CATALOGUE_REPAIR_REASON },
    });
    await suspendMealClearancesForEvidenceChange(tx, variant.id, CATALOGUE_REPAIR_REASON);
    await tx.mealLibrarySafetyReview.create({
      data: {
        mealLibraryId: variant.id,
        nutritionistProfileId: null,
        outcome: 'INVALIDATED',
        evidenceRevision: variant.safetyEvidenceRevision,
        reasonCode: CATALOGUE_REPAIR_REASON,
        evidenceSnapshot: {
          sourceUrl: row.sourceUrl,
          beforeSignature: variant.recipeSignature,
          afterSignature: signature,
          actor: 'Codex data repair; not clinical review',
        },
      },
    });
  }
  const related = {
    OR: [{ sourceRawRecipeCandidateId: row.id }, { libraryMealId: { in: variants.map((item) => item.id) } }],
  };
  // Never rewrite historical consumed ingredients or nutrition. Old unconsumed proposals must be replaced.
  const dependent = await tx.mealPlan.findMany({
    where: {
      ...related,
      status: { in: ['APPROVED', 'PENDING_REVIEW'] },
      mealLogs: { none: { status: { in: ['DONE', 'SKIPPED'] } } },
    },
    select: { id: true, userId: true },
  });
  if (dependent.length) {
    await tx.mealPlan.updateMany({
      where: { id: { in: dependent.map((item) => item.id) } },
      data: { status: 'CANCELLED', requiresSafetyRevalidation: true },
    });
    await tx.groceryList.updateMany({
      where: { userId: { in: [...new Set(dependent.map((item) => item.userId))] } },
      data: { isStale: true },
    });
  }
  await tx.auditEvent.create({
    data: {
      action: 'CATALOGUE_SOURCE_REPAIRED',
      entityType: 'RawRecipeCandidate',
      entityId: row.id,
      metadata: {
        sourceUrl: row.sourceUrl,
        recoveredIngredients: repair.recovered,
        beforeSignature: row.contentSignature,
        afterSignature: repair.signature,
        oldTypes: row.mealType,
        effectiveTypes: repair.types,
        nutritionUnchanged: true,
        nutritionHold: repair.nutritionHold,
        invalidatedVariants: variants.length,
        cancelledUnconsumedPlans: dependent.length,
      },
    },
  });
  return {
    restoredLibraryIngredients,
    invalidatedVariants: variants.length,
    cancelledUnconsumedPlans: dependent.length,
  };
}

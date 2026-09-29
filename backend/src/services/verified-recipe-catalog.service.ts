import { MealType, Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { loadUserNutritionContext } from '@/domain/user-nutrition-context';
import { adaptUserSafetyRestrictions } from '@/domain/structured-restriction.adapter';
import { admittedLibraryBaseIds } from './meal-base-admission.service';
import { isUnrestrictedPanlasangBaseEligible } from '@/domain/unrestricted-panlasang-base.policy';
import { parseRecipeCandidateIngredients } from './panlasang-recipe-candidate.provider';
import { sourceDataAuditLabel } from '@/domain/source-data-audit.policy';
import { allowDemoNutritionPlanning, hasDemoNutritionEstimate } from '@/domain/source-nutrition-estimate.policy';

/** Browse-only verified bases. This endpoint never grants planning or case clearance. */
export class VerifiedRecipeCatalogService {
  static async list(userId: string, input: { search?: string; mealType?: MealType; page?: number }) {
    const { user, conditions, allergens, otherConditions, otherAllergies } =
      await loadUserNutritionContext(prisma, userId, 'User profile not found.');
    const restrictions = adaptUserSafetyRestrictions({ healthConditions: conditions, allergies: allergens,
      otherConditions, otherAllergies, safetyEntries: user.safetyProfileEntries });
    if (restrictions.requiresReview || restrictions.conditions.length || restrictions.allergies.length ||
      restrictions.customConditions.length || restrictions.customFoodRestrictions.length) {
      return { items: [], total: 0, page: 1, pageCount: 0, restrictedProfile: true };
    }

    // Some published source rows have no MealLibrary serving variant. Querying
    // MealLibrary alone would omit those real recipes from this browse-only view.
    const rawWhere: Prisma.RawRecipeCandidateWhereInput = {
      sourceName: 'PANLASANG_PINOY', status: 'AVAILABLE',
      libraryVariants: { none: { status: 'FLAGGED' } },
      ...(input.search ? { recipeName: { contains: input.search, mode: 'insensitive' } } : {}),
      ...(input.mealType ? { applicableMealTypes: { some: { mealType: input.mealType } } } : {}),
    };
    const manual = await prisma.mealLibrary.findMany({
      where: { status: 'APPROVED', OR: [
        { sourceRawRecipeCandidateId: null },
        { sourceRawRecipeCandidate: { is: { sourceName: { not: 'PANLASANG_PINOY' } } } },
      ] },
      select: { id: true, recipeSignature: true, description: true, sourceRawRecipeCandidateId: true,
        sourceRawRecipeCandidate: { select: { sourceName: true, status: true, contentSignature: true } } },
    });
    const manuallyVerified = await admittedLibraryBaseIds(manual);
    const manualWhere: Prisma.MealLibraryWhereInput = {
      id: { in: [...manuallyVerified] }, status: 'APPROVED',
      ...(input.search ? { mealName: { contains: input.search, mode: 'insensitive' } } : {}),
      ...(input.mealType ? { applicableMealTypes: { some: { mealType: input.mealType } } } : {}),
    };
    const [rawCount, manualCount] = await Promise.all([
      prisma.rawRecipeCandidate.count({ where: rawWhere }),
      prisma.mealLibrary.count({ where: manualWhere }),
    ]);
    const total = rawCount + manualCount;
    const pageCount = Math.ceil(total / 24);
    const page = Math.min(Math.max(1, input.page ?? 1), Math.max(1, pageCount));
    const offset = (page - 1) * 24;
    const rawTake = Math.max(0, Math.min(24, rawCount - offset));
    const rawRows = rawTake ? await prisma.rawRecipeCandidate.findMany({
      where: rawWhere, orderBy: [{ normalizedName: 'asc' }, { id: 'asc' }],
      skip: offset, take: rawTake,
      select: { id: true, recipeName: true, description: true, sourceName: true, sourceUrl: true,
        sourceImageUrl: true, status: true, publishedNutrition: true, ingredients: true,
        calories: true, proteinG: true, carbsG: true, fatG: true,
        applicableMealTypes: { select: { mealType: true } } },
    }) : [];
    const manualTake = 24 - rawRows.length;
    const manualRows = manualTake ? await prisma.mealLibrary.findMany({
      where: manualWhere, orderBy: [{ mealName: 'asc' }, { id: 'asc' }],
      skip: Math.max(0, offset - rawCount), take: manualTake,
      select: { id: true, mealName: true, description: true, calories: true,
        proteinG: true, carbsG: true, fatG: true, safetyEvidenceStatus: true,
        sourceRawRecipeCandidate: { select: { sourceName: true, sourceUrl: true, sourceImageUrl: true } },
        applicableMealTypes: { select: { mealType: true } } },
    }) : [];
    return { total, page, pageCount, restrictedProfile: false,
      items: [
        ...rawRows.map((source) => {
          const ingredients = parseRecipeCandidateIngredients(source.ingredients);
          const planningReady = isUnrestrictedPanlasangBaseEligible({ source, candidateId: source.id,
            conditions: [], allergens: [], preparedIngredients: ingredients.map((item) => ({
              ingredientName: item.name, quantity: item.quantity, unit: item.unit })),
            allowDemoEstimatedNutrition: allowDemoNutritionPlanning() });
          return { id: `raw:${source.id}`, name: source.recipeName, description: source.description,
            mealTypes: source.applicableMealTypes.map((item) => item.mealType),
            calories: source.calories, proteinG: source.proteinG, carbsG: source.carbsG, fatG: source.fatG,
            sourceName: source.sourceName, sourceUrl: source.sourceUrl,
            imageUrl: source.sourceImageUrl, planningReady,
            dataAuditLabel: sourceDataAuditLabel(source.publishedNutrition),
            nutritionEstimated: hasDemoNutritionEstimate(source.publishedNutrition) };
        }),
        ...manualRows.map((row) => ({ id: row.id, name: row.mealName, description: row.description,
          mealTypes: row.applicableMealTypes.map((item) => item.mealType),
          calories: row.calories, proteinG: row.proteinG, carbsG: row.carbsG, fatG: row.fatG,
          sourceName: row.sourceRawRecipeCandidate?.sourceName ?? 'ADMIN_OR_GENERATED',
          sourceUrl: row.sourceRawRecipeCandidate?.sourceUrl ?? null,
          imageUrl: row.sourceRawRecipeCandidate?.sourceImageUrl ?? null,
          planningReady: row.safetyEvidenceStatus === 'COMPLETE', dataAuditLabel: null,
          nutritionEstimated: false })),
      ],
    };
  }
}

import { MealType, Prisma, RecipeRiceRole } from '@prisma/client';
import prisma from '@/lib/prisma';
import { loadPlanningNutritionContext } from '@/domain/user-nutrition-context';
import { adaptUserSafetyRestrictions } from '@/domain/structured-restriction.adapter';
import { admittedLibraryBaseIds } from './meal-base-admission.service';
import { isUnrestrictedPanlasangBaseEligible } from '@/domain/unrestricted-panlasang-base.policy';
import { parseRecipeCandidateIngredients } from './panlasang-recipe-candidate.provider';
import { getManilaDateKey, getManilaMidnight } from '@/domain/meal-plan-cycle.policy';

/** Browse-only verified bases. This endpoint never grants planning or case clearance. */
export class VerifiedRecipeCatalogService {
  static async list(userId: string, input: { search?: string; mealType?: MealType; riceRole?: string; page?: number }) {
    const { user, conditions, allergens, otherConditions, otherAllergies } = await loadPlanningNutritionContext(
      prisma,
      userId,
      'User profile not found.'
    );
    const restrictions = adaptUserSafetyRestrictions({
      healthConditions: conditions,
      allergies: allergens,
      otherConditions,
      otherAllergies,
      safetyEntries: user.safetyProfileEntries,
    });
    if (
      restrictions.requiresReview ||
      restrictions.conditions.length ||
      restrictions.allergies.length ||
      restrictions.customConditions.length ||
      restrictions.customFoodRestrictions.length
    ) {
      return { items: [], total: 0, page: 1, pageCount: 0, restrictedProfile: true };
    }

    // Annotate only the current cycle and nearest upcoming cycle. Historical
    // approvals and superseded candidates must not look like scheduled meals.
    const businessDay = getManilaMidnight(getManilaDateKey(new Date()));
    const visibleCycleWhere: Prisma.MealPlanCycleWhereInput = {
      userId,
      supersededAt: null,
      supersededById: null,
      status: { notIn: ['SUPERSEDED', 'COMPLETED'] },
    };
    const [currentCycle, upcomingCycle] = await Promise.all([
      prisma.mealPlanCycle.findFirst({
        where: { ...visibleCycleWhere, startDate: { lte: businessDay }, endDate: { gte: businessDay } },
        orderBy: [{ startDate: 'desc' }, { cycleRevision: 'desc' }],
        select: { id: true },
      }),
      prisma.mealPlanCycle.findFirst({
        where: { ...visibleCycleWhere, startDate: { gt: businessDay } },
        orderBy: [{ startDate: 'asc' }, { cycleRevision: 'desc' }],
        select: { id: true },
      }),
    ]);
    const cycleIds = [currentCycle?.id, upcomingCycle?.id].filter((id): id is string => Boolean(id));
    const userPlanMeals = await prisma.mealPlan.findMany({
      where: {
        userId,
        status: 'APPROVED',
        planGroupId: { in: cycleIds },
        requiresSafetyRevalidation: false,
        supersededByMealPlanId: null,
      },
      orderBy: [{ scheduledDate: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        mealName: true,
        mealType: true,
        calories: true,
        proteinG: true,
        carbsG: true,
        fatG: true,
        scheduledDate: true,
        sourceRawRecipeCandidateId: true,
        libraryMealId: true,
        planGroupId: true,
      },
    });

    const planByRawId = new Map<string, typeof userPlanMeals>();
    const planByLibraryId = new Map<string, typeof userPlanMeals>();

    for (const plan of userPlanMeals) {
      if (plan.sourceRawRecipeCandidateId) {
        const list = planByRawId.get(plan.sourceRawRecipeCandidateId) ?? [];
        list.push(plan);
        planByRawId.set(plan.sourceRawRecipeCandidateId, list);
      }
      if (plan.libraryMealId) {
        const list = planByLibraryId.get(plan.libraryMealId) ?? [];
        list.push(plan);
        planByLibraryId.set(plan.libraryMealId, list);
      }
    }

    // Some published source rows have no MealLibrary serving variant. Querying
    // MealLibrary alone would omit those real recipes from this browse-only view.
    const rawWhere: Prisma.RawRecipeCandidateWhereInput = {
      sourceName: 'PANLASANG_PINOY',
      status: 'AVAILABLE',
      libraryVariants: { none: { status: 'FLAGGED' } },
      ...(input.search ? { recipeName: { contains: input.search, mode: 'insensitive' } } : {}),
      ...(input.mealType ? { applicableMealTypes: { some: { mealType: input.mealType } } } : {}),
      ...(input.riceRole && input.riceRole in RecipeRiceRole ? { riceRole: input.riceRole as RecipeRiceRole } : {}),
    };
    const manual = await prisma.mealLibrary.findMany({
      where: {
        status: 'APPROVED',
        OR: [
          { sourceRawRecipeCandidateId: null },
          { sourceRawRecipeCandidate: { is: { sourceName: { not: 'PANLASANG_PINOY' } } } },
        ],
      },
      select: {
        id: true,
        status: true,
        recipeSignature: true,
        description: true,
        sourceRawRecipeCandidateId: true,
        sourceRawRecipeCandidate: { select: { sourceName: true, status: true, contentSignature: true } },
      },
    });
    const manuallyVerified = await admittedLibraryBaseIds(manual);
    const manualWhere: Prisma.MealLibraryWhereInput = {
      id: { in: [...manuallyVerified] },
      status: 'APPROVED',
      ...(input.search ? { mealName: { contains: input.search, mode: 'insensitive' } } : {}),
      ...(input.mealType ? { applicableMealTypes: { some: { mealType: input.mealType } } } : {}),
      ...(input.riceRole && input.riceRole in RecipeRiceRole ? { riceRole: input.riceRole as RecipeRiceRole } : {}),
    };
    const [rawCount, manualCount] = await Promise.all([
      prisma.rawRecipeCandidate.count({ where: rawWhere }),
      prisma.mealLibrary.count({ where: manualWhere }),
    ]);
    const total = rawCount + manualCount;
    const PAGE_SIZE = 6;
    const pageCount = Math.ceil(total / PAGE_SIZE);
    const page = Math.min(Math.max(1, input.page ?? 1), Math.max(1, pageCount));
    const offset = (page - 1) * PAGE_SIZE;
    const rawTake = Math.max(0, Math.min(PAGE_SIZE, rawCount - offset));
    const rawRows = rawTake
      ? await prisma.rawRecipeCandidate.findMany({
          where: rawWhere,
          orderBy: [{ normalizedName: 'asc' }, { id: 'asc' }],
          skip: offset,
          take: rawTake,
          select: {
            id: true,
            recipeName: true,
            description: true,
            sourceName: true,
            sourceUrl: true,
            sourceImageUrl: true,
            status: true,
            publishedNutrition: true,
            ingredients: true,
            calories: true,
            proteinG: true,
            carbsG: true,
            fatG: true,
            applicableMealTypes: { select: { mealType: true } },
          },
        })
      : [];
    const manualTake = PAGE_SIZE - rawRows.length;
    const manualRows = manualTake
      ? await prisma.mealLibrary.findMany({
          where: manualWhere,
          orderBy: [{ mealName: 'asc' }, { id: 'asc' }],
          skip: Math.max(0, offset - rawCount),
          take: manualTake,
          select: {
            id: true,
            mealName: true,
            description: true,
            calories: true,
            proteinG: true,
            carbsG: true,
            fatG: true,
            safetyEvidenceStatus: true,
            sourceRawRecipeCandidate: { select: { sourceName: true, sourceUrl: true, sourceImageUrl: true } },
            applicableMealTypes: { select: { mealType: true } },
          },
        })
      : [];
    return {
      total,
      page,
      pageCount,
      restrictedProfile: false,
      items: [
        ...rawRows.map((source) => {
          const ingredients = parseRecipeCandidateIngredients(source.ingredients);
          const planningReady = isUnrestrictedPanlasangBaseEligible({
            source,
            candidateId: source.id,
            conditions: [],
            allergens: [],
            preparedIngredients: ingredients.map((item) => ({
              ingredientName: item.name,
              quantity: item.quantity,
              unit: item.unit,
            })),
          });
          const matching = planByRawId.get(source.id) ?? [];
          const inPlan = matching.length > 0;

          return {
            id: `raw:${source.id}`,
            name: source.recipeName,
            description: source.description,
            mealTypes: source.applicableMealTypes.map((item) => item.mealType),
            calories: matching[0]?.calories ?? source.calories,
            proteinG: matching[0]?.proteinG ?? source.proteinG,
            carbsG: matching[0]?.carbsG ?? source.carbsG,
            fatG: matching[0]?.fatG ?? source.fatG,
            sourceName: source.sourceName,
            sourceUrl: source.sourceUrl,
            imageUrl: source.sourceImageUrl,
            planningReady,
            inPlan,
            occurrences: matching.map((m) => ({
              id: m.id,
              scheduledDate: m.scheduledDate.toISOString(),
              cycleScope: m.planGroupId === upcomingCycle?.id ? 'UPCOMING' : 'CURRENT',
            })),
            planMealId: matching[0]?.id ?? null,
          };
        }),
        ...manualRows.map((row) => {
          const matching = planByLibraryId.get(row.id) ?? [];
          const inPlan = matching.length > 0;

          return {
            id: row.id,
            name: row.mealName,
            description: row.description,
            mealTypes: row.applicableMealTypes.map((item) => item.mealType),
            calories: matching[0]?.calories ?? row.calories,
            proteinG: matching[0]?.proteinG ?? row.proteinG,
            carbsG: matching[0]?.carbsG ?? row.carbsG,
            fatG: matching[0]?.fatG ?? row.fatG,
            sourceName: row.sourceRawRecipeCandidate?.sourceName ?? 'ADMIN_OR_GENERATED',
            sourceUrl: row.sourceRawRecipeCandidate?.sourceUrl ?? null,
            imageUrl: row.sourceRawRecipeCandidate?.sourceImageUrl ?? null,
            planningReady: row.safetyEvidenceStatus === 'COMPLETE',
            inPlan,
            occurrences: matching.map((m) => ({
              id: m.id,
              scheduledDate: m.scheduledDate.toISOString(),
              cycleScope: m.planGroupId === upcomingCycle?.id ? 'UPCOMING' : 'CURRENT',
            })),
            planMealId: matching[0]?.id ?? null,
          };
        }),
      ],
    };
  }
}

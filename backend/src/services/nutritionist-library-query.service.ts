import { HealthConditionType, MealLibraryStatus, MealType, Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { libraryBaseRevisionKey } from './meal-base-admission.service';
import { normalizePagination, normalizeSearch } from '@/policies/pagination.policy';

export interface NutritionistLibraryFilters {
  search?: string;
  mealType?: string;
  conditionTag?: string;
  status?: string;
  verifiedByMe?: boolean;
  adminDraftsOnly?: boolean;
  page?: number;
  limit?: number;
}

export function getNutritionistMealLibrary(limit = 50) {
  return prisma.mealLibrary.findMany({
    orderBy: { usageCount: 'desc' },
    take: limit,
    include: { verifiedByNutritionist: { select: { userId: true } } },
  });
}

export async function getNutritionistMealLibraryWithFilters(
  currentUserId: string,
  filters: NutritionistLibraryFilters
) {
  const { page, limit } = normalizePagination(filters.page, filters.limit, 20);
  const skip = (page - 1) * limit;
  const search = normalizeSearch(filters.search);
  // Base-meal flags are visible here; context-specific flags remain inside approvals.
  const where: Prisma.MealLibraryWhereInput = {
    status:
      filters.status === 'FLAGGED'
        ? MealLibraryStatus.FLAGGED
        : filters.status === 'APPROVED'
          ? MealLibraryStatus.APPROVED
          : { in: [MealLibraryStatus.APPROVED, MealLibraryStatus.FLAGGED] },
  };
  const and: Prisma.MealLibraryWhereInput[] = [];

  if (search) where.mealName = { contains: search, mode: 'insensitive' };
  if (filters.mealType && filters.mealType !== 'All') {
    where.applicableMealTypes = { some: { mealType: filters.mealType as MealType } };
  }
  if (filters.conditionTag && filters.conditionTag !== 'All') {
    and.push({
      OR: [
        { suitableConditions: { array_contains: filters.conditionTag } },
        { conditionClearances: { some: { condition: filters.conditionTag as HealthConditionType } } },
      ],
    });
  }
  if (filters.verifiedByMe)
    and.push({
      OR: [
        { verifiedByNutritionist: { userId: currentUserId } },
        { profileApprovals: { some: { reviewerNutritionist: { userId: currentUserId } } } },
        { conditionClearances: { some: { decisions: { some: { nutritionistProfile: { userId: currentUserId } } } } } },
      ],
    });
  if (filters.adminDraftsOnly) {
    where.status = MealLibraryStatus.APPROVED;
    where.safetyEvidenceStatus = 'INCOMPLETE';
    where.safetyReviews = { some: { reasonCode: 'ADMIN_AUTHORED_DRAFT' } };
  }
  if (and.length) where.AND = and;

  // Several reviewed ingredient/serving variants may share one Panlasang
  // source. Show one card for that source; Approvals exposes every variant.
  const keys = await prisma.mealLibrary.findMany({
    where,
    orderBy: [{ addedAt: 'desc' }, { id: 'asc' }],
    select: { id: true, sourceRawRecipeCandidateId: true, recipeFamilyId: true },
  });
  const sourceByRoot = new Map(keys.map((row) => [row.id, row.sourceRawRecipeCandidateId]));
  const seen = new Set<string>();
  const groupedIds = keys.flatMap((row) => {
    const key = row.recipeFamilyId
      ? sourceByRoot.get(row.recipeFamilyId) || row.recipeFamilyId
      : row.sourceRawRecipeCandidateId || row.id;
    if (seen.has(key)) return [];
    seen.add(key);
    return [row.id];
  });
  const total = groupedIds.length;
  const pageIds = groupedIds.slice(skip, skip + limit);
  const pageIdSet = new Set(pageIds);
  const pageSourceIds = keys.flatMap((row) =>
    pageIdSet.has(row.id) && row.sourceRawRecipeCandidateId ? [row.sourceRawRecipeCandidateId] : []
  );
  // The card details, verification records, and preparation events depend only
  // on the page IDs. Read them together to avoid three serial remote round trips.
  const [meals, baseVerifications, preparedEvents] = await Promise.all([
    pageIds.length
      ? prisma.mealLibrary.findMany({
          where: { id: { in: pageIds } },
          include: {
            sourceRawRecipeCandidate: {
              select: {
                sourceName: true,
                sourceUrl: true,
                sourceImageUrl: true,
                contentSignature: true,
                status: true,
              },
            },
            safetyReviews: {
              where: { reasonCode: 'ADMIN_AUTHORED_DRAFT' },
              select: { id: true, reasonCode: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        })
      : Promise.resolve([]),
    pageIds.length
      ? prisma.mealBaseVerification.findMany({
          where: {
            status: 'VERIFIED',
            OR: [
              { targetKind: 'LIBRARY_MEAL', targetId: { in: pageIds } },
              { targetKind: 'RAW_RECIPE', targetId: { in: pageSourceIds } },
            ],
          },
          select: { targetKind: true, targetId: true, revisionKey: true },
        })
      : Promise.resolve([]),
    pageIds.length
      ? prisma.auditEvent.findMany({
          where: {
            action: 'NUTRITION_EVIDENCE_PREPARED',
            entityType: 'MealLibrary',
            entityId: { in: pageIds },
          },
          select: { entityId: true, metadata: true },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
  ]);
  const byId = new Map(meals.map((meal) => [meal.id, meal]));
  const verifiedKeys = new Set(baseVerifications.map((row) => `${row.targetKind}:${row.targetId}:${row.revisionKey}`));
  const orderedMeals = pageIds.flatMap((id) => {
    const meal = byId.get(id);
    return meal ? [meal] : [];
  });

  const preparedRevision = new Map<string, { revision: number; portionBasis: string | null }>();
  for (const event of preparedEvents) {
    const metadata = event.metadata as Record<string, unknown> | null;
    const revision = metadata?.revision;
    if (event.entityId && typeof revision === 'number' && !preparedRevision.has(event.entityId)) {
      preparedRevision.set(event.entityId, {
        revision,
        portionBasis: typeof metadata?.portionBasis === 'string' ? metadata.portionBasis : null,
      });
    }
  }
  return {
    total,
    page,
    limit,
    meals: orderedMeals.map((meal) => {
      const { sourceRawRecipeCandidate: source, ...mealFields } = meal;
      // This label describes whether the base recipe is an established source
      // recipe or has completed independent RND evidence review. It does not
      // assert that a particular serving is ready for automatic planning.
      const panlasangSource = source?.sourceName === 'PANLASANG_PINOY' && source.status === 'AVAILABLE';
      const verifiedBase =
        (!!meal.recipeSignature &&
          verifiedKeys.has(
            `LIBRARY_MEAL:${meal.id}:${libraryBaseRevisionKey(meal.recipeSignature, meal.description)}`
          )) ||
        (source?.status === 'AVAILABLE' &&
          !!meal.sourceRawRecipeCandidateId &&
          verifiedKeys.has(`RAW_RECIPE:${meal.sourceRawRecipeCandidateId}:${source.contentSignature}`));
      const rndCertified =
        meal.safetyEvidenceStatus === 'COMPLETE' &&
        meal.certifiedEvidenceRevision === meal.safetyEvidenceRevision &&
        !!meal.safetyReviewedByNutritionistId;
      return {
        ...mealFields,
        sourceRawRecipeCandidate: source
          ? {
              sourceName: source.sourceName,
              sourceUrl: source.sourceUrl,
              sourceImageUrl: source.sourceImageUrl,
              status: source.status,
            }
          : null,
        baseVerification:
          panlasangSource || verifiedBase || rndCertified ? ('VERIFIED' as const) : ('REVIEW_PENDING' as const),
        baseVerificationBasis: panlasangSource
          ? ('PANLASANG_PINOY' as const)
          : verifiedBase || rndCertified
            ? ('NUTRITIONIST' as const)
            : null,
        preparedNutritionRevision: preparedRevision.get(meal.id)?.revision ?? null,
        preparedNutritionBasis: preparedRevision.get(meal.id)?.portionBasis ?? null,
      };
    }),
  };
}

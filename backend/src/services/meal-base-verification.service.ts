import { assertIndependentRecipeReviewer } from '@/domain/recipe-derivation.policy';
import prisma from '@/lib/prisma';
import { isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';
import { MealVerificationStatus, MealVerificationTargetKind, Prisma } from '@prisma/client';
import { buildMealLibraryRecipeSignature } from '@/domain/meal-library-signature.policy';
import { persistDeterministicLibraryClassification } from './meal-library-publication.service';
import { admittedLibraryBaseIds, libraryBaseRevisionKey } from './meal-base-admission.service';

const CLAIM_MS = 30 * 60 * 1000;

export async function isGeneratedBaseVerified(signature: string | null): Promise<boolean> {
  if (!signature) return false;
  return Boolean(
    await prisma.mealBaseVerification
      .findUnique({
        where: {
          targetKind_targetId_revisionKey: {
            targetKind: 'GENERATED_RECIPE',
            targetId: signature,
            revisionKey: signature,
          },
        },
        select: { status: true },
      })
      .then((row) => row?.status === 'VERIFIED')
  );
}

async function requireReviewer(profileId: string) {
  const profile = await prisma.nutritionistProfile.findUnique({
    where: { id: profileId },
    include: { user: { select: { role: true } } },
  });
  if (!profile || !isNutritionistEligibleForReview(profile, new Date())) {
    throw new Error('A currently verified nutritionist is required.');
  }
}

async function target(kind: MealVerificationTargetKind, id: string) {
  if (kind === 'LIBRARY_MEAL') {
    const meal = await prisma.mealLibrary.findUnique({
      where: { id },
      include: {
        sourceRawRecipeCandidate: { select: { sourceName: true, status: true, contentSignature: true } },
        ingredients: { orderBy: { position: 'asc' } },
      },
    });
    if (
      !meal ||
      meal.status !== 'APPROVED' ||
      !meal.recipeSignature ||
      (await admittedLibraryBaseIds([meal])).has(meal.id)
    ) {
      throw new Error('This recipe is not awaiting general meal verification.');
    }
    return {
      kind,
      id,
      revisionKey: libraryBaseRevisionKey(meal.recipeSignature, meal.description),
      name: meal.mealName,
      description: meal.description,
      mealType: meal.mealType,
      calories: meal.calories,
      proteinG: meal.proteinG,
      carbsG: meal.carbsG,
      fatG: meal.fatG,
      ingredients: meal.ingredients.map((item) => ({
        name: item.ingredientName,
        quantity: item.quantity,
        unit: item.unit,
      })),
      authorId: meal.authoredByNutritionistId,
      imageUrl: meal.adaptedImageUrl,
      evidenceRevision: meal.safetyEvidenceRevision,
      riceRole: meal.riceRole,
      riceMinHalfCups: meal.riceMinHalfCups,
      riceMaxHalfCups: meal.riceMaxHalfCups,
      source:
        meal.derivationKind !== 'ORIGINAL'
          ? meal.derivationKind
          : (meal.sourceRawRecipeCandidate?.sourceName ?? 'ADMIN_OR_GENERATED'),
    };
  }
  if (kind === 'GENERATED_RECIPE') {
    const plan = await prisma.mealPlan.findFirst({
      where: { candidateProvenance: 'AI_FROM_SCRATCH', status: 'PENDING_REVIEW', baseRecipeSignature: id },
      select: {
        mealName: true,
        description: true,
        mealType: true,
        calories: true,
        proteinG: true,
        carbsG: true,
        fatG: true,
        ingredients: { select: { ingredientName: true, quantity: true, unit: true } },
      },
    });
    if (!plan) throw new Error('Generated recipe is no longer awaiting verification.');
    return {
      kind,
      id,
      revisionKey: id,
      name: plan.mealName,
      description: plan.description,
      mealType: plan.mealType,
      calories: plan.calories,
      proteinG: plan.proteinG,
      carbsG: plan.carbsG,
      fatG: plan.fatG,
      ingredients: plan.ingredients.map((item) => ({
        name: item.ingredientName,
        quantity: item.quantity,
        unit: item.unit,
      })),
      source: 'GEMINI_GENERATED',
    };
  }
  const recipe = await prisma.rawRecipeCandidate.findUnique({
    where: { id },
    include: { observedSubmissions: { where: { status: 'ADMITTED_RECIPE' }, select: { id: true }, take: 1 } },
  });
  if (
    !recipe ||
    recipe.status !== 'AVAILABLE' ||
    recipe.sourceName !== 'USER_OBSERVED' ||
    !recipe.observedSubmissions.length
  ) {
    throw new Error('This admitted recipe is no longer available for verification.');
  }
  return {
    kind,
    id,
    revisionKey: recipe.contentSignature,
    name: recipe.recipeName,
    description: recipe.description,
    mealType: recipe.mealType,
    calories: recipe.calories,
    proteinG: recipe.proteinG,
    carbsG: recipe.carbsG,
    fatG: recipe.fatG,
    ingredients: recipe.ingredients,
    source: recipe.sourceName,
  };
}

export class MealBaseVerificationService {
  /** Lightweight badge count without loading each recipe or truncating work beyond the visible queue window. */
  static async count() {
    const [meals, recipes, generatedPlans] = await Promise.all([
      prisma.mealLibrary.findMany({
        where: {
          status: 'APPROVED',
          recipeSignature: { not: null },
          OR: [
            { sourceRawRecipeCandidateId: null },
            { sourceRawRecipeCandidate: { sourceName: { not: 'PANLASANG_PINOY' } } },
          ],
        },
        select: {
          id: true,
          recipeSignature: true,
          description: true,
          sourceRawRecipeCandidateId: true,
          sourceRawRecipeCandidate: { select: { sourceName: true, status: true, contentSignature: true } },
        },
        orderBy: { addedAt: 'desc' },
      }),
      prisma.rawRecipeCandidate.findMany({
        where: {
          status: 'AVAILABLE',
          sourceName: 'USER_OBSERVED',
          observedSubmissions: { some: { status: 'ADMITTED_RECIPE' } },
        },
        select: { id: true, contentSignature: true },
        orderBy: { indexedAt: 'desc' },
      }),
      prisma.mealPlan.findMany({
        where: { candidateProvenance: 'AI_FROM_SCRATCH', status: 'PENDING_REVIEW', baseRecipeSignature: { not: null } },
        select: { baseRecipeSignature: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    const admittedMeals = await admittedLibraryBaseIds(meals);
    const candidates = [
      ...meals
        .filter((meal) => meal.recipeSignature && !admittedMeals.has(meal.id))
        .map((meal) => ({
          targetKind: MealVerificationTargetKind.LIBRARY_MEAL,
          targetId: meal.id,
          revisionKey: libraryBaseRevisionKey(meal.recipeSignature!, meal.description),
        })),
      ...recipes.map((recipe) => ({
        targetKind: MealVerificationTargetKind.RAW_RECIPE,
        targetId: recipe.id,
        revisionKey: recipe.contentSignature,
      })),
      ...[
        ...new Set(generatedPlans.flatMap((plan) => (plan.baseRecipeSignature ? [plan.baseRecipeSignature] : []))),
      ].map((signature) => ({
        targetKind: MealVerificationTargetKind.GENERATED_RECIPE,
        targetId: signature,
        revisionKey: signature,
      })),
    ];
    if (!candidates.length) return 0;
    const libraryIds = meals.map((meal) => meal.id);
    const rawIds = recipes.map((recipe) => recipe.id);
    const generatedIds = generatedPlans.flatMap((plan) => (plan.baseRecipeSignature ? [plan.baseRecipeSignature] : []));
    const decisions = await prisma.mealBaseVerification.findMany({
      where: {
        status: 'VERIFIED',
        OR: [
          { targetKind: 'LIBRARY_MEAL', targetId: { in: libraryIds } },
          { targetKind: 'RAW_RECIPE', targetId: { in: rawIds } },
          { targetKind: 'GENERATED_RECIPE', targetId: { in: generatedIds } },
        ],
      },
      select: { targetKind: true, targetId: true, revisionKey: true },
    });
    const verified = new Set(decisions.map((row) => `${row.targetKind}:${row.targetId}:${row.revisionKey}`));
    return candidates.filter((row) => !verified.has(`${row.targetKind}:${row.targetId}:${row.revisionKey}`)).length;
  }

  static async list(profileId: string) {
    await requireReviewer(profileId);
    const [meals, recipes, generatedPlans] = await Promise.all([
      prisma.mealLibrary.findMany({
        where: {
          status: 'APPROVED',
          recipeSignature: { not: null },
          OR: [
            { sourceRawRecipeCandidateId: null },
            { sourceRawRecipeCandidate: { sourceName: { not: 'PANLASANG_PINOY' } } },
          ],
        },
        select: {
          id: true,
          recipeSignature: true,
          description: true,
          sourceRawRecipeCandidateId: true,
          sourceRawRecipeCandidate: { select: { sourceName: true, status: true, contentSignature: true } },
        },
        orderBy: { addedAt: 'desc' },
        take: 150,
      }),
      prisma.rawRecipeCandidate.findMany({
        where: {
          status: 'AVAILABLE',
          sourceName: 'USER_OBSERVED',
          observedSubmissions: { some: { status: 'ADMITTED_RECIPE' } },
        },
        select: { id: true },
        orderBy: { indexedAt: 'desc' },
        take: 150,
      }),
      prisma.mealPlan.findMany({
        where: { candidateProvenance: 'AI_FROM_SCRATCH', status: 'PENDING_REVIEW', baseRecipeSignature: { not: null } },
        select: { baseRecipeSignature: true },
        orderBy: { createdAt: 'asc' },
        take: 150,
      }),
    ]);
    const admittedMeals = await admittedLibraryBaseIds(meals);
    const generatedSignatures = [
      ...new Set(generatedPlans.flatMap((plan) => (plan.baseRecipeSignature ? [plan.baseRecipeSignature] : []))),
    ];
    const candidates = await Promise.all([
      ...meals
        .filter((row) => row.recipeSignature && !admittedMeals.has(row.id))
        .map((row) => target('LIBRARY_MEAL', row.id)),
      ...recipes.map((row) => target('RAW_RECIPE', row.id)),
      ...generatedSignatures.map((signature) => target('GENERATED_RECIPE', signature)),
    ]);
    const decisions = await prisma.mealBaseVerification.findMany({
      where: {
        OR: candidates.map((row) => ({ targetKind: row.kind, targetId: row.id, revisionKey: row.revisionKey })),
      },
    });
    const byKey = new Map(decisions.map((row) => [`${row.targetKind}:${row.targetId}:${row.revisionKey}`, row]));
    return candidates.flatMap((row) => {
      const record = byKey.get(`${row.kind}:${row.id}:${row.revisionKey}`);
      return record?.status === 'VERIFIED'
        ? []
        : [
            {
              ...row,
              status: record?.status ?? 'PENDING',
              authoredByMe: 'authorId' in row && row.authorId === profileId,
              claimedByMe:
                record?.claimedByNutritionistId === profileId &&
                !!record.claimedAt &&
                record.claimedAt.getTime() > Date.now() - CLAIM_MS,
              claimedByOther:
                !!record?.claimedByNutritionistId &&
                record.claimedByNutritionistId !== profileId &&
                !!record.claimedAt &&
                record.claimedAt.getTime() > Date.now() - CLAIM_MS,
            },
          ];
    });
  }

  static async claim(profileId: string, kind: MealVerificationTargetKind, id: string) {
    await requireReviewer(profileId);
    const row = await target(kind, id);
    if ('authorId' in row) assertIndependentRecipeReviewer(row.authorId, profileId);
    const key = { targetKind_targetId_revisionKey: { targetKind: kind, targetId: id, revisionKey: row.revisionKey } };
    await prisma.mealBaseVerification.upsert({
      where: key,
      create: {
        targetKind: kind,
        targetId: id,
        revisionKey: row.revisionKey,
      },
      update: {},
    });
    const updated = await prisma.mealBaseVerification.updateMany({
      where: {
        targetKind: kind,
        targetId: id,
        revisionKey: row.revisionKey,
        status: { in: [MealVerificationStatus.PENDING, MealVerificationStatus.REJECTED] },
        OR: [
          { claimedByNutritionistId: null },
          { claimedAt: { lt: new Date(Date.now() - CLAIM_MS) } },
          { claimedByNutritionistId: profileId },
        ],
      },
      data: { claimedByNutritionistId: profileId, claimedAt: new Date() },
    });
    if (updated.count !== 1) throw new Error('This recipe is already claimed or verified.');
    return row;
  }

  static async release(profileId: string, kind: MealVerificationTargetKind, id: string) {
    await requireReviewer(profileId);
    const row = await target(kind, id);
    if ('authorId' in row) assertIndependentRecipeReviewer(row.authorId, profileId);
    await prisma.mealBaseVerification.updateMany({
      where: {
        targetKind: kind,
        targetId: id,
        revisionKey: row.revisionKey,
        claimedByNutritionistId: profileId,
      },
      data: { claimedByNutritionistId: null, claimedAt: null },
    });
  }

  static async decide(
    profileId: string,
    kind: MealVerificationTargetKind,
    id: string,
    decision: 'VERIFIED' | 'REJECTED',
    rationale: string
  ) {
    await requireReviewer(profileId);
    const reviewer = await prisma.nutritionistProfile.findUniqueOrThrow({
      where: { id: profileId },
      select: { userId: true },
    });
    if (rationale.trim().length < 10) throw new Error('Record at least 10 characters explaining this decision.');
    const row = await target(kind, id);
    if ('authorId' in row) assertIndependentRecipeReviewer(row.authorId, profileId);
    return prisma.$transaction(
      async (tx) => {
        if (kind === 'LIBRARY_MEAL') {
          const current = await tx.mealLibrary.findUniqueOrThrow({ where: { id } });
          if (
            !current.recipeSignature ||
            current.status !== 'APPROVED' ||
            libraryBaseRevisionKey(current.recipeSignature, current.description) !== row.revisionKey ||
            ('evidenceRevision' in row && current.safetyEvidenceRevision !== row.evidenceRevision)
          ) {
            throw new Error('Recipe changed. Refresh and review the current draft.');
          }
          assertIndependentRecipeReviewer(current.authoredByNutritionistId, profileId);
        }
        const updated = await tx.mealBaseVerification.updateMany({
          where: {
            targetKind: kind,
            targetId: id,
            revisionKey: row.revisionKey,
            status: { in: [MealVerificationStatus.PENDING, MealVerificationStatus.REJECTED] },
            claimedByNutritionistId: profileId,
            claimedAt: { gte: new Date(Date.now() - CLAIM_MS) },
          },
          data: {
            status: decision,
            reviewedByNutritionistId: profileId,
            reviewedAt: new Date(),
            rationale: rationale.trim(),
            claimedByNutritionistId: null,
            claimedAt: null,
          },
        });
        if (updated.count !== 1) throw new Error('Claim expired or recipe changed. Refresh before deciding.');
        if (kind === 'LIBRARY_MEAL' && decision === 'VERIFIED') {
          const meal = await tx.mealLibrary.findUniqueOrThrow({
            where: { id },
            select: { authoredByNutritionistId: true, riceRole: true },
          });
          assertIndependentRecipeReviewer(meal.authoredByNutritionistId, profileId);
          await tx.mealLibrary.update({
            where: { id },
            data: {
              verifiedByNutritionistId: profileId,
              ...(meal.riceRole ? { riceRoleReviewStatus: 'REVIEWED' as const } : {}),
            },
          });
        }
        if (kind === 'GENERATED_RECIPE' && decision === 'REJECTED') {
          await tx.mealPlan.updateMany({
            where: {
              candidateProvenance: 'AI_FROM_SCRATCH',
              baseRecipeSignature: id,
              status: 'PENDING_REVIEW',
            },
            data: { status: 'REJECTED', requiresSafetyRevalidation: true },
          });
        }
        if (kind === 'RAW_RECIPE' && decision === 'VERIFIED') {
          const source = await tx.rawRecipeCandidate.findUniqueOrThrow({ where: { id } });
          if (
            await tx.mealLibrary.findFirst({
              where: { sourceRawRecipeCandidateId: source.id, status: 'FLAGGED' },
              select: { id: true },
            })
          )
            throw new Error('This source recipe is flagged and cannot be republished.');
          const ingredients = Array.isArray(source.ingredients)
            ? source.ingredients.flatMap((value) => {
                if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
                const item = value as Record<string, unknown>;
                return typeof item.name === 'string' &&
                  typeof item.quantity === 'number' &&
                  typeof item.unit === 'string'
                  ? [{ ingredientName: item.name, quantity: item.quantity, unit: item.unit }]
                  : [];
              })
            : [];
          if (
            !ingredients.length ||
            ingredients.length !== (source.ingredients as unknown[]).length ||
            [source.calories, source.proteinG, source.carbsG, source.fatG].some((value) => value === null)
          ) {
            throw new Error(
              'The admitted recipe needs complete ingredients and serving nutrition before library publication.'
            );
          }
          const signature = buildMealLibraryRecipeSignature({
            mealName: source.recipeName,
            mealType: source.mealType,
            calories: source.calories!,
            proteinG: source.proteinG!,
            carbsG: source.carbsG!,
            fatG: source.fatG!,
            ingredients,
          });
          const existing = await tx.mealLibrary.findUnique({
            where: { recipeSignature: signature },
            select: { id: true },
          });
          if (!existing) {
            const created = await tx.mealLibrary.create({
              data: {
                sourceRawRecipeCandidateId: source.id,
                verifiedByNutritionistId: profileId,
                mealName: source.recipeName,
                description: source.description,
                mealType: source.mealType,
                calories: source.calories!,
                proteinG: source.proteinG!,
                carbsG: source.carbsG!,
                fatG: source.fatG!,
                recipeSignature: signature,
                safetyEvidenceRevision: 1,
                suitableConditions: [],
                allergenFree: [],
                dietaryTags: [],
                ingredients: {
                  create: ingredients.map((item, position) => ({
                    ...item,
                    position,
                    dataSource: 'SOURCE_RECIPE' as const,
                  })),
                },
              },
            });
            await persistDeterministicLibraryClassification(tx, created.id);
          }
        }
        await tx.auditEvent.create({
          data: {
            actorUserId: reviewer.userId,
            action: `BASE_MEAL_${decision}`,
            entityType: kind,
            entityId: id,
            metadata: { revisionKey: row.revisionKey, reviewerProfileId: profileId },
          },
        });
        return { ...row, status: decision };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }
}

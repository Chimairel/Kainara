import { isMealWithinSlotCalorieRange } from '@/domain/meal-calorie-allocation.policy';
import { SUPPORTED_MEAL_LIBRARY_SAFETY_POLICY_VERSIONS } from '@/domain/meal-library-safety-evidence.policy';
import { isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';
import prisma from '@/lib/prisma';
import { flagWholeMeal } from './meal-wide-flag.service';
import type { libraryMealEditSchema } from '@/validation/nutritionist.schemas';
import {
  AllergenType,
  DietaryPreference,
  FlagStatus,
  Goal,
  HealthConditionType,
  MealLibrarySafetyEvidenceStatus,
  MealLibrarySafetyReviewOutcome,
  MealLibraryStatus,
  Prisma,
  type MealLibrary,
} from '@prisma/client';
import type { z } from 'zod';
import { suspendMealClearancesForEvidenceChange } from './condition-clearance.service';

import {
  BASE_LIBRARY_COVERAGE_PROFILES,
  COMBINATION_CONDITIONS,
  COMBINATION_CONSTRAINTS,
  COVERAGE_MEAL_TYPES,
  STRUCTURED_COMBINATION_COVERAGE_PROFILES,
} from '@/domain/nutritionist-library-coverage.profiles';
import {
  certifiedLibraryMealInclude,
  isCertifiedLibraryMealCompatible,
  isLibraryMealSafeToQueueForCaseReview,
  isProfileApprovedLibraryMealCompatible,
} from '@/services/meal-library-candidate-query.service';

import { admittedLibraryBaseIds } from './meal-base-admission.service';
import { certifyLibraryMealSafety } from './nutritionist-library-certification.service';
import {
  getNutritionistMealLibrary,
  getNutritionistMealLibraryWithFilters,
  type NutritionistLibraryFilters,
} from './nutritionist-library-query.service';

// HTTP edits require all schema fields; trusted internal edits may retain tags or a null description.
type LibraryMealEditInput = Omit<z.infer<typeof libraryMealEditSchema>, 'description' | 'dietaryTags'> & {
  description?: string | null;
  dietaryTags?: z.infer<typeof libraryMealEditSchema>['dietaryTags'];
} & Partial<
    Pick<
      MealLibrary,
      | 'sodiumMg'
      | 'sugarG'
      | 'fiberG'
      | 'potassiumMg'
      | 'phosphorusMg'
      | 'saturatedFatG'
      | 'nutritionServingDescription'
      | 'suitableConditions'
      | 'allergenFree'
    >
  >;

export class NutritionistLibraryService {
  static async getMealLibrary(limit = 50) {
    return getNutritionistMealLibrary(limit);
  }
  static async checkLibraryMealMutationPermission(
    userId: string,
    userRole: string,
    meal: { verifiedByNutritionistId: string | null; verifiedByNutritionist?: { userId: string } | null } | null
  ): Promise<boolean> {
    if (!meal) return false;

    // Check if user is the original verifier
    if (meal.verifiedByNutritionist?.userId === userId) {
      return true;
    }

    // Check if user is ADMIN and the verifier account is inactive/deactivated/deleted
    if (userRole === 'ADMIN') {
      const verifierProfile = await prisma.nutritionistProfile.findUnique({
        where: { id: meal.verifiedByNutritionistId || '' },
        include: { user: true },
      });

      if (
        !verifierProfile ||
        !verifierProfile.user ||
        verifierProfile.user.role !== 'NUTRITIONIST' ||
        verifierProfile.prcLicenseExpiry < new Date()
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Query MealLibrary with advanced filters, search, and pagination
   */
  static async getMealLibraryWithFilters(currentUserId: string, filters: NutritionistLibraryFilters) {
    return getNutritionistMealLibraryWithFilters(currentUserId, filters);
  }

  /** Separate source availability, automatic reuse, and candidates needing case review. */
  static async getMealLibraryCoverage() {
    const [meals, sourceRecipesWithCoreNutrition] = await Promise.all([
      prisma.mealLibrary.findMany({
        where: {
          status: MealLibraryStatus.APPROVED,
          safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.COMPLETE,
          safetyPolicyVersion: { in: [...SUPPORTED_MEAL_LIBRARY_SAFETY_POLICY_VERSIONS] },
          flags: { none: { status: FlagStatus.PENDING } },
        },
        include: certifiedLibraryMealInclude,
      }),
      prisma.rawRecipeCandidate.count({
        where: {
          sourceName: 'PANLASANG_PINOY',
          status: 'AVAILABLE',
          calories: { gt: 0 },
          proteinG: { not: null },
          carbsG: { not: null },
          fatG: { not: null },
        },
      }),
    ]);
    const countProfile = (definition: {
      dietaryPreference: DietaryPreference;
      conditions: readonly HealthConditionType[];
      allergens: readonly AllergenType[];
      safetyEntries?: readonly {
        domain: string;
        canonicalCode: string | null;
        displayName: string;
        supportState: string;
      }[];
    }) => {
      const profile = {
        dietaryPreference: definition.dietaryPreference,
        goal: Goal.MAINTAIN,
        otherConditions: null,
        otherAllergies: null,
        safetyEntries: definition.safetyEntries,
      };
      const automaticallyReusable = meals.filter(
        (meal) =>
          isCertifiedLibraryMealCompatible(meal, definition.conditions, definition.allergens, profile) ||
          isProfileApprovedLibraryMealCompatible(meal, definition.conditions, definition.allergens, profile)
      );
      const reusableIds = new Set(automaticallyReusable.map((meal) => meal.id));
      const caseReviewCandidates = meals.filter(
        (meal) =>
          !reusableIds.has(meal.id) &&
          isLibraryMealSafeToQueueForCaseReview(meal, definition.conditions, definition.allergens, profile)
      );
      const slotCounts = (entries: typeof meals, dailyCalorieTarget?: number) =>
        Object.fromEntries(
          COVERAGE_MEAL_TYPES.map((mealType) => [
            mealType,
            entries.filter(
              (meal) =>
                meal.applicableMealTypes.some((entry) => entry.mealType === mealType) &&
                (dailyCalorieTarget === undefined ||
                  isMealWithinSlotCalorieRange({ ...meal, mealType, dailyCalorieTarget }))
            ).length,
          ])
        ) as Record<(typeof COVERAGE_MEAL_TYPES)[number], number>;
      const counts = slotCounts(automaticallyReusable);
      const caseReviewCounts = slotCounts(caseReviewCandidates);
      const minimumPerSlot = Math.min(...Object.values(counts));
      const caseReviewMinimumPerSlot = Math.min(...Object.values(caseReviewCounts));
      const servingCoverage = [1400, 1600, 1800, 1900, 2000, 2200, 2400, 2800].map((dailyCalorieTarget) => {
        const counts = slotCounts(automaticallyReusable, dailyCalorieTarget);
        const caseReviewCounts = slotCounts(caseReviewCandidates, dailyCalorieTarget);
        return {
          dailyCalorieTarget,
          counts,
          caseReviewCounts,
          weekReady: Math.min(...Object.values(counts)) >= 7,
        };
      });
      return {
        servingCoverage,
        counts,
        total: automaticallyReusable.length,
        minimumPerSlot,
        weekReady: minimumPerSlot >= 7,
        caseReviewCounts,
        caseReviewTotal: caseReviewCandidates.length,
        caseReviewMinimumPerSlot,
      };
    };

    const profiles = BASE_LIBRARY_COVERAGE_PROFILES.map((definition) => ({
      key: definition.key,
      label: definition.label,
      ...countProfile(definition),
    }));

    const combinationMatrix = COMBINATION_CONDITIONS.map((condition) => ({
      key: condition.key,
      label: condition.label,
      cells: COMBINATION_CONSTRAINTS.map((constraint) => ({
        key: constraint.key,
        label: constraint.label,
        ...countProfile({
          dietaryPreference: constraint.dietaryPreference,
          conditions: [condition.condition],
          allergens: [constraint.allergen],
        }),
      })),
    }));

    const combinationColumns = COMBINATION_CONSTRAINTS.map(({ key, label }) => ({
      key,
      label,
    }));

    const structuredProfiles = STRUCTURED_COMBINATION_COVERAGE_PROFILES.map((definition) => ({
      key: definition.key,
      label: definition.label,
      ...countProfile({
        dietaryPreference: definition.dietaryPreference,
        conditions: [],
        allergens: [],
        safetyEntries: definition.safetyEntries,
      }),
    }));

    return {
      sourceRecipesWithCoreNutrition,
      certifiedMeals: meals.filter(
        (meal) =>
          meal.certifiedEvidenceRevision === meal.safetyEvidenceRevision &&
          meal.safetyReviewedByNutritionist &&
          isNutritionistEligibleForReview(meal.safetyReviewedByNutritionist)
      ).length,
      requiredPerSlot: 7,
      profiles,
      combinationColumns,
      combinationMatrix,
      structuredProfiles,
    };
  }

  /**
   * Get single library meal details
   */
  static async getLibraryMeal(mealId: string) {
    const meal = await prisma.mealLibrary.findUnique({
      where: { id: mealId },
      include: {
        parentMeal: {
          select: {
            id: true,
            mealName: true,
            sourceRawRecipeCandidate: { select: { sourceName: true, sourceUrl: true } },
          },
        },
        sourceRawRecipeCandidate: {
          select: { sourceName: true, sourceUrl: true, sourceImageUrl: true, status: true, contentSignature: true },
        },
        verifiedByNutritionist: {
          include: {
            user: {
              select: { name: true },
            },
          },
        },
        flags: {
          include: {
            flaggedByAdminUser: { select: { name: true } },
            flaggedByNutritionist: {
              include: {
                user: {
                  select: { name: true },
                },
              },
            },
          },
        },
        ingredients: {
          orderBy: { position: 'asc' },
          include: {
            foodItem: {
              select: { id: true, name: true, source: true, calories: true, proteinG: true, carbsG: true, fatG: true },
            },
          },
        },
        applicableMealTypes: { orderBy: { mealType: 'asc' } },
        safetyDeclarations: true,
        safetyReviewedByNutritionist: {
          include: { user: { select: { name: true } } },
        },
        safetyReviews: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            nutritionistProfile: {
              include: { user: { select: { name: true } } },
            },
          },
        },
      },
    });
    if (!meal) return null;
    const [admitted, prepared] = await Promise.all([
      admittedLibraryBaseIds([meal]),
      prisma.auditEvent.findFirst({
        where: { entityType: 'MealLibrary', entityId: mealId, action: 'NUTRITION_EVIDENCE_PREPARED' },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const preparedData = prepared?.metadata as { revision?: number; portionBasis?: string } | null;
    const { sourceRawRecipeCandidate: source, ...fields } = meal;
    return {
      ...fields,
      baseVerification: admitted.has(meal.id) ? 'VERIFIED' : 'REVIEW_PENDING',
      baseVerificationBasis: admitted.has(meal.id)
        ? meal.sourceRawRecipeCandidate?.sourceName === 'PANLASANG_PINOY'
          ? 'PANLASANG_PINOY'
          : 'NUTRITIONIST'
        : null,
      preparedNutritionRevision: preparedData?.revision ?? null,
      preparedNutritionBasis: preparedData?.portionBasis ?? null,

      sourceRawRecipeCandidate: source
        ? {
            sourceName: source.sourceName,
            sourceUrl: source.sourceUrl,
            sourceImageUrl: source.sourceImageUrl,
            status: source.status,
          }
        : null,
    };
  }

  /**
   * Certifies one exact, stable library evidence revision. This is separate
   * from approving the original user's meal plan and is intentionally strict:
   * only linked FNRI ingredients and explicit reviewed declarations qualify.
   */
  static certifyLibraryMealSafety = certifyLibraryMealSafety;

  /**
   * Update meal details in MealLibrary
   */
  static async editLibraryMeal(
    _userId: string,
    _userRole: string,
    _mealId: string,
    _updatedFields: LibraryMealEditInput
  ) {
    throw new Error(
      'Recipe edits must be submitted as a new serving version or adapted meal using Create recipe draft. Existing approvals cannot transfer to changed ingredients.'
    );
  }

  /**
   * Delete verified meal from MealLibrary
   */
  static async deleteLibraryMeal(userId: string, userRole: string, mealId: string) {
    const meal = await prisma.mealLibrary.findUnique({
      where: { id: mealId },
      include: { verifiedByNutritionist: true },
    });

    if (!meal) throw new Error('Meal not found.');

    const hasPermission = await this.checkLibraryMealMutationPermission(userId, userRole, meal);
    if (!hasPermission) {
      throw new Error('Unauthorized: Only the original verifying nutritionist can delete this meal.');
    }

    const now = new Date();
    return prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(741010)`;
        const archived = await tx.mealLibrary.update({
          where: { id: mealId },
          data: {
            status: MealLibraryStatus.ARCHIVED,
            safetyEvidenceStatus:
              meal.safetyEvidenceStatus === MealLibrarySafetyEvidenceStatus.COMPLETE
                ? MealLibrarySafetyEvidenceStatus.STALE
                : meal.safetyEvidenceStatus,
            safetyInvalidatedAt: now,
            safetyInvalidationReason: 'LIBRARY_ARCHIVED',
          },
        });
        await suspendMealClearancesForEvidenceChange(tx, mealId, 'LIBRARY_ARCHIVED');
        await tx.mealLibrarySafetyReview.create({
          data: {
            mealLibraryId: mealId,
            nutritionistProfileId: meal.verifiedByNutritionistId,
            outcome: MealLibrarySafetyReviewOutcome.INVALIDATED,
            evidenceRevision: archived.safetyEvidenceRevision,
            policyVersion: archived.safetyPolicyVersion,
            reasonCode: 'LIBRARY_ARCHIVED',
            evidenceSnapshot: { priorStatus: meal.status, archivedAt: now.toISOString() },
          },
        });
        return archived;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  /**
   * Flag a library meal for re-review
   */
  static async flagLibraryMeal(userId: string, mealId: string, reason: string) {
    const profile = await prisma.nutritionistProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) throw new Error('Nutritionist profile not found.');
    return flagWholeMeal(profile.id, mealId, reason);
  }

  static async resolveLibraryMealFlag(
    userId: string,
    userRole: string,
    mealId: string,
    resolution: 'edit' | 'delete' | 'dismiss',
    _updatedFields?: LibraryMealEditInput
  ) {
    if (resolution === 'delete') return this.deleteLibraryMeal(userId, userRole, mealId);
    throw new Error(
      'Create a new recipe draft for corrections. An uninvolved nutritionist must resolve a whole-meal flag.'
    );
  }
}

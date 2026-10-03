import { conditionAllowsRulesetAutomation, conditionRequiresUserScopedClearance } from '@/domain/assurance-tier.policy';
import { getApprovedMealLibraryWhere } from '@/domain/meal-actionability.policy';
import { resolveRecipeRiceRole } from '@/domain/recipe-rice-role.policy';
import { effectiveRecipeMealTypes } from '@/domain/meal-applicability.policy';
import { mealApprovalSafetyScope } from '@/domain/meal-approval-scope.policy';
import { getMealSlotCalorieRange, isPrimaryMealType } from '@/domain/meal-calorie-allocation.policy';
import { evaluateMealGenerationLibraryCompatibility } from '@/domain/meal-generation-library-compatibility.adapter';
import { classifyMealIngredients } from '@/domain/meal-ingredient-classification.policy';
import type { LibraryCompatibilityCandidate } from '@/domain/meal-library-compatibility.types';
import { evaluateMealLibrarySafetyEvidence } from '@/domain/meal-library-safety-evidence.policy';
import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '@/domain/meal-plan-production-safety.policy';
import { isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';
import {
  adaptUserSafetyRestrictions,
  type StructuredSafetyRestrictionEntry,
} from '@/domain/structured-restriction.adapter';
import prisma from '@/lib/prisma';
import { enforceClearanceCircuitBreakers } from '@/services/condition-clearance.service';
import {
  AllergenType,
  DietaryPreference,
  HealthConditionType,
  MealLibrarySafetyDeclarationType,
  MealLibrarySafetyEvidenceStatus,
  MealType,
  Prisma,
} from '@prisma/client';
import { admittedLibraryBaseIds } from './meal-base-admission.service';

export const certifiedLibraryMealInclude = {
  sourceRawRecipeCandidate: { select: { sourceName: true, status: true, contentSignature: true } },
  applicableMealTypes: { orderBy: { mealType: 'asc' as const } },
  ingredients: {
    orderBy: { position: 'asc' as const },
    include: { foodItem: { select: { name: true, category: true } } },
  },
  safetyDeclarations: true,
  safetyReviewedByNutritionist: {
    include: { user: { select: { role: true, name: true, image: true, isSuspended: true } } },
  },
  verifiedByNutritionist: {
    include: { user: { select: { name: true, image: true } } },
  },
  conditionClearances: {
    where: { state: 'ACTIVE' as const },
    orderBy: { activatedAt: 'desc' as const },
    include: {
      decisions: {
        include: {
          nutritionistProfile: {
            select: {
              isVerified: true,
              prcLicenseExpiry: true,
              user: { select: { isSuspended: true } },
            },
          },
        },
      },
      rulePolicyVersion: { select: { state: true, automationAllowed: true, policyVersion: true } },
    },
  },
  profileApprovals: {
    include: {
      reviewerNutritionist: {
        include: { user: { select: { role: true, isSuspended: true, name: true, image: true } } },
      },
    },
  },
} as const;

export type CertifiedLibraryMeal = Prisma.MealLibraryGetPayload<{ include: typeof certifiedLibraryMealInclude }>;
export type EligibleLibraryMeal = CertifiedLibraryMeal;

export interface EligibleLibraryPage {
  items: EligibleLibraryMeal[];
  nextCursor: string | null;
  total: number;
}

export interface LibraryCandidateProfile {
  userId?: string;
  dietaryPreference: DietaryPreference | string | null;
  /** Accepted for caller compatibility; goals never participate in reusable tags. */
  goal?: string | null;
  otherConditions: string | null;
  otherAllergies: string | null;
  safetyEntries?: readonly StructuredSafetyRestrictionEntry[];
}

export function isCertifiedLibraryMealCompatible(
  meal: LibraryCompatibilityCandidate,
  userConditions: readonly string[],
  userAllergens: readonly string[],
  profile: LibraryCandidateProfile,
  options: { safetyOnly?: boolean } = {}
): boolean {
  if (!meal.recipeSignature || !/^[a-f0-9]{64}$/u.test(meal.recipeSignature)) return false;
  const safety = evaluateMealLibrarySafetyEvidence({
    ...meal,
    reviewerEligible: meal.safetyReviewedByNutritionist
      ? isNutritionistEligibleForReview(meal.safetyReviewedByNutritionist)
      : false,
  });
  if (!safety.complete) return false;

  const restrictions = adaptUserSafetyRestrictions({
    safetyEntries: profile.safetyEntries,
    healthConditions: userConditions,
    allergies: userAllergens,
    otherConditions: profile.otherConditions,
    otherAllergies: profile.otherAllergies,
  });
  const requestedConditions = restrictions.conditions.filter((condition) => condition !== 'NONE');
  // Base recipe verification and allergen-absence evidence do not constitute a
  // nutritionist's approval of this user's allergy case. A scoped approval (or
  // a direct meal-plan review) is required before the recipe is actionable.
  if (restrictions.allergies.length || restrictions.customFoodRestrictions.length) return false;
  const now = new Date();
  const activeClearances = Array.isArray(meal.conditionClearances)
    ? meal.conditionClearances.filter(
        (clearance) =>
          clearance.state === 'ACTIVE' &&
          clearance.recipeSignature === meal.recipeSignature &&
          clearance.evidenceRevision === meal.safetyEvidenceRevision &&
          (!clearance.expiresAt || clearance.expiresAt > now) &&
          (!clearance.userScopeId || clearance.userScopeId === profile.userId) &&
          (!conditionRequiresUserScopedClearance(clearance.condition) || clearance.userScopeId === profile.userId) &&
          (clearance.provenance === 'APPROVED_RULESET'
            ? conditionAllowsRulesetAutomation(clearance.condition) &&
              clearance.rulePolicyVersion?.state === 'ACTIVE' &&
              clearance.rulePolicyVersion?.automationAllowed === true &&
              clearance.rulePolicyVersion?.policyVersion === clearance.policyVersion
            : Array.isArray(clearance.decisions) &&
              clearance.decisions.filter(
                (decision) =>
                  decision.decision === 'APPROVE' && isNutritionistEligibleForReview(decision.nutritionistProfile)
              ).length >= 1)
      )
    : [];
  const clearedConditions = new Set(activeClearances.map((clearance) => String(clearance.condition)));
  const conditionCoverageComplete = requestedConditions.every((condition) => clearedConditions.has(condition));
  const compatibility = evaluateMealGenerationLibraryCompatibility({
    userRestrictions: restrictions.evaluationRestrictions,
    candidate: {
      status: meal.status,
      suitableConditions: [...clearedConditions],
      allergenFree: safety.allergenFree,
      safetyEvidence: {
        ...safety.adapterEvidence,
        conditionRuleMatches: [...clearedConditions],
        conditionDomainReviewed: conditionCoverageComplete,
      },
      ingredients: safety.ingredients,
    },
  });
  if (!compatibility.eligible) return false;

  const tags = Array.isArray(meal.dietaryTags) ? meal.dietaryTags : [];
  return (
    conditionCoverageComplete &&
    (options.safetyOnly || !profile.dietaryPreference || tags.includes(profile.dietaryPreference))
  );
}

/** A reviewed base recipe may be proposed for case review, never used directly. */
export function isLibraryMealSafeToQueueForCaseReview(
  meal: CertifiedLibraryMeal,
  userConditions: readonly string[],
  userAllergens: readonly string[],
  profile: LibraryCandidateProfile
): boolean {
  const restrictions = adaptUserSafetyRestrictions({
    safetyEntries: profile.safetyEntries,
    healthConditions: userConditions,
    allergies: userAllergens,
    otherConditions: profile.otherConditions,
    otherAllergies: profile.otherAllergies,
  });
  if (
    restrictions.requiresReview ||
    restrictions.customConditions.length ||
    restrictions.customFoodRestrictions.length ||
    (!restrictions.conditions.length && !restrictions.allergies.length)
  )
    return false;
  if (
    !isCertifiedLibraryMealCompatible(meal, [], [], {
      ...profile,
      otherConditions: null,
      otherAllergies: null,
      safetyEntries: [],
    })
  )
    return false;
  const safety = evaluateMealLibrarySafetyEvidence({
    ...meal,
    reviewerEligible: meal.safetyReviewedByNutritionist
      ? isNutritionistEligibleForReview(meal.safetyReviewedByNutritionist)
      : false,
  });
  if (!restrictions.allergies.every((allergen) => safety.allergenFree.includes(allergen))) return false;
  const classification = classifyMealIngredients(
    meal.ingredients.flatMap((ingredient) => [
      { name: ingredient.ingredientName, category: ingredient.category },
      ...(ingredient.foodItem?.name ? [{ name: ingredient.foodItem.name, category: ingredient.category }] : []),
    ])
  );
  return (
    classification.status === 'COMPLETE' &&
    !classification.detectedAllergens.some((allergen) => restrictions.allergies.includes(allergen))
  );
}

export function isProfileApprovedLibraryMealCompatible(
  meal: CertifiedLibraryMeal,
  userConditions: readonly string[],
  userAllergens: readonly string[],
  profile: LibraryCandidateProfile
): boolean {
  if (meal.status !== 'APPROVED' || !meal.recipeSignature || !/^[a-f0-9]{64}$/u.test(meal.recipeSignature))
    return false;
  const scope = mealApprovalSafetyScope({
    conditions: userConditions,
    allergens: userAllergens,
    otherConditions: profile.otherConditions,
    otherAllergies: profile.otherAllergies,
    safetyEntries: profile.safetyEntries,
  });
  if (!scope.supported) return false;
  // Condition labels alone do not encode medication, laboratory results or
  // individually reviewed nutrient limits. Those users retain the existing
  // condition-clearance path rather than inheriting another patient's review.
  const restrictions = adaptUserSafetyRestrictions({
    safetyEntries: profile.safetyEntries,
    healthConditions: userConditions,
    allergies: userAllergens,
    otherConditions: profile.otherConditions,
    otherAllergies: profile.otherAllergies,
  });
  if (restrictions.conditions.some((condition) => condition !== 'NONE')) return false;
  if (!meal.ingredients.length) return false;
  const approved = meal.profileApprovals.some(
    (entry) =>
      entry.safetyScopeKey === scope.key &&
      entry.recipeSignature === meal.recipeSignature &&
      entry.evidenceRevision === meal.safetyEvidenceRevision &&
      entry.reviewPolicyVersion === MEAL_PLAN_SAFETY_POLICY_VERSION &&
      !entry.flaggedAt &&
      isNutritionistEligibleForReview(entry.reviewerNutritionist)
  );
  if (!approved) return false;
  const classification = classifyMealIngredients(
    meal.ingredients.flatMap((ingredient) => [
      { name: ingredient.ingredientName, category: ingredient.category },
      ...(ingredient.foodItem?.name ? [{ name: ingredient.foodItem.name, category: ingredient.category }] : []),
    ])
  );
  if (restrictions.allergies.length && classification.status !== 'COMPLETE') return false;
  return !classification.detectedAllergens.some((allergen) => restrictions.allergies.includes(allergen));
}

function positiveValues(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value !== 'NONE'))];
}

export async function queryEligibleLibraryMeals(input: {
  mealType?: MealType;
  dailyCalorieTarget?: number;
  userConditions: readonly string[];
  userAllergens: readonly string[];
  profile: LibraryCandidateProfile;
  excludeIds?: readonly string[];
  search?: string;
  limit?: number;
  skipCalorieFilter?: boolean;
  /** Planning only: include base recipes as pending clinical case candidates. */
  includeUnapprovedCaseCandidates?: boolean;
}): Promise<CertifiedLibraryMeal[]> {
  await enforceClearanceCircuitBreakers();
  const limit = Math.max(1, Math.min(input.limit ?? 80, 120));
  const conditions = positiveValues(input.userConditions);
  const allergens = positiveValues(input.userAllergens);
  const profileScope =
    conditions.length === 0
      ? mealApprovalSafetyScope({
          conditions: input.userConditions,
          allergens: input.userAllergens,
          otherConditions: input.profile.otherConditions,
          otherAllergies: input.profile.otherAllergies,
          safetyEntries: input.profile.safetyEntries,
        })
      : null;
  const and: Prisma.MealLibraryWhereInput[] = [];
  const allergenAnd: Prisma.MealLibraryWhereInput[] = [];

  for (const condition of conditions) {
    and.push({
      conditionClearances: {
        some: {
          condition: condition as HealthConditionType,
          state: 'ACTIVE',
          OR: [{ userScopeId: null }, ...(input.profile.userId ? [{ userScopeId: input.profile.userId }] : [])],
        },
      },
    });
  }
  for (const allergen of allergens) {
    allergenAnd.push(
      {
        safetyDeclarations: {
          some: {
            canonicalKey: allergen,
            declarationType: MealLibrarySafetyDeclarationType.ALLERGEN_REVIEWED_ABSENT,
          },
        },
      },
      {
        safetyDeclarations: {
          none: { canonicalKey: allergen, declarationType: MealLibrarySafetyDeclarationType.ALLERGEN_PRESENT },
        },
      }
    );
  }
  and.push(...allergenAnd);

  const calorieRange =
    !input.skipCalorieFilter && input.mealType && input.dailyCalorieTarget && isPrimaryMealType(input.mealType)
      ? getMealSlotCalorieRange(input.dailyCalorieTarget, input.mealType)
      : null;
  const where: Prisma.MealLibraryWhereInput = {
    ...getApprovedMealLibraryWhere(),
    verifiedByNutritionistId: { not: null },
    recipeSignature: { not: null },
    OR: [
      {
        safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.COMPLETE,
        ...(and.length ? { AND: and } : {}),
      },
      ...(input.includeUnapprovedCaseCandidates && (conditions.length || allergens.length)
        ? [
            {
              safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.COMPLETE,
              ...(allergenAnd.length ? { AND: allergenAnd } : {}),
            },
          ]
        : []),
      ...(profileScope?.supported
        ? [
            {
              profileApprovals: {
                some: { safetyScopeKey: profileScope.key, flaggedAt: null },
              },
            },
          ]
        : []),
    ],
    ...(input.mealType ? { applicableMealTypes: { some: { mealType: input.mealType } } } : {}),
    ...(calorieRange ? { calories: { gte: calorieRange.minimum, lte: calorieRange.maximum } } : {}),
    ...(input.excludeIds?.length ? { id: { notIn: [...input.excludeIds] } } : {}),
    ...(input.search ? { mealName: { contains: input.search, mode: 'insensitive' } } : {}),
    ...(input.profile.dietaryPreference ? { dietaryTags: { array_contains: [input.profile.dietaryPreference] } } : {}),
  };

  const candidates = await prisma.mealLibrary.findMany({
    where,
    include: certifiedLibraryMealInclude,
    orderBy: [{ usageCount: 'asc' }, { addedAt: 'desc' }, { id: 'asc' }],
    take: limit,
  });

  const admitted = await admittedLibraryBaseIds(candidates);

  return candidates.filter(
    (meal) =>
      admitted.has(meal.id) &&
      (!input.mealType ||
        effectiveRecipeMealTypes(
          meal.mealName,
          null,
          meal.applicableMealTypes.map((entry) => entry.mealType)
        ).includes(input.mealType)) &&
      (isCertifiedLibraryMealCompatible(meal, input.userConditions, input.userAllergens, input.profile) ||
        isProfileApprovedLibraryMealCompatible(meal, input.userConditions, input.userAllergens, input.profile) ||
        (input.includeUnapprovedCaseCandidates &&
          isLibraryMealSafeToQueueForCaseReview(meal, input.userConditions, input.userAllergens, input.profile)))
  );
}

function encodeLibraryCursor(meal: Pick<CertifiedLibraryMeal, 'mealName' | 'id'>): string {
  return Buffer.from(JSON.stringify({ mealName: meal.mealName, id: meal.id }), 'utf8').toString('base64url');
}

function decodeLibraryCursor(cursor?: string): { mealName: string; id: string } | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (typeof parsed.mealName !== 'string' || typeof parsed.id !== 'string') throw new Error();
    return { mealName: parsed.mealName, id: parsed.id };
  } catch {
    throw new Error('Invalid library cursor.');
  }
}

function afterLibraryCursor(
  meal: Pick<CertifiedLibraryMeal, 'mealName' | 'id'>,
  cursor: { mealName: string; id: string }
) {
  return meal.mealName > cursor.mealName || (meal.mealName === cursor.mealName && meal.id > cursor.id);
}

/**
 * User-facing eligible catalog query. It scans database rows in bounded chunks
 * so the total is authoritative after the final fail-closed policy evaluation,
 * while memory remains bounded by the chunk plus the requested page.
 */
export async function queryEligibleLibraryPage(input: {
  userId: string;
  mealType?: MealType;
  userConditions: readonly string[];
  userAllergens: readonly string[];
  profile: LibraryCandidateProfile;
  search?: string;
  riceRole?: 'PAIR_WITH_RICE' | 'STANDALONE' | 'INCLUDES_RICE';
  cursor?: string;
  limit?: number;
  /** Browse medically cleared recipes even when they differ from a voluntary diet preference. */
  safetyOnly?: boolean;
  /** Include patient-reviewed recipes with the same recorded safety context. */
  includeProfileApproved?: boolean;
}): Promise<EligibleLibraryPage> {
  await enforceClearanceCircuitBreakers();
  const pageLimit = Math.max(1, Math.min(input.limit ?? 24, 60));
  const requestedCursor = decodeLibraryCursor(input.cursor);
  const conditions = positiveValues(input.userConditions);
  const allergens = positiveValues(input.userAllergens);
  const profileScope = input.includeProfileApproved
    ? mealApprovalSafetyScope({
        conditions: input.userConditions,
        allergens: input.userAllergens,
        otherConditions: input.profile.otherConditions,
        otherAllergies: input.profile.otherAllergies,
        safetyEntries: input.profile.safetyEntries,
      })
    : null;
  const and: Prisma.MealLibraryWhereInput[] = [];
  for (const condition of conditions) {
    and.push({
      conditionClearances: {
        some: {
          condition: condition as HealthConditionType,
          state: 'ACTIVE',
          OR: [{ userScopeId: null }, { userScopeId: input.userId }],
        },
      },
    });
  }
  for (const allergen of allergens) {
    and.push(
      {
        safetyDeclarations: {
          some: { canonicalKey: allergen, declarationType: MealLibrarySafetyDeclarationType.ALLERGEN_REVIEWED_ABSENT },
        },
      },
      {
        safetyDeclarations: {
          none: { canonicalKey: allergen, declarationType: MealLibrarySafetyDeclarationType.ALLERGEN_PRESENT },
        },
      }
    );
  }
  const where: Prisma.MealLibraryWhereInput = {
    ...getApprovedMealLibraryWhere(),
    recipeSignature: { not: null },
    OR: [
      {
        verifiedByNutritionistId: { not: null },
        safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.COMPLETE,
        ...(and.length ? { AND: and } : {}),
      },
      ...(profileScope?.supported && conditions.length === 0
        ? [
            {
              profileApprovals: {
                some: { safetyScopeKey: profileScope.key, flaggedAt: null },
              },
            },
          ]
        : []),
    ],
    ...(input.mealType ? { applicableMealTypes: { some: { mealType: input.mealType } } } : {}),
    ...(input.search ? { mealName: { contains: input.search, mode: 'insensitive' } } : {}),
    ...(!input.safetyOnly && input.profile.dietaryPreference
      ? { dietaryTags: { array_contains: [input.profile.dietaryPreference] } }
      : {}),
  };

  const items: EligibleLibraryMeal[] = [];
  let total = 0;
  let scanCursor: { mealName: string; id: string } | null = null;
  const chunkSize = 100;
  for (;;) {
    const rows: CertifiedLibraryMeal[] = await prisma.mealLibrary.findMany({
      where: {
        ...where,
        ...(scanCursor
          ? {
              AND: [
                {
                  OR: [
                    { mealName: { gt: scanCursor.mealName } },
                    { mealName: scanCursor.mealName, id: { gt: scanCursor.id } },
                  ],
                },
              ],
            }
          : {}),
      },
      include: {
        ...certifiedLibraryMealInclude,
      },
      orderBy: [{ mealName: 'asc' }, { id: 'asc' }],
      take: chunkSize,
    });
    const admitted = await admittedLibraryBaseIds(rows);
    for (const row of rows) {
      if (
        input.mealType &&
        !effectiveRecipeMealTypes(
          row.mealName,
          null,
          row.applicableMealTypes.map((entry) => entry.mealType)
        ).includes(input.mealType)
      )
        continue;
      if (
        !admitted.has(row.id) ||
        (!isCertifiedLibraryMealCompatible(row, input.userConditions, input.userAllergens, input.profile, {
          safetyOnly: input.safetyOnly,
        }) &&
          !(
            input.includeProfileApproved &&
            isProfileApprovedLibraryMealCompatible(row, input.userConditions, input.userAllergens, input.profile)
          ))
      )
        continue;
      if (input.riceRole && resolveRecipeRiceRole(row).riceRole !== input.riceRole) continue;
      total += 1;
      if ((!requestedCursor || afterLibraryCursor(row, requestedCursor)) && items.length < pageLimit + 1) {
        items.push(row);
      }
    }
    if (rows.length < chunkSize) break;
    const last: CertifiedLibraryMeal = rows[rows.length - 1];
    scanCursor = { mealName: last.mealName, id: last.id };
  }

  const hasMore = items.length > pageLimit;
  const page = items.slice(0, pageLimit);
  return {
    items: page,
    nextCursor: hasMore && page.length ? encodeLibraryCursor(page[page.length - 1]) : null,
    total,
  };
}

export function toCanonicalConditions(values: readonly HealthConditionType[]): string[] {
  return positiveValues(values);
}

export function toCanonicalAllergens(values: readonly AllergenType[]): string[] {
  return positiveValues(values);
}

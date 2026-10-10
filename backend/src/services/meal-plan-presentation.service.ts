import { ricePortionLabel } from '@/domain/rice-portion.policy';
import { cookingLinkForMeal, type PublicMealCookingLink } from '@/domain/meal-cooking-link.policy';
import { buildMealExplanation } from '@/domain/meal-explanation.policy';
import { buildPendingMealPlanPreview, type PendingMealPreviewInput } from '@/domain/meal-generation-result.policy';
import {
  toPublicMealImage,
  toPublicRawRecipeImage,
  type MealImageRecord,
  type PublicMealImage,
  type RawRecipeImageRecord,
} from '@/domain/meal-image.policy';

export function toPublicVerifier(
  nutritionist?: {
    prcLicenseNumber: string;
    prcLicenseExpiry: Date;
    specialization: string | null;
    yearsOfExperience: number | null;
    university: string | null;
    bio: string | null;
    officialHeadshot?: string | null;
    user: { name: string; image?: string | null };
  } | null
) {
  if (!nutritionist) return null;
  return {
    name: nutritionist.user.name,
    image: nutritionist.officialHeadshot || nutritionist.user.image || null,
    officialHeadshot: nutritionist.officialHeadshot || null,
    prcLicenseNumber: nutritionist.prcLicenseNumber,
    prcLicenseExpiry: nutritionist.prcLicenseExpiry,
    specialization: nutritionist.specialization,
    yearsOfExperience: nutritionist.yearsOfExperience,
    university: nutritionist.university,
    bio: nutritionist.bio,
  };
}

export const rawRecipeImageSelect = {
  recipeName: true,
  sourceName: true,
  sourceUrl: true,
  sourceImageUrl: true,
  sourceVideoUrl: true,
} as const;

export const mealExplanationIngredientInclude = {
  foodItem: { select: { source: true } },
} as const;

// Decision snapshots stay internal: they may contain private clinical context.
export const mealReviewDecisionInclude = {
  orderBy: { submittedAt: 'desc' },
  take: 1,
  select: {
    decision: true,
    submittedAt: true,
    nutritionistProfileId: true,
    evidenceSnapshot: true,
    nutritionistProfile: { include: { user: { select: { name: true, image: true } } } },
  },
} as const;

interface MealReviewAttributionInput {
  nutritionistId?: string | null;
  nutritionist?: Parameters<typeof toPublicVerifier>[0];
  firstApprovedByNutritionist?: Parameters<typeof toPublicVerifier>[0];
  profileApprovalId?: string | null;
  candidateProvenance?: string | null;
  mealName?: string;
  calories: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  composedServingSignature?: string | null;
  reviewWorkKey?: string | null;
  reviewedAt?: Date | null;
  selectionEvidence: unknown;
  reviewDecisions?: Array<{
    decision: string;
    submittedAt?: Date;
    nutritionistProfileId: string;
    evidenceSnapshot: unknown;
    nutritionistProfile?: Parameters<typeof toPublicVerifier>[0];
  }>;
}

function recordedMemberApproval(
  meal: MealReviewAttributionInput,
  decisions: MealReviewAttributionInput['reviewDecisions']
) {
  const decision = decisions?.[0];
  if (!decision || decision.decision !== 'APPROVE' || decision.nutritionistProfileId !== meal.nutritionistId)
    return null;
  if (
    isUserSwappedMeal(meal.selectionEvidence) &&
    (!decision.submittedAt || !meal.reviewedAt || decision.submittedAt < meal.reviewedAt)
  )
    return null;
  const snapshot = decision.evidenceSnapshot;
  if (!snapshot || typeof snapshot !== 'object') return null;
  // Swaps overwrite a plan row but retain its immutable decisions. An older
  // decision must not confer member-review attribution on the replacement.
  if ('effective' in snapshot && snapshot.effective && typeof snapshot.effective === 'object') {
    const effective = snapshot.effective as Record<string, unknown>;
    for (const key of ['mealName', 'calories', 'proteinG', 'carbsG', 'fatG'] as const) {
      if (!(key in effective) || effective[key] !== meal[key]) return null;
    }
    if ('composedServingSignature' in snapshot && snapshot.composedServingSignature !== meal.composedServingSignature)
      return null;
    return toPublicVerifier(decision.nutritionistProfile);
  }
  if (
    'coalescedFromMealPlanId' in snapshot &&
    'reviewWorkKey' in snapshot &&
    meal.reviewWorkKey &&
    snapshot.reviewWorkKey === meal.reviewWorkKey &&
    !isUserSwappedMeal(meal.selectionEvidence)
  )
    return toPublicVerifier(decision.nutritionistProfile);
  return null;
}

function planImage(
  meal: {
    libraryMeal?: (MealImageRecord & { id: string }) | null;
    sourceRawRecipeCandidate?: RawRecipeImageRecord | null;
    selectionEvidence?: unknown;
  },
  libraryImages?: ReadonlyMap<string, PublicMealImage>
) {
  const rawRecipe = isUserSwappedMeal(meal.selectionEvidence) ? null : meal.sourceRawRecipeCandidate;
  const libraryImage = meal.libraryMeal ? toPublicMealImage(meal.libraryMeal) : null;
  if (libraryImage?.kind === 'EXACT' && (meal.libraryMeal?.imagePublicId || meal.libraryMeal?.adaptedImageUrl))
    return libraryImage;
  return (
    (rawRecipe ? toPublicRawRecipeImage(rawRecipe) : null) ||
    (meal.libraryMeal ? libraryImages?.get(meal.libraryMeal.id) : null) ||
    libraryImage
  );
}

function isUserSwappedMeal(selectionEvidence: unknown): boolean {
  return (
    typeof selectionEvidence === 'object' &&
    selectionEvidence !== null &&
    'source' in selectionEvidence &&
    selectionEvidence.source === 'USER_SWAP' &&
    !('replacementKind' in selectionEvidence && selectionEvidence.replacementKind === 'PANLASANG_SOURCE')
  );
}

function planCookingLink(
  meal: {
    libraryMeal?: (MealImageRecord & { id: string }) | null;
    sourceRawRecipeCandidate?: RawRecipeImageRecord | null;
    selectionEvidence?: unknown;
  },
  libraryCookingLinks?: ReadonlyMap<string, PublicMealCookingLink>
): PublicMealCookingLink | null {
  if (meal.libraryMeal?.derivationKind === 'ADAPTED') return null;
  const rawRecipe = isUserSwappedMeal(meal.selectionEvidence) ? null : meal.sourceRawRecipeCandidate;
  const rawLink = cookingLinkForMeal({ sourceRawRecipeCandidate: rawRecipe });
  if (rawLink?.kind === 'PANLASANG_RECIPE') return rawLink;
  return (
    (meal.libraryMeal ? libraryCookingLinks?.get(meal.libraryMeal.id) : null) ||
    cookingLinkForMeal({ libraryDescription: meal.libraryMeal?.description }) ||
    rawLink ||
    null
  );
}

export function pendingPreviewWithImages<
  T extends PendingMealPreviewInput & {
    libraryMeal?: (MealImageRecord & { id: string }) | null;
    sourceRawRecipeCandidate?: RawRecipeImageRecord | null;
    selectionEvidence?: unknown;
    servingComponents?: Array<{ componentType: string; quantityG: number | null }>;
  },
>(
  rows: readonly T[],
  libraryImages?: ReadonlyMap<string, PublicMealImage>,
  libraryCookingLinks?: ReadonlyMap<string, PublicMealCookingLink>
) {
  return buildPendingMealPlanPreview(
    rows.map((row) => ({
      ...row,
      ricePortion: (() => {
        const rice = row.servingComponents?.find((item) => item.componentType === 'COOKED_RICE');
        return rice?.quantityG ? ricePortionLabel(rice.quantityG) : null;
      })(),
      image: planImage(row, libraryImages),
      cookingLink: planCookingLink(row, libraryCookingLinks),
    }))
  );
}

export function serializeActionableMeal<
  T extends MealReviewAttributionInput & {
    nutritionist?: Parameters<typeof toPublicVerifier>[0] | null;
    firstApprovedByNutritionist?: Parameters<typeof toPublicVerifier>[0] | null;
    libraryMeal?:
      | (MealImageRecord & {
          id: string;
          verifiedByNutritionist?: Parameters<typeof toPublicVerifier>[0] | null;
          safetyReviewedByNutritionist?: Parameters<typeof toPublicVerifier>[0] | null;
        })
      | null;
    selectionEvidence: unknown;
    libraryMealId: string | null;
    sourceRawRecipeCandidate?: RawRecipeImageRecord | null;
    status: string;
    aiConfidenceFlag: string;
    calories: number;
    candidateProvenance?: string | null;
    ingredients: Array<{ dataSource: string; foodItemId: string | null; foodItem?: { source: string } | null }>;
    servingComponents?: Array<{ componentType: string; quantityG: number | null }>;
  },
>(
  meal: T,
  libraryImages?: ReadonlyMap<string, PublicMealImage>,
  libraryCookingLinks?: ReadonlyMap<string, PublicMealCookingLink>
) {
  const rice = meal.servingComponents?.find((component) => component.componentType === 'COOKED_RICE');
  const {
    nutritionist,
    firstApprovedByNutritionist,
    selectionEvidence,
    libraryMeal,
    sourceRawRecipeCandidate,
    reviewDecisions,
    ...publicMeal
  } = meal;
  const memberReviewer = recordedMemberApproval(meal, reviewDecisions);
  const storedReviewer = toPublicVerifier(nutritionist) || toPublicVerifier(firstApprovedByNutritionist);
  const recipeReviewer =
    toPublicVerifier(libraryMeal?.safetyReviewedByNutritionist) ||
    toPublicVerifier(libraryMeal?.verifiedByNutritionist);
  const automaticRecipeSelection = meal.candidateProvenance === 'CERTIFIED_LIBRARY' && !meal.profileApprovalId;
  const verifier =
    memberReviewer || (automaticRecipeSelection ? recipeReviewer || storedReviewer : storedReviewer || recipeReviewer);
  const reviewScope = memberReviewer
    ? ('MEMBER' as const)
    : verifier && recipeReviewer && (automaticRecipeSelection || !storedReviewer)
      ? ('RECIPE' as const)
      : ('RECORDED' as const);
  return {
    ...publicMeal,
    ingredients: meal.ingredients.map(({ foodItem: _foodItem, ...ingredient }) => ingredient),
    ricePortion: rice?.quantityG ? ricePortionLabel(rice.quantityG) : null,
    image: planImage({ libraryMeal, sourceRawRecipeCandidate, selectionEvidence }, libraryImages),
    cookingLink: planCookingLink({ libraryMeal, sourceRawRecipeCandidate, selectionEvidence }, libraryCookingLinks),
    verifier: verifier
      ? {
          ...verifier,
          reviewScope,
        }
      : null,
    explanation: buildMealExplanation({
      libraryMealId: meal.libraryMealId,
      status: meal.status,
      aiConfidenceFlag: meal.aiConfidenceFlag,
      calories: meal.calories,
      verifierName: verifier?.name,
      ingredients: meal.ingredients,
      candidateProvenance: meal.candidateProvenance,
      selectionEvidence,
    }),
  };
}

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

function toPublicVerifier(
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
  T extends {
    nutritionist?: Parameters<typeof toPublicVerifier>[0] | null;
    firstApprovedByNutritionist?: Parameters<typeof toPublicVerifier>[0] | null;
    libraryMeal?:
      | (MealImageRecord & {
          id: string;
          verifiedByNutritionist?: Parameters<typeof toPublicVerifier>[0] | null;
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
    ...publicMeal
  } = meal;
  const verifier =
    toPublicVerifier(nutritionist) ||
    toPublicVerifier(firstApprovedByNutritionist) ||
    toPublicVerifier(libraryMeal?.verifiedByNutritionist);
  return {
    ...publicMeal,
    ingredients: meal.ingredients.map(({ foodItem: _foodItem, ...ingredient }) => ingredient),
    ricePortion: rice?.quantityG ? ricePortionLabel(rice.quantityG) : null,
    image: planImage({ libraryMeal, sourceRawRecipeCandidate, selectionEvidence }, libraryImages),
    cookingLink: planCookingLink({ libraryMeal, sourceRawRecipeCandidate, selectionEvidence }, libraryCookingLinks),
    verifier,
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

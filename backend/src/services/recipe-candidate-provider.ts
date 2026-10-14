import type { DietaryPreference, MealType, RecipeRiceRole, RiceRoleReviewStatus } from '@prisma/client';

export type RecipeCandidateProvenance = 'PANLASANG_PINOY' | 'USER_OBSERVED';

export interface RecipeCandidateProjection {
  id: string;
  providerRecordId: string;
  provenance: RecipeCandidateProvenance;
  displayName: string;
  normalizedName: string;
  category: string | null;
  description: string | null;
  contentSignature: string;
  sourceRevisionKey?: string;
  sourceUrl: string;
  applicableMealTypes: MealType[];
  dietaryTags: DietaryPreference[];
  ingredients: Array<{
    name: string;
    quantity?: number;
    unit?: string;
    foodItemId?: string;
    fnriFoodName?: string;
    fnriMatchMethod?: string;
    fnriMappingVersion?: string;
    compositionFoodName?: string;
  }>;
  ingredientsComplete: boolean;
  reviewFreeBaseEligible?: boolean;
  nutrition: { calories: number; proteinG: number; carbsG: number; fatG: number } | null;
  extendedNutrients?: Partial<import('../domain/review-nutrient-filter.policy').PlateNutrients>;
  nutritionBasis?: 'SOURCE_PUBLISHED' | 'CALCULATED_DEMO';
  estimatedNutrientKeys?: import('../domain/review-nutrient-filter.policy').ReviewNutrient[];
  estimatedExtendedNutrients?: Partial<import('../domain/review-nutrient-filter.policy').PlateNutrients>;
  servingDescription: string | null;
  riceRole: RecipeRiceRole | null;
  riceRoleReviewStatus?: RiceRoleReviewStatus;
  includedRiceG?: number | null;
  imageUrl: string | null;
  videoUrl: string | null;
  state: 'ACTIVE' | 'RETIRED';
}

export interface CandidatePage {
  items: RecipeCandidateProjection[];
  nextCursor: string | null;
}

export interface RecipeCandidateProvider {
  readonly provenance: RecipeCandidateProvenance | 'MIXED_CORPUS';
  list(input: {
    sourceKind?: RecipeCandidateProvenance;
    recentFirst?: boolean;
    mealType?: MealType;
    dietaryPreference?: DietaryPreference;
    search?: string;
    /** Exact identity revalidation for an RND-selected source replacement. */
    candidateId?: string;
    hydrateIngredients?: boolean;
    includeEstimatedNutrients?: boolean;
    calorieMinimum?: number;
    calorieMaximum?: number;
    excludeIds?: readonly string[];
    cursor?: string;
    limit: number;
  }): Promise<CandidatePage>;
}

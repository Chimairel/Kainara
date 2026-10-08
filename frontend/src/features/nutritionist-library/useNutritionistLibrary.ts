import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import api from '@/lib/axios';
import { useEffect, useState } from 'react';

export interface Flag {
  id: string;
  status: 'PENDING' | 'RESOLVED_KEPT' | 'RESOLVED_REMOVED';
  reason: string;
  createdAt: string;
  flaggedByNutritionist: {
    user: {
      name: string;
    };
  } | null;
  flaggedByAdminUser?: { name: string } | null;
}

export interface Verifier {
  id: string;
  userId: string;
  prcLicenseNumber: string;
  prcLicenseExpiry: string;
  specialization?: string;
  yearsOfExperience?: number;
  university?: string;
  bio?: string;
  officialHeadshot?: string | null;
  user: {
    name: string;
    image?: string | null;
  };
}

export interface LibraryMeal {
  reviewLineage?: { state: string; incidentCount: number } | null;
  parentMealId?: string | null;
  recipeFamilyId?: string | null;
  derivationKind?: 'ORIGINAL' | 'SERVING_VERSION' | 'ADAPTED';
  parentMeal?: {
    id: string;
    mealName: string;
    sourceRawRecipeCandidate?: { sourceName: string; sourceUrl: string } | null;
  } | null;
  authoredByNutritionistId?: string | null;
  adaptedImageUrl?: string | null;
  riceMinHalfCups?: number;
  riceMaxHalfCups?: number;
  id: string;
  sourceRawRecipeCandidate?: {
    sourceName: string;
    sourceUrl: string;
    sourceImageUrl: string | null;
    status: string;
  } | null;
  baseVerification: 'VERIFIED' | 'REVIEW_PENDING';
  baseVerificationBasis: 'PANLASANG_PINOY' | 'NUTRITIONIST' | null;
  mealName: string;
  mealType: string;
  applicableMealTypes?: Array<{
    mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
    reviewStatus: 'PROPOSED' | 'REVIEWED';
  }>;
  riceRole?: 'PAIR_WITH_RICE' | 'STANDALONE' | 'INCLUDES_RICE' | null;
  riceRoleReviewStatus?: 'NOT_REVIEWED' | 'PROPOSED' | 'REVIEWED';
  includedRiceG?: number | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sodiumMg?: number | null;
  sugarG?: number | null;
  fiberG?: number | null;
  potassiumMg?: number | null;
  phosphorusMg?: number | null;
  saturatedFatG?: number | null;
  nutritionServingDescription?: string | null;
  description?: string;
  suitableConditions?: string[];
  allergenFree?: string[];
  dietaryTags?: string[];
  usageCount: number;
  status: 'APPROVED' | 'FLAGGED' | 'ARCHIVED';
  safetyEvidenceStatus: 'INCOMPLETE' | 'COMPLETE' | 'STALE';
  safetyEvidenceRevision: number;
  certifiedEvidenceRevision?: number | null;
  safetyPolicyVersion?: string | null;
  preparedNutritionRevision?: number | null;
  preparedNutritionBasis?: string | null;
  nutritionEvidenceSource?: string;
  conditionDeclarationState: 'NOT_REVIEWED' | 'REVIEWED_NONE_DECLARED' | 'REVIEWED_WITH_DECLARATIONS';
  allergenDeclarationState: 'NOT_REVIEWED' | 'REVIEWED_NONE_DECLARED' | 'REVIEWED_WITH_DECLARATIONS';
  crossContactAssessment: 'NOT_ASSESSED' | 'ASSESSED_NO_KNOWN_RISK' | 'RISK_IDENTIFIED';
  safetyInvalidationReason?: string | null;
  safetyReviewedAt?: string | null;
  addedAt: string;
  verifiedByNutritionistId: string | null;
  verifiedByNutritionist?: Verifier;
  flags?: Flag[];
  safetyReviews?: Array<{
    id: string;
    reasonCode: string | null;
    evidenceSnapshot?: { nutritionBasis?: string } | null;
  }>;
  ingredients?: {
    id: string;
    ingredientName: string;
    category?: string | null;
    foodItemId?: string | null;
    dataSource: 'FNRI' | 'USDA_FDC' | 'GEMINI_ESTIMATED' | 'SOURCE_RECIPE';
    position: number;
    quantity?: number | null;
    unit?: string | null;
    foodItem?: {
      id?: string;
      calories?: number;
      proteinG?: number;
      carbsG?: number;
      fatG?: number;
      name: string;
      source: string;
      sourceRecordId?: string | null;
      sourceReferenceUrl?: string | null;
    } | null;
  }[];
  safetyReviewedByNutritionist?: { user: { name: string } } | null;
}

export interface LibraryCoverage {
  sourceRecipesWithCoreNutrition: number;
  certifiedMeals: number;
  requiredPerSlot: number;
  profiles: Array<{
    key: string;
    label: string;
    counts: Record<'BREAKFAST' | 'LUNCH' | 'DINNER', number>;
    total: number;
    servingCoverage?: Array<{
      dailyCalorieTarget: number;
      counts: Record<string, number>;
      caseReviewCounts: Record<string, number>;
      weekReady: boolean;
    }>;
    caseReviewCounts: Record<'BREAKFAST' | 'LUNCH' | 'DINNER', number>;
    caseReviewTotal: number;
    caseReviewMinimumPerSlot: number;
    minimumPerSlot: number;
    weekReady: boolean;
  }>;
  combinationColumns: Array<{ key: string; label: string }>;
  combinationMatrix: Array<{
    key: string;
    label: string;
    cells: Array<{
      key: string;
      label: string;
      counts: Record<'BREAKFAST' | 'LUNCH' | 'DINNER', number>;
      caseReviewCounts: Record<'BREAKFAST' | 'LUNCH' | 'DINNER', number>;
      caseReviewTotal: number;
      caseReviewMinimumPerSlot: number;
      total: number;
      minimumPerSlot: number;
      weekReady: boolean;
    }>;
  }>;
  structuredProfiles: Array<{
    key: string;
    label: string;
    counts: Record<'BREAKFAST' | 'LUNCH' | 'DINNER', number>;
    caseReviewCounts: Record<'BREAKFAST' | 'LUNCH' | 'DINNER', number>;
    caseReviewTotal: number;
    caseReviewMinimumPerSlot: number;
    total: number;
    minimumPerSlot: number;
    weekReady: boolean;
  }>;
}

export const AVAILABLE_CONDITIONS = [
  { label: 'Diabetes reviewed', value: 'DIABETES' },
  { label: 'Hypertension reviewed', value: 'HYPERTENSION' },
  { label: 'Kidney disease reviewed', value: 'KIDNEY_DISEASE' },
  { label: 'Heart condition reviewed', value: 'HEART_CONDITION' },
  { label: 'Pregnancy reviewed', value: 'PREGNANT' },
];

export const AVAILABLE_ALLERGENS = [
  { label: 'Shellfish', value: 'SHELLFISH' },
  { label: 'Nuts', value: 'NUTS' },
  { label: 'Dairy', value: 'DAIRY' },
  { label: 'Gluten', value: 'GLUTEN' },
  { label: 'Eggs', value: 'EGGS' },
];

export const AVAILABLE_DIETS = [
  { label: 'Omnivore', value: 'OMNIVORE' },
  { label: 'Vegetarian', value: 'VEGETARIAN' },
  { label: 'Vegan', value: 'VEGAN' },
  { label: 'Pescatarian', value: 'PESCATARIAN' },
];

type LibraryPageData = { meals: LibraryMeal[]; total: number; limit: number };
const libraryResource = (
  search: string,
  mealType: string,
  conditionTag: string,
  verifiedByMe: boolean,
  adminDraftsOnly: boolean,
  status: string,
  page: number
) =>
  `nutritionist-library:${JSON.stringify([search, mealType, conditionTag, verifiedByMe, adminDraftsOnly, status, page])}`;

export function useNutritionistLibrary(
  loadCoverage = false,
  role: 'nutritionist' | 'admin' = 'nutritionist',
  active = true
) {
  const ownerId = useAuth().user?.userId;
  const [page, setPage] = useState(1);

  // Filter States
  const [searchVal, setSearchVal] = useState('');
  const [search, setSearch] = useState('');
  const [mealType, setMealType] = useState('All');
  const [conditionTag, setConditionTag] = useState('All');
  const [verifiedByMe, setVerifiedByMe] = useState(false);
  const [adminDraftsOnly, setAdminDraftsOnly] = useState(false);
  const [status, setStatus] = useState<'ALL' | 'APPROVED' | 'FLAGGED'>('ALL');

  // Only a changed search resets pagination; the initial timer must not undo Next.
  useEffect(() => {
    if (searchVal === search) return;
    const timer = setTimeout(() => {
      setSearch(searchVal);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchVal, search]);

  const query = useSessionQuery<LibraryPageData>({
    ownerId,
    enabled: active,
    resource: `${role}:${libraryResource(search, mealType, conditionTag, verifiedByMe, adminDraftsOnly, status, page)}`,
    errorMessage: 'The verified meal library could not be loaded. Please try again.',
    fetcher: async () => {
      const response = await api.get(`/${role}/library`, {
        params: {
          search,
          mealType: mealType === 'All' ? undefined : mealType,
          conditionTag: conditionTag === 'All' ? undefined : conditionTag,
          verifiedByMe: verifiedByMe ? 'true' : undefined,
          adminDraftsOnly: adminDraftsOnly ? 'true' : undefined,
          status,
          page,
          limit: 20,
        },
      });
      if (!response.data?.success) throw new Error('The verified meal library could not be loaded. Please try again.');
      return response.data.data;
    },
  });
  const coverageQuery = useSessionQuery<LibraryCoverage>({
    ownerId,
    resource: `${role}-library-coverage-v2`,
    enabled: active && loadCoverage,
    errorMessage: 'Recipe coverage could not be loaded.',
    fetcher: async () => {
      const response = await api.get(role === 'admin' ? '/admin/library/coverage' : '/nutritionist/library-coverage');
      if (!response.data?.success) throw new Error('Recipe coverage could not be loaded.');
      return response.data.data;
    },
  });
  const meals = query.data?.meals ?? [];
  const totalCount = query.data?.total ?? 0;
  const totalPages = query.data ? Math.ceil(query.data.total / query.data.limit) : 1;
  useEffect(() => {
    if (query.data && !query.isLoading) setPage((value) => Math.min(value, Math.max(1, totalPages)));
  }, [query.data, query.isLoading, totalPages]);
  const { isLoading, error: fetchError, refetch: fetchLibrary } = query;
  const { data: coverage, refetch: fetchCoverage } = coverageQuery;

  return {
    meals,
    totalCount,
    page,
    setPage,
    totalPages,
    isLoading,
    fetchError,
    coverage,
    searchVal,
    setSearchVal,
    mealType,
    setMealType,
    conditionTag,
    setConditionTag,
    verifiedByMe,
    setVerifiedByMe,
    adminDraftsOnly,
    setAdminDraftsOnly,
    status,
    setStatus,
    fetchLibrary,
    fetchCoverage,
  };
}

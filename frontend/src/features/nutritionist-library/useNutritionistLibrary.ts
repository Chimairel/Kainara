import React, { useEffect, useState } from 'react';
import api from '@/lib/axios';

export interface Flag {
  id: string;
  reason: string;
  createdAt: string;
  flaggedByNutritionist: {
    user: {
      name: string;
    };
  };
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
  digitalSignature?: string | null;
  user: {
    name: string;
    image?: string | null;
  };
}

export interface LibraryMeal {
  id: string;
  sourceRawRecipeCandidate?: { sourceName: string; sourceUrl: string; sourceImageUrl: string | null; status: string } | null;
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
      name: string;
      source: string;
      sourceRecordId?: string | null;
      sourceReferenceUrl?: string | null;
    } | null;
  }[];
  safetyReviewedByNutritionist?: { user: { name: string } } | null;
}

export interface LibraryCoverage {
  certifiedMeals: number;
  requiredPerSlot: number;
  profiles: Array<{
    key: string;
    label: string;
    counts: Record<'BREAKFAST' | 'LUNCH' | 'DINNER', number>;
    total: number;
    servingCoverage?: Array<{ dailyCalorieTarget: number; counts: Record<string, number>; weekReady: boolean }>;
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
      total: number;
      minimumPerSlot: number;
      weekReady: boolean;
    }>;
  }>;
  structuredProfiles: Array<{
    key: string;
    label: string;
    counts: Record<'BREAKFAST' | 'LUNCH' | 'DINNER', number>;
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

export function useNutritionistLibrary() {
  const [meals, setMeals] = useState<LibraryMeal[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<LibraryCoverage | null>(null);

  // Filter States
  const [searchVal, setSearchVal] = useState('');
  const [search, setSearch] = useState('');
  const [mealType, setMealType] = useState('All');
  const [conditionTag, setConditionTag] = useState('All');
  const [verifiedByMe, setVerifiedByMe] = useState(false);
  const [adminDraftsOnly, setAdminDraftsOnly] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchVal);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchVal]);

  const fetchLibrary = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await api.get('/nutritionist/library', {
        params: {
          search,
          mealType: mealType === 'All' ? undefined : mealType,
          conditionTag: conditionTag === 'All' ? undefined : conditionTag,
          verifiedByMe: verifiedByMe ? 'true' : undefined,
          adminDraftsOnly: adminDraftsOnly ? 'true' : undefined,
          page,
          limit: 20,
        },
      });
      if (res.data?.success) {
        setMeals(res.data.data.meals);
        setTotalCount(res.data.data.total);
        setTotalPages(Math.ceil(res.data.data.total / res.data.data.limit));
      }
    } catch (err) {
      console.error('Failed to fetch library:', err);
      setFetchError('The verified meal library could not be loaded. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCoverage = React.useCallback(async () => {
    try {
      const response = await api.get('/nutritionist/library-coverage');
      if (response.data?.success) setCoverage(response.data.data);
    } catch {
      setCoverage(null);
    }
  }, []);

  useEffect(() => {
    fetchLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, mealType, conditionTag, verifiedByMe, adminDraftsOnly, page]);

  useEffect(() => {
    fetchCoverage();
  }, [fetchCoverage]);

  return {
    meals, totalCount, page, setPage, totalPages, isLoading, fetchError,
    coverage, searchVal, setSearchVal, mealType, setMealType,
    conditionTag, setConditionTag, verifiedByMe, setVerifiedByMe,
    adminDraftsOnly, setAdminDraftsOnly, fetchLibrary, fetchCoverage,
  };
}

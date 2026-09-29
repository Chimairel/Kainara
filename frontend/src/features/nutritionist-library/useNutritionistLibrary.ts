import React, { useEffect, useRef, useState } from 'react';
import api from '@/lib/axios';
import { useAuth } from '@/hooks/useAuth';
import { readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';

export interface Flag {
  id: string;
  status: 'PENDING' | 'RESOLVED_KEPT' | 'RESOLVED_REMOVED';
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

type LibraryPageData = { meals: LibraryMeal[]; total: number; limit: number };
const libraryResource = (search: string, mealType: string, conditionTag: string, verifiedByMe: boolean,
  adminDraftsOnly: boolean, status: string, page: number) =>
  `nutritionist-library:${JSON.stringify([search, mealType, conditionTag, verifiedByMe, adminDraftsOnly, status, page])}`;

export function useNutritionistLibrary(loadCoverage = false) {
  const ownerId = useAuth().user?.userId;
  const firstPage = readSessionResource<LibraryPageData>(ownerId, libraryResource('', 'All', 'All', false, false, 'ALL', 1));
  const [meals, setMeals] = useState<LibraryMeal[]>(firstPage?.meals ?? []);
  const [totalCount, setTotalCount] = useState(firstPage?.total ?? 0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(firstPage ? Math.ceil(firstPage.total / firstPage.limit) : 1);
  const [isLoading, setIsLoading] = useState(!firstPage);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<LibraryCoverage | null>(
    readSessionResource<LibraryCoverage>(ownerId, 'nutritionist-library-coverage')
  );
  const requestSequence = useRef(0);

  // Filter States
  const [searchVal, setSearchVal] = useState('');
  const [search, setSearch] = useState('');
  const [mealType, setMealType] = useState('All');
  const [conditionTag, setConditionTag] = useState('All');
  const [verifiedByMe, setVerifiedByMe] = useState(false);
  const [adminDraftsOnly, setAdminDraftsOnly] = useState(false);
  const [status, setStatus] = useState<'ALL' | 'APPROVED' | 'FLAGGED'>('ALL');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchVal);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchVal]);

  const fetchLibrary = async () => {
    const resource = libraryResource(search, mealType, conditionTag, verifiedByMe, adminDraftsOnly, status, page);
    const cached = readSessionResource<LibraryPageData>(ownerId, resource);
    const request = ++requestSequence.current;
    if (cached) {
      setMeals(cached.meals);
      setTotalCount(cached.total);
      setTotalPages(Math.ceil(cached.total / cached.limit));
    }
    setIsLoading(!cached);
    setFetchError(null);
    try {
      const res = await api.get('/nutritionist/library', {
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
      if (res.data?.success && request === requestSequence.current) {
        setMeals(res.data.data.meals);
        setTotalCount(res.data.data.total);
        setTotalPages(Math.ceil(res.data.data.total / res.data.data.limit));
        writeSessionResource(ownerId, resource, res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch library:', err);
      if (request === requestSequence.current) setFetchError('The verified meal library could not be loaded. Please try again.');
    } finally {
      if (request === requestSequence.current) setIsLoading(false);
    }
  };

  const fetchCoverage = React.useCallback(async () => {
    try {
      const response = await api.get('/nutritionist/library-coverage');
      if (response.data?.success) {
        setCoverage(response.data.data);
        writeSessionResource(ownerId, 'nutritionist-library-coverage', response.data.data);
      }
    } catch {
      if (!readSessionResource<LibraryCoverage>(ownerId, 'nutritionist-library-coverage')) setCoverage(null);
    }
  }, [ownerId]);

  useEffect(() => {
    fetchLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, mealType, conditionTag, verifiedByMe, adminDraftsOnly, status, page]);

  useEffect(() => {
    if (loadCoverage) void fetchCoverage();
  }, [fetchCoverage, loadCoverage]);

  return {
    meals, totalCount, page, setPage, totalPages, isLoading, fetchError,
    coverage, searchVal, setSearchVal, mealType, setMealType,
    conditionTag, setConditionTag, verifiedByMe, setVerifiedByMe,
    adminDraftsOnly, setAdminDraftsOnly, status, setStatus, fetchLibrary, fetchCoverage,
  };
}

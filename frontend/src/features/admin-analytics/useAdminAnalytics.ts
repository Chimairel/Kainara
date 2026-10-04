'use client';
import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import api from '@/lib/axios';

export interface AdminAnalytics {
  generatedAt: string;
  approvedUpcomingMealSlots: number;
  usdaFoodItems: number;
  planningAiOperations30d: number;
  totalUsers: number;
  totalNutritionists: number;
  verifiedNutritionists: number;
  activeMealPlans: number;
  pendingReviews: number;
  libraryCount: number;
  totalMealLogs: number;
  totalFoodItems: number;
  totalAliases: number;
  overdueReviews: number;
  activeReviewClaims: number;
  expiredVerifiedNutritionists: number;
  completeLibraryEvidence: number;
  incompleteLibraryEvidence: number;
  staleLibraryEvidence: number;
  failedGenerationJobs24h: number;
  stuckGenerationJobs: number;
  aiSuccess24h: number;
  aiFailures24h: number;
  adaptationReviews30d: number;
  pendingPlansStartingSoon: number;
  activeConditionClearances: number;
  activeClearancesByCondition: Array<{
    condition: string;
    assuranceTier: string;
    provenance: string;
    count: number;
  }>;
  rawRecipeCandidates: number;
  aiUsageByOperation30d: Array<{ operation: string; purpose: string; status: string; count: number }>;
  planSelectionsByProvenance30d: Array<{ provenance: string; count: number }>;
}

const countKeys = [
  'approvedUpcomingMealSlots',
  'usdaFoodItems',
  'planningAiOperations30d',
  'totalUsers',
  'totalNutritionists',
  'verifiedNutritionists',
  'activeMealPlans',
  'pendingReviews',
  'libraryCount',
  'totalMealLogs',
  'totalFoodItems',
  'totalAliases',
  'overdueReviews',
  'activeReviewClaims',
  'expiredVerifiedNutritionists',
  'completeLibraryEvidence',
  'incompleteLibraryEvidence',
  'staleLibraryEvidence',
  'failedGenerationJobs24h',
  'stuckGenerationJobs',
  'aiSuccess24h',
  'aiFailures24h',
  'adaptationReviews30d',
  'pendingPlansStartingSoon',
  'activeConditionClearances',
  'rawRecipeCandidates',
] as const;

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}
const validCount = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** An absent metric is unavailable, never an invented zero. Old caches are not accepted. */
export function normalizeAdminAnalytics(value: unknown): AdminAnalytics | null {
  const record = objectValue(value);
  if (!record || typeof record.generatedAt !== 'string' || !Number.isFinite(Date.parse(record.generatedAt)))
    return null;
  if (countKeys.some((key) => !validCount(record[key]))) return null;
  const groups = {
    activeClearancesByCondition: ['condition', 'assuranceTier', 'provenance'],
    aiUsageByOperation30d: ['operation', 'purpose', 'status'],
    planSelectionsByProvenance30d: ['provenance'],
  };
  const normalized = { ...record };
  for (const [key, fields] of Object.entries(groups)) {
    if (!Array.isArray(record[key])) return null;
    const rows = record[key].map((item: unknown) => {
      const row = objectValue(item);
      return row
        ? { ...row, ...(key === 'aiUsageByOperation30d' && row.purpose === null ? { purpose: 'UNSPECIFIED' } : {}) }
        : null;
    });
    if (
      rows.some(
        (row: Record<string, unknown> | null) =>
          !row || !validCount(row.count) || fields.some((field) => typeof row[field] !== 'string' || !row[field])
      )
    )
      return null;
    normalized[key] = rows;
  }
  return normalized as unknown as AdminAnalytics;
}

export function useAdminAnalytics(active = true) {
  const ownerId = useAuth().user?.userId;
  return useSessionQuery<AdminAnalytics>({
    ownerId,
    resource: 'admin-analytics-v3',
    enabled: active,
    errorMessage: 'Platform statistics could not be refreshed. Please try again.',
    fetcher: async () => {
      const response = await api.get('/admin/analytics');
      const next = response.data?.success ? normalizeAdminAnalytics(response.data.data) : null;
      if (!next) throw new Error('Platform statistics are incomplete. Please reload or try again later.');
      return next;
    },
  });
}

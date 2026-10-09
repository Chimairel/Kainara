import type { NutritionReport } from '@/types';

import { type GuidanceProfileSnapshot } from '@/features/reports/NutritionGuidancePaper';
import type { ReviewRouting } from '@/features/nutritionist-reviews/review-routing';
export type Person = {
  routing?: ReviewRouting;
  userId: string;
  name: string;
  conditions: string[];
  allergies: string[];
  profileStatus: string | null;
  documentCount: number;
  documentIds: string[];
};
export type Report = {
  id: string;
  version: number;
  generatedAt: string;
  acknowledgedAt: string | null;
  profileRevision: number;
  profileSnapshot: unknown;
  content: NutritionReport;
  isCurrent: boolean;
  isPlanningReport?: boolean;
};
export type DocumentItem = {
  id: string;
  area: string;
  documentType: string;
  status: string;
  originalFileName: string;
  mimeType: string;
  createdAt: string;
  pending: boolean;
  latestReview: { decision: string; rationale: string } | null;
};
export type ProfileReview = {
  conditionReviewEntries?: Array<{
    id: string;
    displayName: string;
    supportState: string;
    canAssessNoAdditionalRestrictions: boolean;
    assessment: { result: string; rationale: string; reviewerName: string; assessedAt: string } | null;
  }>;
  clarificationEntryIds?: string[];
  profileRevision: number;
  scopeKey: string;
  claim?: { active: boolean; mine: boolean; expiresAt: string | null };
  healthDetails?: Array<{ area: string; responses: Record<string, unknown> }>;
  needsClarification: boolean;
  previousReview: { notes: string | null } | null;
  requirements: Array<{ area: string; state: string; message: string }>;
  availableAreas: string[];
};
export type ConditionAssessmentDraft = {
  entryId: string;
  rationale: string;
  reviewedDietaryAndTreatmentEffects: boolean;
  reviewedFoodborneIllnessRisk: boolean;
};
export type PersonDetail = {
  userId: string;
  name: string;
  profileStatus: string | null;
  activePlanningReportVersion?: number | null;
  currentProfile: {
    revision: number | null;
    age: number | null;
    goal: string | null;
    dailyCalorieTarget: number | null;
    conditions: string[];
    allergies: string[];
  };
  profileReview: ProfileReview | null;
  reports: Report[];
  documents: DocumentItem[];
  requirements: Array<{ area: string; state: string; message: string }>;
  availableAreas: string[];
};
export type DocumentDetail = {
  id: string;
  area: string;
  originalFileName: string;
  mimeType: string;
  facts: Array<{
    id: string;
    code: string;
    valueText: string | null;
    valueNumber: number | null;
    unit: string | null;
    reviewStatus: string;
  }>;
  user: { contexts: Array<{ area: string; responses: Record<string, unknown> }> };
};
export const factCodes: Record<string, string[]> = {
  KIDNEY_DISEASE: ['CKD_STAGE', 'EGFR'],
  HEART_CONDITION: ['HEART_DIAGNOSIS'],
  DIABETES: ['DIABETES_MEDICATION'],
};
export function savedProfile(report: Report, name: string): GuidanceProfileSnapshot {
  const root =
    report.profileSnapshot && typeof report.profileSnapshot === 'object' && !Array.isArray(report.profileSnapshot)
      ? (report.profileSnapshot as Record<string, unknown>)
      : {};
  const profile =
    root.profile && typeof root.profile === 'object' && !Array.isArray(root.profile)
      ? (root.profile as Record<string, unknown>)
      : {};
  const strings = (value: unknown) =>
    typeof value === 'string' && value.trim()
      ? [value.trim()]
      : Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string' && item !== 'NONE')
        : [];
  return {
    name,
    goal: typeof profile.goal === 'string' ? profile.goal : 'Not recorded',
    dailyCalorieTarget: typeof profile.dailyCalorieTarget === 'number' ? profile.dailyCalorieTarget : null,
    conditions: [...strings(root.conditions), ...strings(root.otherConditions)],
    foodRestrictions: [...strings(root.allergens), ...strings(root.otherAllergies)],
  };
}

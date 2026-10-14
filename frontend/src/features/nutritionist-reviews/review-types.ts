import type { IngredientEvidenceSource } from './ingredient-evidence';
import type { ReviewRouting } from './review-routing';
import type { ClarificationWorkspace } from '@/features/clinical-clarification/types';
import type { ReviewPollStatus } from '@/types/review-status';
import type { PublicMealImage } from '@/types';

export interface QueueItem {
  routing?: ReviewRouting;
  id: string;
  mealName: string;
  mealType: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  aiConfidenceFlag: string;
  requiresSafetyRevalidation?: boolean;
  description?: string;
  scheduledDate: string;
  user: { id: string; name: string };
  ingredients: { ingredientName: string; dataSource: string }[];
  claimStatus: {
    claimedByMe: boolean;
    claimedByOther: boolean;
    claimedByName: string | null;
    coolingDownForMe?: boolean;
    cooldownUntil?: string | null;
    claimExpiresAt?: string | null;
  };
  highRiskReviewRequired: boolean;
  reviewApprovalCount: number;
  requiresIndependentSecondReview: boolean;
  intendedCycle: { id: string; startDate: string; endDate: string; status: string };
  shoppingDeadlineAt: string;
  cookDeadlineAt: string;
  assuranceTier: 'BASE' | 'STANDARD' | 'ENHANCED';
  reviewStage: 'PRIMARY' | 'SECONDARY';
  remainingReviewers: number;
  deterministicFindings: { confidence: string; estimatedIngredientCount: number };
  sourceProvenance: 'CERTIFIED_LIBRARY' | 'RAW_RECIPE_CORPUS' | 'AI_FROM_SCRATCH';
  fallbackAvailable: boolean;
  rankingReasonCodes: string[];
  deadlinePriorityReason: string;
  coalescedDependentCount: number;
}

export interface DetailData {
  flagConcerns?: Array<import('./ConcernResolution').ReviewConcern & { kind: 'RECIPE' | 'PROFILE' | 'CONDITION' | 'CASE'; mealLibraryId: string | null; approvalId?: string; active: boolean; resolution?: string; expectedVersion?: string }>;
  pollStatus?: ReviewPollStatus;
  reviewReferences?: Array<{
    reviewedAt: string;
    reviewerName: string | null;
    decision: 'APPROVE';
    plateFacts: { calories: number; proteinG: number; carbsG: number; fatG: number } | null;
    match: string;
    use: string;
  }>;
  clarifications?: ClarificationWorkspace;
  reviewContext?: { contextKey: string; profileRevision: number; scopeKey: string };
  clinicalEvidence?: {
    policyVersion: string;
    healthDetails?: Array<{ area: string; responses: Record<string, unknown>; revision: number }>;
    requirements: Array<{ area: string; state: string; message: string }>;
    documents: Array<{
      id: string;
      area: string;
      documentType: string;
      validUntil: string | null;
      facts: Array<{ code: string; valueText: string | null; valueNumber: number | null; unit: string | null }>;
    }>;
  };
  mealPlan: {
    image?: PublicMealImage | null;
    id: string;
    planGroupId: string;
    userId: string;
    status: string;
    mealType: string;
    mealName: string;
    description?: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    aiConfidenceFlag: string;
    requiresSafetyRevalidation?: boolean;
    planType: string;
    scheduledDate: string;
    createdAt: string;
  };
  user: {
    name: string;
    age: number;
    sex: string;
    goal: string;
    dailyCalorieTarget: number;
    dietaryPreference: string;
    ricePreference: string;
    conditions: string[];
    allergies: string[];
    conditionsRecorded?: boolean;
    allergiesRecorded?: boolean;
    safetyEntries?: Array<{
      mealPlanningAssessment?: { result: string; rationale: string; reviewerName: string } | null;
      domain: 'CONDITION' | 'ALLERGY' | 'INTOLERANCE' | 'AVOIDED_INGREDIENT' | 'UNKNOWN';
      label: string;
      supportState: string;
    }>;
  };
  ingredients: {
    name: string;
    source: IngredientEvidenceSource;
    foodItemId?: string | null;
    compositionFoodName?: string | null;
    compositionSource?: string | null;
    compositionSourceUrl?: string | null;
    quantity?: number | null;
    unit?: string | null;
  }[];
  warnings: {
    severity: 'CRITICAL' | 'IMPORTANT' | 'NOTICE';
    message: string;
  }[];
  claimStatus: {
    claimedByMe: boolean;
    claimedByOther: boolean;
    claimedByName: string | null;
    coolingDownForMe?: boolean;
    cooldownUntil?: string | null;
    claimExpiresAt?: string | null;
  };
  highRiskReviewRequired: boolean;
  reviewApprovalCount: number;
  requiresIndependentSecondReview: boolean;
}

export interface ReviewPayload {
  canvasReference?: { condition: string; search: string; page: number; expandedId: string | null };
  canvasLayout?: import('./ReviewCanvas').ReviewCanvasLayout;
  expectedContextKey?: string;
  action: 'approve';
  note?: string;
}

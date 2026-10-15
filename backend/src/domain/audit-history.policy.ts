/** Completed approval decisions, used by the meal-scoped Audit presentation. */
export const mealApprovalAuditActions = [
  'MEAL_APPROVAL_REUSED',
  'MEAL_PLAN_APPROVED',
  'MEAL_PLAN_FIRST_HIGH_RISK_APPROVAL',
  'MEAL_PLAN_SECOND_HIGH_RISK_APPROVAL',
  'COALESCED_MEAL_REVIEW_PUBLISHED',
  'MEAL_APPROVAL_RECHECKED',
  'CONDITION_CLEARANCE_ACTIVE',
] as const;

export const nutritionistAuditActions = [
  'MEAL_REVIEW_REJECTED', 'MEAL_REVIEW_CLAIM_RELEASED',
  'FLAG_DRAFT_STARTED', 'FLAG_DRAFT_CANCELLED', 'FLAG_DRAFT_EXPIRED', 'FLAG_DRAFT_SUBMITTED',
  'MEAL_PLAN_SLOT_REPLACED_PENDING_REVIEW',
  'CLINICAL_PROFILE_CLAIMED',
  'BASE_MEAL_VERIFIED',
  'BASE_MEAL_REJECTED',
  'MEAL_LIBRARY_FLAGGED',
  'MEAL_BASE_FLAG_RELEASED',
  'MEAL_PLAN_FIRST_HIGH_RISK_APPROVAL',
  'MEAL_PLAN_SECOND_HIGH_RISK_APPROVAL',
  'MEAL_PLAN_APPROVED',
  'MEAL_PLAN_REJECTED',
  'MEAL_PLAN_REVIEW_DISPUTED',
  'MEAL_PLAN_DISPUTE_RESOLVED',
  'MEAL_PLAN_REVIEW_CLAIM_RELEASED',
  'MEAL_APPROVAL_FLAGGED',
  'MEAL_CASE_FLAG_RESOLVED',
  'MEAL_APPROVAL_RECHECKED',
  'CLINICAL_PROFILE_REVIEWED',
  'CLINICAL_CLARIFICATION_PUBLISHED',
  'CLINICAL_CLARIFICATION_RESOLVED',
  'CLINICAL_PROFILE_CORRECTION_PROPOSED',
  'CLINICAL_DOCUMENT_ACCESSED',
  'CLINICAL_DOCUMENT_SUFFICIENT_FOR_NUTRITION_REVIEW',
  'CLINICAL_DOCUMENT_NEEDS_CLARIFICATION',
  'CLINICAL_DOCUMENT_UNUSABLE',
  'CONDITION_CLEARANCE_ACTIVE',
  'CONDITION_CLEARANCE_REVIEW_DUE',
  'CONDITION_CLEARANCE_REVOKED',
  'CONDITION_CLEARANCE_EXPIRED',
  'CONDITION_CLEARANCE_DISPUTED',
  'CONDITION_CLEARANCE_DISPUTE_RESOLVED',
  'CONDITION_CLEARANCE_SUSPENDED',
  'CONDITION_RULESET_SUSPENDED',
  'NUTRITION_EVIDENCE_PREPARED',
  'COALESCED_MEAL_REVIEW_PUBLISHED',
  'OUTSIDE_MEAL_VERIFY',
  'OUTSIDE_MEAL_CORRECT',
  'OUTSIDE_MEAL_NEEDS_MORE_INFO',
  'OUTSIDE_MEAL_UNVERIFIABLE',
  'OBSERVED_MEAL_ADMITTED',
] as const;

export function auditActionLabel(action: string) {
  const labels: Record<string, string> = {
    MEAL_REVIEW_REJECTED: 'Kept a flagged recipe withheld',
    MEAL_REVIEW_CLAIM_RELEASED: 'Released a recipe review claim',
    FLAG_DRAFT_STARTED: 'Started a flag draft',
    FLAG_DRAFT_CANCELLED: 'Cancelled a flag draft',
    FLAG_DRAFT_EXPIRED: 'Flag draft lock expired',
    FLAG_DRAFT_SUBMITTED: 'Submitted a flag draft',
    MEAL_APPROVAL_REUSED: 'Reused a matching approval',
    MEAL_APPROVAL_REUSE_INVALIDATED: 'Matching approval needs a fresh review',
    BASE_MEAL_VERIFIED: 'Verified a meal',
    MEAL_REVIEW_CLAIMED: 'Claimed a meal re-review',
    MEAL_REVIEW_FLAGGED: 'Flagged an entire meal',
    MEAL_REVIEW_WITHHELD: 'Withheld a meal',
    MEAL_REVIEW_CONFIRMED: 'Resolved meal concerns',
    MEAL_REVIEW_REVERIFIED: 'Re-verified a meal',
    OUTSIDE_MEAL_VERIFY: 'Confirmed outside food',
    OUTSIDE_MEAL_CORRECT: 'Corrected outside food',
    OUTSIDE_MEAL_NEEDS_MORE_INFO: 'Requested food details',
    OUTSIDE_MEAL_UNVERIFIABLE: 'Could not confirm outside food',
    OBSERVED_MEAL_ADMITTED: 'Admitted a food reference',
    BASE_MEAL_REJECTED: 'Rejected meal verification',
    MEAL_BASE_FLAGGED: 'Flagged an entire meal',
    MEAL_LIBRARY_FLAGGED: 'Flagged an entire meal',
    USER_SUSPENDED: 'Suspended an account',
    USER_REINSTATED: 'Reinstated an account',
    ADMIN_MEAL_DRAFT_CREATED: 'Created a meal draft',
    ADMIN_MEAL_DRAFT_UPDATED: 'Updated a meal draft',
    ADMIN_MEAL_BATCH_IMPORTED: 'Imported meals',
    SYNTHETIC_DEV_ACCOUNT_CREATED: 'Created a test account',
    NUTRITIONIST_ACCESS_REVOKED: 'Revoked nutritionist access',
    NUTRITIONIST_VERIFIED: 'Verified nutritionist credentials',
    WEBSITE_MEDIA_DRAFT_UPDATED: 'Saved website media draft',
    WEBSITE_MEDIA_DRAFT_SELECTED: 'Selected saved website media',
    WEBSITE_MEDIA_PUBLISHED: 'Published website media',
    WEBSITE_MEDIA_RESET: 'Restored original website media',
    CLINICAL_PROFILE_CLAIMED: 'Claimed a health profile',
    MEAL_BASE_FLAG_RELEASED: 'Released a meal flag',
    MEAL_PLAN_FIRST_HIGH_RISK_APPROVAL: 'Recorded first case decision',
    MEAL_PLAN_SECOND_HIGH_RISK_APPROVAL: 'Recorded independent second decision',
    MEAL_PLAN_APPROVED: 'Approved a case',
    MEAL_PLAN_SLOT_REPLACED_PENDING_REVIEW: 'Replaced a meal for review',
    MEAL_PLAN_SLOT_CERTIFIED_FALLBACK_SELECTED: 'Selected a certified meal replacement',
    MEAL_PLAN_REJECTED: 'Rejected a case',
    MEAL_REVIEW_REQUEST_WITHDRAWN: 'Withdrew an outdated meal review request',
    MEAL_PLAN_REVIEW_DISPUTED: 'Disputed a case',
    MEAL_PLAN_DISPUTE_RESOLVED: 'Resolved a dispute',
    MEAL_APPROVAL_FLAGGED: 'Flagged an approval',
    MEAL_APPROVAL_RECHECKED: 'Rechecked an approval',
    MEAL_CASE_FLAG_RESOLVED: 'Resolved an approval concern',
    CLINICAL_PROFILE_REVIEWED: 'Reviewed a health profile',
    CLINICAL_CLARIFICATION_PUBLISHED: 'Sent profile clarification questions',
    CLINICAL_CLARIFICATION_RESOLVED: 'Resolved profile clarification',
    CLINICAL_PROFILE_CORRECTION_PROPOSED: 'Proposed a profile correction',
    CLINICAL_PROFILE_CORRECTION_ACCEPTED: 'Acknowledged a profile correction',
    CLINICAL_PROFILE_CORRECTION_REQUESTED: 'Requested a revised profile correction',
    CONDITION_PLANNING_ASSESSMENT_INVALIDATED: 'Condition assessment needs a fresh review',
    CLINICAL_DOCUMENT_ACCESSED: 'Opened a claimed clinical document',
    CLINICAL_DOCUMENT_SUFFICIENT_FOR_NUTRITION_REVIEW: 'Accepted a clinical document',
    CLINICAL_DOCUMENT_NEEDS_CLARIFICATION: 'Requested document clarification',
    CLINICAL_DOCUMENT_UNUSABLE: 'Marked a clinical document unusable',
    CONDITION_CLEARANCE_ACTIVE: 'Activated a condition clearance',
    CONDITION_CLEARANCE_REVIEW_DUE: 'Set a clearance for recheck',
    CONDITION_CLEARANCE_DISPUTED: 'Disputed a condition clearance',
    CONDITION_CLEARANCE_DISPUTE_RESOLVED: 'Resolved a clearance dispute',
    CONDITION_CLEARANCE_SUSPENDED: 'Suspended a clearance',
    CONDITION_RULESET_SUSPENDED: 'Suspended a condition ruleset',
    NUTRITION_EVIDENCE_PREPARED: 'Prepared nutrition evidence',
    COALESCED_MEAL_REVIEW_PUBLISHED: 'Published a shared meal review',
  };
  const words = action.replace(/_/g, ' ').toLowerCase();
  return labels[action] ?? words.charAt(0).toUpperCase() + words.slice(1);
}

export function auditOutcomeLabel(action: string) {
  if (action === 'FLAG_DRAFT_STARTED') return 'Drafting';
  if (action === 'FLAG_DRAFT_CANCELLED' || action === 'FLAG_DRAFT_EXPIRED') return 'Released';
  if (action === 'MEAL_APPROVAL_REUSE_INVALIDATED') return 'Needs attention';
  if (/REJECTED|UNUSABLE|SUSPENDED|FLAGGED|DISPUTED|UNVERIFIABLE|REVOKED|REVIEW_DUE|EXPIRED/.test(action))
    return 'Needs attention';
  if (/ACCESSED|CLAIM_RELEASED/.test(action)) return 'Recorded';
  if (action === 'MEAL_REVIEW_CLAIMED') return 'In review';
  if (/NEEDS_CLARIFICATION|NEEDS_MORE_INFO|CLARIFICATION_PUBLISHED/.test(action)) return 'Waiting for information';
  return 'Completed';
}

/** Summary only; this label never grants access to clinical case details. */
export function auditTypeLabel(action: string, targetType: string) {
  if (action.startsWith('FLAG_DRAFT_')) return 'Flag draft';
  if (targetType === 'MealPlanReviewDecision' || action === 'MEAL_CASE_FLAG_RESOLVED') return 'Meal approval';
  if (action.startsWith('CLINICAL_PROFILE_') || targetType === 'ClinicalProfileReview') return 'Profile verification';
  if (action.startsWith('CLINICAL_CLARIFICATION_')) return 'Profile clarification';
  if (action.startsWith('CLINICAL_DOCUMENT_')) return 'Document review';
  if (action.startsWith('BASE_MEAL_') || action.startsWith('MEAL_REVIEW_')) return 'Meal verification';
  if (action.startsWith('MEAL_PLAN_') || action.startsWith('COALESCED_MEAL_')) return 'Meal approval';
  if (action.startsWith('MEAL_APPROVAL_') || action.startsWith('CONDITION_CLEARANCE_')) return 'Reusable approval';
  if (/MEAL_(BASE|LIBRARY)_FLAG/.test(action)) return 'Meal flag';
  if (action.startsWith('OUTSIDE_MEAL_')) return 'Outside food review';
  if (/NUTRITIONIST_(ACCESS|VERIFIED|APPLICATION|CALL)/.test(action)) return 'RND credentials';
  return 'Administration';
}

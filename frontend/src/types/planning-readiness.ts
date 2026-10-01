export interface PlanningReadiness {
  status:
    | 'BLOCKED_CLINICAL_CONTEXT'
    | 'BLOCKED_PROFILE_REVIEW'
    | 'BLOCKED_MEMBERSHIP'
    | 'REQUEST_ALLOWED_REVIEW_EXPECTED'
    | 'REQUEST_ALLOWED';
  canRequestPlan: boolean;
  title: string;
  message: string;
  actionPath: string;
}

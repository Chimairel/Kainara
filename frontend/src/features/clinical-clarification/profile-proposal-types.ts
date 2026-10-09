export type SafetyInput = {
  domain: 'CONDITION' | 'ALLERGY' | 'INTOLERANCE' | 'AVOIDED_INGREDIENT';
  value: string;
  provenance: 'PREDEFINED' | 'CUSTOM';
};
export type HealthDetailCorrection = {
  area: string;
  conditionDetails: string;
  medications: string;
  dietaryAdvice: string;
  recentSymptoms: string;
  measurements: string;
};
export type ProfileChanges = {
  domains: Array<{ domain: SafetyInput['domain']; entries: Array<Omit<SafetyInput, 'domain'>> }>;
  healthDetails: HealthDetailCorrection[];
};
export type ProfileProposal = {
  id: string;
  profileRevision: number;
  scopeKey: string;
  status: string;
  authorName: string;
  createdAt: string;
  rationale: string;
  beforeSnapshot: {
    safetyInputs: SafetyInput[];
    healthDetails: Array<{ area: string; responses: Partial<HealthDetailCorrection> }>;
  };
  changes: ProfileChanges;
  evidenceSnapshot: Array<{ title: string }>;
  memberNote: string | null;
  acceptedProfileRevision: number | null;
};
export type ProfileProposalWorkspace = {
  enabled: boolean;
  catalogue?: {
    conditions: Array<{ code: string; displayName: string; domains: string[] }>;
    foodSafety: Array<{ code: string; displayName: string; domains: string[] }>;
  };
  editableInputs: SafetyInput[];
  proposals: ProfileProposal[];
};
export const healthCorrectionFields = [
  'conditionDetails',
  'medications',
  'dietaryAdvice',
  'recentSymptoms',
  'measurements',
] as const;
export const proposalFieldLabel = (field: string) => field.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');

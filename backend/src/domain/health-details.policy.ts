import { ClinicalEvidenceArea, HealthConditionType } from '@prisma/client';
import { evidenceAreaForCondition } from './clinical-evidence-requirement.policy';
import { isCurrentHealthDetails } from '@/validation/health-details.schemas';

type HealthDetailsProfile = {
  userProfile: { safetyRevision: number; otherConditions: string | null; otherAllergies: string | null } | null;
  healthConditions: Array<{ condition: HealthConditionType }>;
  allergies: Array<{ allergen: string }>;
  clinicalContextResponses: Array<{ area: ClinicalEvidenceArea; responses: unknown }>;
};

export function healthDetailsAreas(user: Omit<HealthDetailsProfile, 'clinicalContextResponses'>) {
  const areas = new Set<ClinicalEvidenceArea>();
  user.healthConditions.forEach(({ condition }) => {
    const area = evidenceAreaForCondition(condition);
    if (area) areas.add(area);
  });
  if (user.allergies.some(({ allergen }) => allergen !== 'NONE') || user.userProfile?.otherAllergies?.trim())
    areas.add(ClinicalEvidenceArea.FOOD_ALLERGY);
  if (user.userProfile?.otherConditions?.trim()) areas.add(ClinicalEvidenceArea.OTHER);
  return [...areas];
}

export function healthDetailsRequirements(user: HealthDetailsProfile) {
  return healthDetailsAreas(user).map((area) => {
    const context = user.clinicalContextResponses.find((item) => item.area === area);
    const ready = isCurrentHealthDetails(context?.responses, user.userProfile?.safetyRevision ?? -1);
    return {
      area,
      condition:
        user.healthConditions.find((item) => evidenceAreaForCondition(item.condition) === area)?.condition ??
        HealthConditionType.NONE,
      state: ready ? ('READY' as const) : ('CONTEXT_REQUIRED' as const),
      required: true,
      reasonCode: ready ? 'USER_REPORTED_DETAILS_AVAILABLE' : 'HEALTH_DETAILS_REQUIRED',
      message: ready
        ? 'User-provided details are available for nutritionist review.'
        : 'Complete the health details form for this declared condition or restriction.',
      readyDocumentIds: [] as string[],
    };
  });
}

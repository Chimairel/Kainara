import { ClinicalEvidenceArea, HealthConditionType } from '@prisma/client';
import { evidenceAreaForCondition } from './clinical-evidence-requirement.policy';
import { requiresHealthPlanning } from './planning-membership.policy';
import { isCurrentHealthDetails } from '@/validation/health-details.schemas';
import { adaptUserSafetyRestrictions } from './structured-restriction.adapter';
import { isDeterministicAvoidedFood } from './food-exclusion.policy';

type HealthDetailsProfile = {
  userProfile: { safetyRevision: number; otherConditions: string | null; otherAllergies: string | null } | null;
  healthConditions: Array<{ condition: HealthConditionType }>;
  allergies: Array<{ allergen: string }>;
  safetyProfileEntries?: import('./structured-restriction.adapter').StructuredSafetyRestrictionEntry[];
  clinicalContextResponses: Array<{ area: ClinicalEvidenceArea; responses: unknown }>;
};

export function isRequestedHealthDetails(input: {
  status?: string; reasonCodes?: unknown; savedScopeKey: string | null; currentScopeKey: string; area: string;
}) {
  return input.status === 'DECLINED' && Array.isArray(input.reasonCodes) &&
    input.reasonCodes[0] === 'DETAILS_REQUESTED' && input.reasonCodes[1] === input.area &&
    input.savedScopeKey === input.currentScopeKey;
}

export function healthDetailsAreas(user: Omit<HealthDetailsProfile, 'clinicalContextResponses'>) {
  const areas = new Set<ClinicalEvidenceArea>();
  user.healthConditions.forEach(({ condition }) => {
    const area = evidenceAreaForCondition(condition);
    if (area) areas.add(area);
  });
  const foodDetailsNeeded = user.safetyProfileEntries?.length
    ? user.safetyProfileEntries.some(
        (entry) =>
          entry.canonicalCode !== 'NONE' &&
          (['ALLERGY', 'INTOLERANCE', 'UNKNOWN'].includes(String(entry.domain)) ||
            (entry.domain === 'AVOIDED_INGREDIENT' &&
              entry.supportState !== 'SUPPORTED' &&
              !isDeterministicAvoidedFood(entry)))
      )
    : user.allergies.some(({ allergen }) => allergen !== 'NONE') || user.userProfile?.otherAllergies?.trim();
  if (foodDetailsNeeded) areas.add(ClinicalEvidenceArea.FOOD_ALLERGY);
  if (user.userProfile?.otherConditions?.trim()) areas.add(ClinicalEvidenceArea.OTHER);
  return [...areas];
}

export function healthDetailsRequirements(user: HealthDetailsProfile) {
  const source = {
    healthConditions: user.healthConditions.map((item) => item.condition),
    allergies: user.allergies.map((item) => item.allergen),
    otherConditions: user.userProfile?.otherConditions,
    otherAllergies: user.userProfile?.otherAllergies,
    safetyEntries: user.safetyProfileEntries,
  };
  const requiresReview = requiresHealthPlanning(source);
  const restrictions = adaptUserSafetyRestrictions(source);
  return healthDetailsAreas(user)
    .filter((area) => area !== ClinicalEvidenceArea.FOOD_ALLERGY || requiresReview)
    .filter((area) => area !== ClinicalEvidenceArea.OTHER || restrictions.customConditions.length > 0)
    // Declarations alone do not create a form. New members wait for an RND's questions;
    // historical saved detail responses retain their revision checks.
    .filter((area) => user.clinicalContextResponses.some((item) => item.area === area))
    .map((area) => {
      const context = user.clinicalContextResponses.find((item) => item.area === area);
      const ready = isCurrentHealthDetails(context?.responses, user.userProfile?.safetyRevision ?? -1);
      const responses = context?.responses as Record<string, unknown> | undefined;
      const stale =
        responses?.formVersion === 'HEALTH_DETAILS_V1' && responses.safetyRevision !== user.userProfile?.safetyRevision;
      return {
        area,
        condition:
          user.healthConditions.find((item) => evidenceAreaForCondition(item.condition) === area)?.condition ??
          HealthConditionType.NONE,
        state: ready ? ('READY' as const) : ('CONTEXT_REQUIRED' as const),
        required: true,
        reasonCode: ready
          ? 'USER_REPORTED_DETAILS_AVAILABLE'
          : stale
            ? 'HEALTH_DETAILS_STALE'
            : 'HEALTH_DETAILS_REQUIRED',
        message: ready
          ? 'User-provided details are available for nutritionist review.'
          : stale
            ? 'Your declarations changed after these answers were saved. Review and save this form again.'
            : 'Complete the health details form for this declared condition or restriction.',
        readyDocumentIds: [] as string[],
      };
    });
}

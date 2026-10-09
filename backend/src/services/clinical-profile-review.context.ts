import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { AppError } from '@/errors/AppError';
import { env } from '@/config/env';
import { reviewContextKey } from '@/domain/meal-review-context.policy';
import { requiresIndividualPlanningReview } from '@/domain/planning-membership.policy';
import { adaptUserSafetyRestrictions } from '@/domain/structured-restriction.adapter';
import { activeConditionPlanningAssessment } from '@/domain/condition-planning-assessment.policy';

export const POLICY_VERSION = 'PROFILE_DETAILS_V1';
export const CLAIM_TTL_MS = 30 * 60_000;
export const scopedPolicy = (scopeKey: string) =>
  `${POLICY_VERSION}:${createHash('sha256').update(scopeKey).digest('hex').slice(0, 48)}`;

export const userInclude = {
  clinicalReviewEpoch: env.CLINICAL_CLARIFICATIONS_ENABLED,
  userProfile: true,
  healthConditions: true,
  allergies: true,
  safetyProfileEntries: true,
  clinicalContextResponses: true,
  clinicalDocuments: { select: { id: true, revision: true, status: true, sha256: true,
    ...(env.CLINICAL_CLARIFICATIONS_ENABLED ? { validUntil: true, facts: true } : {}),
  } },
} satisfies Prisma.UserInclude;

type ProfileUser = Prisma.UserGetPayload<{ include: typeof userInclude }>;

export function snapshotKey(value: Prisma.JsonValue): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, Prisma.JsonValue>;
  const fields = ['conditions', 'allergies', 'customConditions', 'customFoodRestrictions'] as const;
  if (
    typeof record.safetyRevision !== 'number' ||
    fields.some(
      (field) =>
        !Array.isArray(record[field]) || !(record[field] as Prisma.JsonArray).every((item) => typeof item === 'string')
    )
  )
    return null;
  const key: unknown[] = [
    record.safetyRevision,
    ...fields.map((field) => [...(record[field] as string[])].sort()),
    record.contextRevisions ?? [],
  ];
  if (Array.isArray(record.documentRevisions) && record.documentRevisions.length) key.push(record.documentRevisions);
  if (typeof record.clarificationEpisode === 'string') key.push(record.clarificationEpisode);
  if (Array.isArray(record.documentContexts) && record.documentContexts.length) key.push(record.documentContexts);
  return JSON.stringify(key);
}

export function context(user: ProfileUser) {
  const profile = user.userProfile;
  if (!profile) throw new AppError('Complete your health profile before meal planning.', 422, 'PROFILE_INCOMPLETE');
  const restrictions = adaptUserSafetyRestrictions({
    healthConditions: user.healthConditions.map((item) => item.condition),
    allergies: user.allergies.map((item) => item.allergen),
    otherConditions: profile.otherConditions,
    otherAllergies: profile.otherAllergies,
    safetyEntries: user.safetyProfileEntries,
    useConditionAssessments: false,
  });
  const snapshot = {
    ...(env.CLINICAL_CLARIFICATIONS_ENABLED ? { documentContexts: (user.clinicalDocuments ?? []).map(document => [
      document.id, reviewContextKey({ validUntil: document.validUntil,
        facts: [...(document.facts ?? [])].sort((a, b) => a.id.localeCompare(b.id)) }),
    ]).sort((a, b) => a[0].localeCompare(b[0])) } : {}),
    ...(user.clinicalReviewEpoch ? { clarificationEpisode: user.clinicalReviewEpoch.key } : {}),
    profileRevision: profile.revision,
    documentRevisions: (user.clinicalDocuments ?? [])
      .map((item) => [item.id, item.revision, item.status, item.sha256])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    safetyRevision: profile.safetyRevision,
    healthDetails: (user.clinicalContextResponses ?? []).map((item) => ({
      area: item.area,
      revision: item.revision,
      responses: item.responses,
    })).sort((a, b) => a.area.localeCompare(b.area)),
    contextRevisions: (user.clinicalContextResponses ?? [])
      .map((item) => [item.area, item.revision])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    conditions: [...restrictions.conditions].sort(),
    allergies: [...restrictions.allergies].sort(),
    customConditions: [...restrictions.customConditions].sort(),
    customFoodRestrictions: [...restrictions.customFoodRestrictions].sort(),
  };
  return {
    profile,
    snapshot,
    scopeKey: snapshotKey(snapshot)!,
    declarationRequired:
      !user.safetyProfileEntries.some((item) => item.domain === 'CONDITION') ||
      !user.safetyProfileEntries.some((item) => item.domain === 'ALLERGY'),
    restricted: requiresIndividualPlanningReview(restrictions) || !!user.clinicalReviewEpoch,
    // A named restriction requiring manual meal review can still receive profile
    // confirmation. Unmapped/vague declarations must first be clarified.
    needsClarification: restrictions.displayEntries.some(
      (entry) =>
        entry.supportState !== 'SUPPORTED' &&
        entry.supportState !== 'RECOGNIZED_UNSUPPORTED' &&
        !user.safetyProfileEntries.some(
          (item) =>
            item.domain === entry.domain && item.displayName === entry.label && activeConditionPlanningAssessment(item)
        )
    ),
  };
}

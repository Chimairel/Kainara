import { ClinicalEvidenceArea, Prisma } from '@prisma/client';
import { healthDetailsAreas } from '@/domain/health-details.policy';
import { isCurrentHealthDetails } from '@/validation/health-details.schemas';

type Snapshot = {
  safetyRevision: number;
  contexts: Array<{ id: string; area: ClinicalEvidenceArea; responses: Prisma.JsonObject }>;
};

/** Keep user statements from the preceding onboarding step, never a clinical approval. */
export async function captureOnboardingConditionDetails(
  tx: Prisma.TransactionClient,
  userId: string,
  conditionsUnchanged: boolean,
  expected: { conditions: readonly string[]; otherConditions: string }
): Promise<Snapshot | null> {
  if (!conditionsUnchanged) return null;
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      onboardingDone: true,
      userProfile: { select: { safetyRevision: true, otherConditions: true, otherAllergies: true } },
      healthConditions: { select: { condition: true } },
    },
  });
  if (!user || user.onboardingDone !== false || !user.userProfile) return null;
  if (
    [...new Set(user.healthConditions.map((item) => item.condition))].sort().join('|') !==
      [...new Set(expected.conditions)].sort().join('|') ||
    (user.userProfile.otherConditions ?? '') !== expected.otherConditions
  )
    return null;
  const areas = healthDetailsAreas({ ...user, allergies: [] }).filter(
    (area) => area !== ClinicalEvidenceArea.FOOD_ALLERGY
  );
  if (!areas.length) return null;
  const contexts = await tx.clinicalContextResponse.findMany({ where: { userId, area: { in: areas } } });
  return {
    safetyRevision: user.userProfile.safetyRevision,
    contexts: contexts.flatMap((item) =>
      isCurrentHealthDetails(item.responses, user.userProfile!.safetyRevision)
        ? [{ id: item.id, area: item.area, responses: item.responses as Prisma.JsonObject }]
        : []
    ),
  };
}

export async function retainOnboardingConditionDetails(
  tx: Prisma.TransactionClient,
  userId: string,
  snapshot: Snapshot | null,
  safetyRevision: number
) {
  if (!snapshot || safetyRevision !== snapshot.safetyRevision + 1) return;
  for (const context of snapshot.contexts) {
    await tx.clinicalContextResponse.update({
      where: { id: context.id },
      data: {
        responses: { ...context.responses, safetyRevision },
        revision: { increment: 1 },
      },
    });
    await tx.auditEvent.create({
      data: {
        actorUserId: userId,
        action: 'ONBOARDING_CONDITION_DETAILS_RETAINED',
        entityType: 'ClinicalContextResponse',
        entityId: context.id,
        metadata: { area: context.area, previousSafetyRevision: snapshot.safetyRevision, safetyRevision },
      },
    });
  }
}

import type { Prisma } from '@prisma/client';
import { resolvePlanningProfile } from '@/domain/planning-report.policy';
import { membershipEnabled } from '@/domain/membership.policy';
import { adaptUserSafetyRestrictions } from '@/domain/structured-restriction.adapter';

type UserNutritionReadClient = Pick<Prisma.TransactionClient, 'user'>;

const userNutritionContextInclude = {
  userProfile: true,
  healthConditions: true,
  allergies: true,
  safetyProfileEntries: true,
} satisfies Prisma.UserInclude;

export async function loadUserNutritionContext(
  client: UserNutritionReadClient,
  userId: string,
  missingProfileMessage: string
) {
  const user = await client.user.findUnique({
    where: { id: userId },
    include: userNutritionContextInclude,
  });

  if (!user || !user.userProfile) throw new Error(missingProfileMessage);

  const profile = user.userProfile;
  const safetyRestrictions = adaptUserSafetyRestrictions({
    safetyEntries: user.safetyProfileEntries,
    healthConditions: user.healthConditions.map((item) => item.condition),
    allergies: user.allergies.map((item) => item.allergen),
    otherConditions: profile.otherConditions,
    otherAllergies: profile.otherAllergies,
  });

  return {
    user,
    profile,
    safetyRestrictions,
    conditions: safetyRestrictions.conditions,
    allergens: safetyRestrictions.allergies,
    otherConditions: safetyRestrictions.customConditions.join(', '),
    otherAllergies: safetyRestrictions.customFoodRestrictions.join(', '),
  };
}

/** All new plan inputs come from the accepted report. Current safety declarations remain visible. */
export async function loadPlanningNutritionContext(
  client: UserNutritionReadClient & Pick<Prisma.TransactionClient, 'nutritionReportVersion'>,
  userId: string,
  missingProfileMessage: string
) {
  const context = await loadUserNutritionContext(client, userId, missingProfileMessage);
  if (!context.profile.planningReportVersion && !membershipEnabled()) return context;
  const version = await client.nutritionReportVersion.findFirst({
    where: {
      userId,
      ...(context.profile.planningReportVersion
        ? { version: context.profile.planningReportVersion }
        : { acknowledgedAt: { not: null } }),
    },
    orderBy: { version: 'desc' },
  });
  const profile = resolvePlanningProfile(context.profile, version);
  return { ...context, profile, user: { ...context.user, userProfile: profile } };
}

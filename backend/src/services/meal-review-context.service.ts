import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { recipeFamilyWhere } from './meal-recipe-family.service';
import { isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';

export type ReviewTx = Prisma.TransactionClient;
export const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value));
export const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export async function currentReviewProfile(tx: ReviewTx, profileId: string) {
  const profile = await tx.nutritionistProfile.findUnique({
    where: { id: profileId },
    include: { user: { include: { nutritionistApplicationInvite: { select: { status: true } } } } },
  });
  return profile &&
    isNutritionistEligibleForReview(profile) &&
    profile.user.emailVerified &&
    (!profile.user.nutritionistApplicationInvite || profile.user.nutritionistApplicationInvite.status === 'ACTIVATED')
    ? profile
    : null;
}

export async function reviewActor(tx: ReviewTx, userId: string, rndId?: string | null) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, isSuspended: true },
  });
  if (!user || user.isSuspended) throw new AppError('This reviewer is not eligible.', 403, 'REVIEWER_INELIGIBLE');
  if (!rndId) {
    if (user.role !== 'ADMIN') throw new AppError('An active administrator is required.', 403, 'ADMIN_REQUIRED');
    return { userId, rndId: null, snapshot: json({ id: user.id, name: user.name, role: user.role }) };
  }
  const rnd = await currentReviewProfile(tx, rndId);
  if (!rnd || rnd.userId !== userId || !isNutritionistEligibleForReview(rnd))
    throw new AppError('A currently eligible RND is required.', 403, 'REVIEWER_INELIGIBLE');
  return {
    userId,
    rndId,
    snapshot: json({
      id: user.id,
      name: user.name,
      role: 'RND',
      prcLicenseNumber: rnd.prcLicenseNumber,
      prcLicenseExpiry: rnd.prcLicenseExpiry,
    }),
  };
}

export async function rndUserId(profileId: string) {
  const actor = await prisma.nutritionistProfile.findUnique({ where: { id: profileId }, select: { userId: true } });
  if (!actor) throw new AppError('RND profile not found.', 403, 'REVIEWER_INELIGIBLE');
  return actor.userId;
}

export async function recipeLineageKey(tx: ReviewTx, mealId: string) {
  const meal = await tx.mealLibrary.findUniqueOrThrow({ where: { id: mealId } });
  const root = meal.recipeFamilyId
    ? await tx.mealLibrary.findUniqueOrThrow({ where: { id: meal.recipeFamilyId } })
    : meal;
  return root.sourceRawRecipeCandidateId ? `source:${root.sourceRawRecipeCandidateId}` : `recipe:${root.id}`;
}

export async function lockRecipeLineage(tx: ReviewTx, mealId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(741010)`;
  const key = await recipeLineageKey(tx, mealId);
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  return key;
}

export async function reviewContext(tx: ReviewTx, mealId: string, locked = false) {
  const key = locked ? await lockRecipeLineage(tx, mealId) : await recipeLineageKey(tx, mealId);
  const savedLineage = await tx.mealReviewLineage.findUnique({ where: { key }, select: { state: true } });
  const meals = await tx.mealLibrary.findMany({
    where: {
      ...(await recipeFamilyWhere(tx, mealId)),
      ...(savedLineage?.state === 'ARCHIVED' ? {} : { status: { not: 'ARCHIVED' as const } }),
    },
    orderBy: { id: 'asc' },
    include: {
      ingredients: {
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        include: { foodItem: { select: { id: true, source: true, compositionRevision: true } } },
      },
      safetyDeclarations: { orderBy: { id: 'asc' } },
    },
  });
  if (!meals.length) throw new AppError('Recipe is archived or unavailable.', 409, 'RECIPE_UNAVAILABLE');
  // No current values are substituted for older decisions; this snapshot is only the current version.
  const snapshot = meals.map(
    ({ status: _status, updatedAt: _updated, reviewLineageId: _lineage, usageCount: _usage, ...meal }) => meal
  );
  const recipeVersion = digest(snapshot);
  const lineage = await tx.mealReviewLineage.findUnique({
    where: { key },
    include: {
      incidents: {
        orderBy: { number: 'desc' },
        take: 1,
        include: { reports: { orderBy: { id: 'asc' } }, confirmations: true },
      },
    },
  });
  const incident = lineage?.incidents[0] ?? null;
  const reviewVersion = digest([
    recipeVersion,
    incident?.id ?? null,
    incident?.reports.map((report) => report.id) ?? [],
  ]);
  return { key, meals, snapshot, recipeVersion, reviewVersion, lineage, incident };
}

export type ReviewContext = Awaited<ReturnType<typeof reviewContext>>;
export function assertVersion(actual: string, expected: string) {
  if (actual !== expected)
    throw new AppError(
      'Recipe or concerns changed. Refresh and review the current version.',
      409,
      'REVIEW_VERSION_CONFLICT'
    );
}
export function assertIndependent(context: ReviewContext, rndId: string, userId?: string) {
  const excluded = new Set((context.incident?.excludedReviewerIds as string[] | undefined) ?? []);
  for (const meal of context.meals) if (meal.authoredByNutritionistId) excluded.add(meal.authoredByNutritionistId);
  for (const report of context.incident?.reports ?? [])
    if (report.actorNutritionistId) excluded.add(report.actorNutritionistId);
  if (excluded.has(rndId) || context.incident?.reports.some((report) => report.actorUserId === userId))
    throw new AppError(
      'An uninvolved RND must review this case. Authors, flaggers and challenged verifiers cannot confirm it.',
      403,
      'REVIEWER_INVOLVED'
    );
}

export async function recordReviewDecision(
  tx: ReviewTx,
  context: ReviewContext,
  actor: Awaited<ReturnType<typeof reviewActor>>,
  action: string,
  rationale: string,
  extra: unknown = {}
) {
  if (!context.incident) throw new AppError('Review case not found.', 404, 'REVIEW_CASE_NOT_FOUND');
  await tx.mealReviewDecision.create({
    data: {
      incidentId: context.incident.id,
      action,
      version: context.reviewVersion,
      actorUserId: actor.userId,
      actorSnapshot: actor.snapshot,
      snapshot: json({ meals: context.snapshot, extra }),
      rationale,
    },
  });
  await tx.auditEvent.create({
    data: {
      actorUserId: actor.userId,
      actorName: String((actor.snapshot as { name?: string }).name ?? 'Actor not recorded'),
      actorRole: actor.rndId ? 'NUTRITIONIST' : 'ADMIN',
      action: `MEAL_REVIEW_${action}`,
      entityType: 'MealLibrary',
      entityId: context.meals[0].id,
      metadata: {
        incidentId: context.incident.id,
        incidentNumber: context.incident.number,
        version: context.reviewVersion,
        rationale,
      },
    },
  });
}

import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { mealFlagSubmissionSchema, type MealFlagSubmission } from '@/validation/meal-review.schemas';
import { baseMealAdmissionMatches } from './meal-base-admission.service';
import {
  json,
  reviewContext,
  reviewActor,
  rndUserId,
  assertVersion,
  recordReviewDecision,
} from './meal-review-context.service';

export async function flagWholeMeal(profileId: string, mealId: string, input: MealFlagSubmission | string) {
  return flagMeal(await rndUserId(profileId), profileId, mealId, input);
}
export async function flagWholeMealAsAdmin(userId: string, mealId: string, input: MealFlagSubmission | string) {
  return flagMeal(userId, null, mealId, input);
}

async function flagMeal(userId: string, rndId: string | null, mealId: string, input: MealFlagSubmission | string) {
  return prisma.$transaction(
    async (tx) => {
      const actor = await reviewActor(tx, userId, rndId);
      let context = await reviewContext(tx, mealId, true);
      // Only internal legacy callers retain unstructured notes. HTTP submissions require all fields.
      const submission =
        typeof input === 'string'
          ? {
              expectedVersion: context.recipeVersion,
              notes: {
                category: 'OTHER',
                affectedFields: ['Legacy report: fields not recorded'],
                explanation: input.trim(),
                reference: 'Not recorded in legacy report',
                proposedCorrection: 'Not recorded in legacy report',
              },
            }
          : mealFlagSubmissionSchema.parse(input);
      if (submission.notes.explanation.length < 10)
        throw new AppError('Give comprehensive flag notes.', 422, 'FLAG_NOTES_REQUIRED');
      assertVersion(context.recipeVersion, submission.expectedVersion);
      if (context.lineage?.state === 'ARCHIVED') throw new AppError('This recipe is archived.', 409, 'RECIPE_ARCHIVED');
      const ids = context.meals.map((meal) => meal.id);
      let lineage = context.lineage;
      const legacy = !lineage && context.meals.some((meal) => meal.status === 'FLAGGED');
      if (!lineage)
        lineage = await tx.mealReviewLineage.create({
          data: { key: context.key, legacyHistoryUnknown: legacy },
          include: { incidents: { include: { reports: true, confirmations: true } } },
        });
      let incident = context.incident;
      if (!incident || incident.closedAt) {
        const [publishedMeals, verifications] = legacy
          ? [[], []]
          : await Promise.all([
              tx.mealLibrary.findMany({
                where: { id: { in: ids }, status: 'APPROVED' },
                include: { sourceRawRecipeCandidate: true },
              }),
              tx.mealBaseVerification.findMany({
                where: {
                  status: 'VERIFIED',
                  OR: [
                    { targetKind: 'LIBRARY_MEAL', targetId: { in: ids } },
                    {
                      targetKind: 'RAW_RECIPE',
                      targetId: {
                        in: context.meals.flatMap((meal) =>
                          meal.sourceRawRecipeCandidateId ? [meal.sourceRawRecipeCandidateId] : []
                        ),
                      },
                    },
                    {
                      targetKind: 'GENERATED_RECIPE',
                      targetId: {
                        in: context.meals.flatMap((meal) => (meal.recipeSignature ? [meal.recipeSignature] : [])),
                      },
                    },
                  ],
                },
              }),
            ]);
        const verifiedKeys = new Set(
          verifications.map((row) => `${row.targetKind}:${row.targetId}:${row.revisionKey}`)
        );
        if (
          !legacy &&
          !publishedMeals.some(
            (meal) =>
              Boolean(meal.verifiedByNutritionistId) ||
              meal.safetyEvidenceStatus === 'COMPLETE' ||
              baseMealAdmissionMatches(meal, verifiedKeys)
          )
        )
          throw new AppError(
            'Only a published, reviewed recipe can start a flag incident.',
            409,
            'RECIPE_NOT_PUBLISHED'
          );
        const number = lineage.incidentCount + (legacy ? 0 : 1);
        const state = lineage.everQuarantined || number >= 2 ? 'QUARANTINED' : 'PENDING_REREVIEW';
        // Both quarantine confirmations support the published decision being challenged.
        const previousRelease = context.incident?.closedAt
          ? await tx.mealReviewDecision.findFirst({
              where: { incidentId: context.incident.id, action: { in: ['ADMIN_RELEASED', 'REVERIFIED'] } },
              orderBy: { createdAt: 'desc' },
              select: { version: true },
            })
          : null;
        const excluded = [
          ...new Set([
            ...(context.incident?.confirmations ?? [])
              .filter((confirmation) => confirmation.version === previousRelease?.version)
              .map((confirmation) => confirmation.nutritionistId),
            ...context.meals.flatMap((meal) =>
              [
                meal.authoredByNutritionistId,
                meal.verifiedByNutritionistId,
                meal.safetyReviewedByNutritionistId,
              ].filter((id): id is string => !!id)
            ),
          ]),
        ];
        incident = await tx.mealReviewIncident.create({
          data: { lineageId: lineage.id, number, state, legacy, excludedReviewerIds: excluded },
          include: { reports: true, confirmations: true },
        });
        await tx.mealReviewLineage.update({
          where: { id: lineage.id },
          data: { incidentCount: number, state, everQuarantined: state === 'QUARANTINED' || lineage.everQuarantined },
        });
        await tx.mealLibrary.updateMany({
          where: { id: { in: ids } },
          data: { status: 'FLAGGED', reviewLineageId: lineage.id },
        });
        if (legacy) {
          const old = await tx.mealLibraryFlag.findMany({
            where: { mealLibraryId: { in: ids }, status: 'PENDING' },
            orderBy: { createdAt: 'asc' },
          });
          for (const flag of old)
            await tx.mealReviewReport.create({
              data: {
                incidentId: incident.id,
                actorUserId: flag.flaggedByAdminUserId ?? 'legacy-unavailable',
                actorNutritionistId: flag.flaggedByNutritionistId,
                actorSnapshot: { historicalInformation: 'Legacy actor details unavailable' },
                expectedVersion: context.recipeVersion,
                notes: {
                  category: 'LEGACY',
                  explanation: flag.reason,
                  originalFlagId: flag.id,
                  historicalInformation: 'Structured notes and prior incident count unavailable',
                },
              },
            });
        }
        context = await reviewContext(tx, mealId);
        await recordReviewDecision(
          tx,
          context,
          actor,
          'WITHHELD',
          legacy ? 'Legacy hold adopted; prior incident count unknown.' : submission.notes.explanation
        );
      }
      await tx.mealReviewReport.create({
        data: {
          incidentId: incident.id,
          actorUserId: userId,
          actorNutritionistId: rndId,
          actorSnapshot: actor.snapshot,
          expectedVersion: submission.expectedVersion,
          notes: json(submission.notes),
        },
      });
      await tx.mealLibraryFlag.create({
        data: {
          mealLibraryId: mealId,
          flaggedByNutritionistId: rndId,
          flaggedByAdminUserId: rndId ? null : userId,
          reason: submission.notes.explanation.slice(0, 1000),
          status: 'PENDING',
        },
      });
      const sourceId = context.meals.find((meal) => meal.sourceRawRecipeCandidateId)?.sourceRawRecipeCandidateId;
      const planWhere: Prisma.MealPlanWhereInput = {
        OR: [{ libraryMealId: { in: ids } }, ...(sourceId ? [{ sourceRawRecipeCandidateId: sourceId }] : [])],
        status: 'APPROVED',
      };
      const users = await tx.mealPlan.findMany({
        where: { ...planWhere, requiresSafetyRevalidation: false },
        select: { userId: true },
        distinct: ['userId'],
      });
      await tx.mealPlan.updateMany({ where: planWhere, data: { requiresSafetyRevalidation: true } });
      if (users.length) {
        const userIds = users.map((user) => user.userId);
        await tx.groceryList.updateMany({ where: { userId: { in: userIds } }, data: { isStale: true } });
        await tx.notification.createMany({
          data: userIds.map((id) => ({
            userId: id,
            type: 'MEAL_FLAGGED',
            title: 'A meal in your plan needs review',
            message: 'A recipe is temporarily unavailable. Review your plan and grocery list for current options.',
          })),
        });
      }
      context = await reviewContext(tx, mealId);
      await recordReviewDecision(tx, context, actor, 'FLAGGED', submission.notes.explanation, submission.notes);
      return {
        incidentId: incident.id,
        incidentNumber: incident.number,
        reviewState: incident.state,
        flaggedAt: new Date(),
        affectedVariants: ids.length,
        affectedUsers: users.length,
        recipeVersion: context.recipeVersion,
      };
    },
    { maxWait: 10_000, timeout: 30_000 }
  );
}

export async function releaseWholeMeal(profileId: string, mealId: string, findings: string) {
  void profileId;
  void mealId;
  void findings;
  throw new AppError(
    'Use the claimed, version-bound review workflow and resolve every concern before release.',
    409,
    'VERSION_BOUND_REVIEW_REQUIRED'
  );
}

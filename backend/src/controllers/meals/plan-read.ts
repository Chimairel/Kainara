import { publicCycleSnapshot } from '@/services/meal-macro-context.service';
import { getOwnedMealPlanWhere } from '@/domain/meal-actionability.policy';
import { remainingGenerationSlots } from '@/domain/meal-generation-continuation.policy';
import { retainedMealsForCycle } from '@/services/plan-repair-history.service';
import { unavailablePlanMeals } from '@/domain/unavailable-plan-meals.policy';
import { buildPendingMealPlanPreview } from '@/domain/meal-generation-result.policy';

import prisma from '@/lib/prisma';

import { CurrentPlanPreparationService } from '@/services/current-plan-preparation.service';

import { resolveLibraryRecipeCookingLinks } from '@/services/library-recipe-cooking-link.service';
import { resolveLibraryRecipeImages } from '@/services/library-recipe-image.service';

import { MealPlanCycleService } from '@/services/meal-plan-cycle.service';
import {
  pendingPreviewWithImages,
  rawRecipeImageSelect,
  mealExplanationIngredientInclude,
  serializeActionableMeal,
} from '@/services/meal-plan-presentation.service';

import { UpcomingPlanPreparationService } from '@/services/upcoming-plan-preparation.service';
import { AuthenticatedRequest } from '@/types';
import { MealPlanStatus } from '@prisma/client';
import { Response } from 'express';

/**
 * GET /api/user/meals/current
 * Returns current active plan meals grouped by date.
 */
export async function getCurrentPlan(req: AuthenticatedRequest, res: Response) {
  const stages: string[] = [];
  let stageStartedAt =
    typeof res.locals.currentPlanRequestStartedAt === 'number'
      ? res.locals.currentPlanRequestStartedAt
      : performance.now();
  const mark = (name: string) => {
    const now = performance.now();
    stages.push(`${name};dur=${(now - stageStartedAt).toFixed(1)}`);
    stageStartedAt = now;
  };
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }

    mark('prerequisites');
    // Preparation can perform many database reads. Start it after this
    // response so it does not compete with the user's current-plan read.
    res.once('finish', () => UpcomingPlanPreparationService.triggerNonBlocking(userId));
    const { cycle, clearedIds: cycleClearedIds } = await MealPlanCycleService.getCurrentCycleWithClearance(userId);
    mark('cycle');
    if (!cycle) {
      const generationJob = await CurrentPlanPreparationService.getCurrentWindowJobStatus(userId);
      mark('generation');
      res.setHeader('Server-Timing', stages.join(', '));
      return res.status(200).json({
        success: true,
        data: [],
        meta: {
          cycle: null,
          pendingReview: buildPendingMealPlanPreview([]),
          planSnapshot: null,
          awaitingGenerationCount: 0,
          generationStatus: generationJob?.status ?? 'GENERATING',
        },
      });
    }

    // The cycle row is the authoritative dated identity. Live profile
    // shopping preferences do not move or hide an already-created cycle.
    const planSnapshotPromise = prisma.mealPlanCycleSnapshot.findUnique({ where: { planGroupId: cycle.id } });
    const generationJobPromise = prisma.mealPlanGenerationJob.findUnique({
      where: { planGroupId: cycle.id },
      select: { status: true },
    });
    const groupMealsPromise = prisma.mealPlan.findMany({
      where: {
        userId,
        planGroupId: cycle.id,
      },
      include: {
        ingredients: { include: mealExplanationIngredientInclude },
        servingComponents: { where: { componentType: 'COOKED_RICE' } },
        libraryMeal: {
          include: {
            verifiedByNutritionist: {
              include: { user: { select: { name: true, image: true } } },
            },
          },
        },
        sourceRawRecipeCandidate: { select: rawRecipeImageSelect },
        mealLogs: {
          where: { userId },
        },
        nutritionist: {
          include: { user: { select: { name: true, image: true } } },
        },
        firstApprovedByNutritionist: {
          include: { user: { select: { name: true, image: true } } },
        },
      },
      orderBy: { scheduledDate: 'asc' },
    });
    const [groupMeals, rawPlanSnapshot, generationJob] = await Promise.all([
      groupMealsPromise,
      planSnapshotPromise,
      generationJobPromise,
    ]);
    const planSnapshot = await publicCycleSnapshot(
      prisma,
      rawPlanSnapshot,
      groupMeals.map((meal) => meal.scheduledDate)
    );
    mark('meals');
    const clearedIds = new Set(cycleClearedIds);
    mark('clearance');
    const libraryMeals = groupMeals.flatMap((row) => (row.libraryMeal ? [row.libraryMeal] : []));
    const [libraryImages, libraryCookingLinks] = await Promise.all([
      resolveLibraryRecipeImages(libraryMeals),
      resolveLibraryRecipeCookingLinks(libraryMeals),
    ]);
    mark('presentation');
    const meals = groupMeals
      .filter((meal) => clearedIds.has(meal.id))
      .map((meal) => serializeActionableMeal(meal, libraryImages, libraryCookingLinks));
    const retained = await retainedMealsForCycle(userId, cycle.id);
    mark('serialize');

    res.setHeader('Server-Timing', stages.join(', '));
    return res.status(200).json({
      success: true,
      data: meals,
      meta: {
        cycle: {
          ...cycle,
          ...unavailablePlanMeals(groupMeals, clearedIds, MealPlanCycleService.getBusinessDay(new Date())),
        },
        pendingReview: pendingPreviewWithImages(groupMeals, libraryImages, libraryCookingLinks),
        planSnapshot,
        retainedMealLogs: retained.map((meal) => ({
          id: meal.id,
          mealName: meal.mealName,
          mealType: meal.mealType,
          scheduledDate: meal.scheduledDate,
          calories: meal.calories,
          proteinG: meal.proteinG,
          carbsG: meal.carbsG,
          fatG: meal.fatG,
          status: meal.mealLogs[0]?.status ?? null,
        })),
        awaitingGenerationCount: remainingGenerationSlots(
          cycle.startDate,
          cycle.expectedSlotCount,
          [...groupMeals.filter((row) => row.status !== MealPlanStatus.CANCELLED), ...retained],
          new Date()
        ).length,
        generationStatus: generationJob?.status ?? null,
      },
    });
  } catch (error: any) {
    console.error('[MealsController] getCurrentPlan error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve your current meal plan.',
    });
  }
}

/** GET /api/user/meals/workspace — cleared current and upcoming slots. */
export async function getPlanWorkspace(req: AuthenticatedRequest, res: Response) {
  const stages: string[] = [];
  let stageStartedAt =
    typeof res.locals.currentPlanRequestStartedAt === 'number'
      ? res.locals.currentPlanRequestStartedAt
      : performance.now();
  const mark = (name: string) => {
    const now = performance.now();
    stages.push(`${name};dur=${(now - stageStartedAt).toFixed(1)}`);
    stageStartedAt = now;
  };
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized.' });
    mark('prerequisites');
    res.once('finish', () => UpcomingPlanPreparationService.triggerNonBlocking(userId));
    const clearedIdsByCycle = new Map<string, string[]>();
    const cycles = await MealPlanCycleService.getCurrentAndUpcoming(userId, new Date(), clearedIdsByCycle);
    mark('cycles');
    const pendingCurrentJob = cycles.current
      ? null
      : await CurrentPlanPreparationService.getCurrentWindowJobStatus(userId);
    const cycleIds = [cycles.current?.id, cycles.upcoming?.id].filter((id): id is string => Boolean(id));
    if (!cycleIds.length) {
      res.setHeader('Server-Timing', stages.join(', '));
      return res.status(200).json({
        success: true,
        data: [],
        meta: {
          cycles,
          pendingReview: null,
          awaitingGeneration: { current: 0, upcoming: 0 },
          generationStatus: { current: pendingCurrentJob?.status ?? 'GENERATING', upcoming: null },
        },
      });
    }
    const rowsPromise = prisma.mealPlan.findMany({
      where: { userId, planGroupId: { in: cycleIds } },
      include: {
        ingredients: { include: mealExplanationIngredientInclude },
        servingComponents: { where: { componentType: 'COOKED_RICE' } },
        libraryMeal: {
          include: {
            verifiedByNutritionist: {
              include: { user: { select: { name: true, image: true } } },
            },
          },
        },
        sourceRawRecipeCandidate: { select: rawRecipeImageSelect },
        mealLogs: { where: { userId } },
        nutritionist: { include: { user: { select: { name: true, image: true } } } },
        firstApprovedByNutritionist: { include: { user: { select: { name: true, image: true } } } },
      },
      orderBy: [{ scheduledDate: 'asc' }, { mealType: 'asc' }],
    });
    const clearedByCyclePromise = Promise.all(
      cycleIds.map(
        (cycleId) => clearedIdsByCycle.get(cycleId) ?? MealPlanCycleService.getClearedMealPlanIds(userId, cycleId)
      )
    );
    const generationJobsPromise = prisma.mealPlanGenerationJob.findMany({
      where: { planGroupId: { in: cycleIds } },
      select: { planGroupId: true, status: true },
    });
    const [rows, clearedByCycle, generationJobs] = await Promise.all([
      rowsPromise,
      clearedByCyclePromise,
      generationJobsPromise,
    ]);
    mark('meal-data');
    const generationStatusFor = (cycleId?: string | null) =>
      generationJobs.find((job) => job.planGroupId === cycleId)?.status ?? null;
    const clearedIds = new Set(clearedByCycle.flat());
    const libraryMeals = rows.flatMap((row) => (row.libraryMeal ? [row.libraryMeal] : []));
    const [libraryImages, libraryCookingLinks] = await Promise.all([
      resolveLibraryRecipeImages(libraryMeals),
      resolveLibraryRecipeCookingLinks(libraryMeals),
    ]);
    mark('presentation');
    const meals = rows
      .filter((meal) => clearedIds.has(meal.id))
      .map((meal) => ({
        ...serializeActionableMeal(meal, libraryImages, libraryCookingLinks),
        cycleScope: meal.planGroupId === cycles.upcoming?.id ? 'UPCOMING' : 'CURRENT',
      }));
    const retainedByCycle = await Promise.all(cycleIds.map((id) => retainedMealsForCycle(userId, id)));
    const retained = retainedByCycle.flat();
    const retainedFor = (id: string) => retainedByCycle[cycleIds.indexOf(id)] ?? [];
    mark('serialize');
    res.setHeader('Server-Timing', stages.join(', '));
    return res.status(200).json({
      success: true,
      data: meals,
      meta: {
        cycles: {
          current: cycles.current
            ? {
                ...cycles.current,
                ...unavailablePlanMeals(
                  rows.filter((row) => row.planGroupId === cycles.current?.id),
                  clearedIds,
                  MealPlanCycleService.getBusinessDay(new Date())
                ),
              }
            : null,
          upcoming: cycles.upcoming
            ? {
                ...cycles.upcoming,
                ...unavailablePlanMeals(
                  rows.filter((row) => row.planGroupId === cycles.upcoming?.id),
                  clearedIds,
                  MealPlanCycleService.getBusinessDay(new Date())
                ),
              }
            : null,
        },
        retainedMealLogs: retained.map((meal) => ({
          id: meal.id,
          mealName: meal.mealName,
          mealType: meal.mealType,
          scheduledDate: meal.scheduledDate,
          calories: meal.calories,
          proteinG: meal.proteinG,
          carbsG: meal.carbsG,
          fatG: meal.fatG,
          status: meal.mealLogs[0]?.status ?? null,
        })),
        pendingReview: pendingPreviewWithImages(rows, libraryImages, libraryCookingLinks),
        awaitingGeneration: {
          current: cycles.current
            ? remainingGenerationSlots(
                cycles.current.startDate,
                cycles.current.expectedSlotCount,
                [
                  ...rows.filter(
                    (row) => row.planGroupId === cycles.current?.id && row.status !== MealPlanStatus.CANCELLED
                  ),
                  ...retainedFor(cycles.current.id),
                ],
                new Date()
              ).length
            : 0,
          upcoming: cycles.upcoming
            ? remainingGenerationSlots(
                cycles.upcoming.startDate,
                cycles.upcoming.expectedSlotCount,
                [
                  ...rows.filter(
                    (row) => row.planGroupId === cycles.upcoming?.id && row.status !== MealPlanStatus.CANCELLED
                  ),
                  ...retainedFor(cycles.upcoming.id),
                ],
                new Date()
              ).length
            : 0,
        },
        generationStatus: {
          current: cycles.current
            ? generationStatusFor(cycles.current.id)
            : (pendingCurrentJob?.status ?? 'GENERATING'),
          upcoming: generationStatusFor(cycles.upcoming?.id),
        },
      },
    });
  } catch (error) {
    console.error('[MealsController] getPlanWorkspace error:', error);
    return res.status(500).json({ success: false, error: 'Failed to retrieve your meal workspace.' });
  }
}

/**
 * GET /api/user/meals/:id
 * Returns details of a specific meal plan item.
 */
export async function getMealDetails(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }

    const meal = await prisma.mealPlan.findFirst({
      where: getOwnedMealPlanWhere(userId, id),
      include: {
        ingredients: { include: mealExplanationIngredientInclude },
        servingComponents: { where: { componentType: 'COOKED_RICE' } },
        libraryMeal: true,
        sourceRawRecipeCandidate: { select: rawRecipeImageSelect },
        mealLogs: {
          where: { userId },
        },
        nutritionist: {
          include: { user: { select: { name: true, image: true } } },
        },
      },
    });

    if (!meal) {
      return res.status(404).json({ success: false, error: 'Meal not found.' });
    }

    const libraryImages = await resolveLibraryRecipeImages(meal.libraryMeal ? [meal.libraryMeal] : []);
    const libraryCookingLinks = await resolveLibraryRecipeCookingLinks(meal.libraryMeal ? [meal.libraryMeal] : []);

    return res.status(200).json({
      success: true,
      data: serializeActionableMeal(meal, libraryImages, libraryCookingLinks),
    });
  } catch (error: any) {
    console.error('[MealsController] getMealDetails error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve meal details.',
    });
  }
}

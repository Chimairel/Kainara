import { publicCycleSnapshot } from '@/services/meal-macro-context.service';
import { filterUserActionableMealPlans } from '@/domain/meal-actionability.policy';
import { missingMealSlots } from '@/domain/meal-generation-gap.policy';

import { summarizeGeneratedMealPlan } from '@/domain/meal-generation-result.policy';
import { AppError } from '@/errors/AppError';
import prisma from '@/lib/prisma';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';

import { GroceryService } from '@/services/grocery.service';
import { resolveLibraryRecipeCookingLinks } from '@/services/library-recipe-cooking-link.service';
import { resolveLibraryRecipeImages } from '@/services/library-recipe-image.service';
import { MealAiQueueService } from '@/services/meal-ai-queue.service';
import { MealGenerationService } from '@/services/meal-generation.service';

import {
  pendingPreviewWithImages,
  rawRecipeImageSelect,
  mealExplanationIngredientInclude,
  mealReviewDecisionInclude,
  serializeActionableMeal,
} from '@/services/meal-plan-presentation.service';

import { replaceRetiredPlanMeals } from '@/services/retired-plan-repair.service';

import { AuthenticatedRequest } from '@/types';
import { MealPlanStatus } from '@prisma/client';
import { Response } from 'express';

export async function replaceRetiredMeals(req: AuthenticatedRequest, res: Response) {
  if (!req.user?.userId) return res.status(401).json({ success: false, error: 'Unauthorized.' });
  try {
    const data = await replaceRetiredPlanMeals(req.user.userId, req.params.cycleId);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(error instanceof AppError ? error.statusCode : 500).json({
      success: false,
      error: sanitizeErrorMessage(error, 'Could not replace retired meals.'),
    });
  }
}

/**
 * POST /api/user/meals/generate
 * Triggers the 7-day plan generation.
 */
export async function generateMealPlan(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }

    console.log('[MealsController] Starting authenticated meal plan generation.');
    const planGroupId = await MealGenerationService.generatePlanForUser(userId, new Date(), {
      replaceExisting: req.body.replaceExisting === true,
      requestKey: req.body.requestKey,
    });

    // Fetch the new group once, but expose only actionable rows as meals.
    // Pending rows are represented by a count/status summary, never as
    // actionable meal details.
    const generatedPlanRows = await prisma.mealPlan.findMany({
      where: {
        planGroupId,
        userId,
      },
      include: {
        ingredients: { include: mealExplanationIngredientInclude },
        reviewDecisions: mealReviewDecisionInclude,
        servingComponents: { where: { componentType: 'COOKED_RICE' } },
        libraryMeal: {
          include: {
            safetyReviewedByNutritionist: { include: { user: { select: { name: true, image: true } } } },
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
      orderBy: { scheduledDate: 'asc' },
    });
    const libraryImages = await resolveLibraryRecipeImages(
      generatedPlanRows.flatMap((row) => (row.libraryMeal ? [row.libraryMeal] : []))
    );
    const libraryCookingLinks = await resolveLibraryRecipeCookingLinks(
      generatedPlanRows.flatMap((row) => (row.libraryMeal ? [row.libraryMeal] : []))
    );
    const meals = filterUserActionableMealPlans(generatedPlanRows).map((meal) =>
      serializeActionableMeal(meal, libraryImages, libraryCookingLinks)
    );
    const generationSummary = summarizeGeneratedMealPlan(generatedPlanRows);
    const pendingReview = pendingPreviewWithImages(generatedPlanRows, libraryImages, libraryCookingLinks);
    const planSnapshot = await publicCycleSnapshot(
      prisma,
      await prisma.mealPlanCycleSnapshot.findUnique({ where: { planGroupId } }),
      generatedPlanRows.map((meal) => meal.scheduledDate)
    );
    const cycle = await prisma.mealPlanCycle.findUnique({ where: { id: planGroupId } });
    const awaitingGenerationCount = cycle
      ? missingMealSlots(
          cycle.startDate,
          cycle.expectedSlotCount,
          generatedPlanRows.filter((row) => row.status !== MealPlanStatus.CANCELLED)
        ).length
      : 0;
    const generationJob = await prisma.mealPlanGenerationJob.findUnique({
      where: { planGroupId },
      select: { status: true },
    });

    // The grocery checklist is a projection of the actionable plan, not a
    // second user-generated artifact. Build it as part of successful plan
    // generation whenever at least one approved meal is available. A retry
    // remains safe because GroceryService replaces the prior projection.
    if (meals.length > 0) {
      try {
        await GroceryService.generateGroceryList(userId, undefined, planGroupId);
      } catch {
        console.warn('[MealsController] Plan saved; grocery projection remains available for retry.');
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        planGroupId,
        meals,
        ...generationSummary,
        pendingReview,
        planSnapshot,
        cycle,
        awaitingGenerationCount,
        generationStatus: generationJob?.status ?? null,
      },
    });
  } catch (error: any) {
    console.error(
      '[MealsController] Meal plan generation failed:',
      sanitizeErrorMessage(error, 'Internal meal generation failure.')
    );
    return res.status(error instanceof AppError ? error.statusCode : 500).json({
      success: false,
      error: sanitizeErrorMessage(error, 'Failed to generate your personalized meal plan.'),
      code: error instanceof AppError ? error.errorCode : undefined,
      details: error instanceof AppError ? error.details : undefined,
    });
  }
}

export async function getGenerationStatus(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized.' });
  }

  const job = await MealGenerationService.getLatestGenerationStatus(userId);
  return res.status(200).json({ success: true, data: job });
}

export async function retryMissingGeneration(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized.' });
  try {
    const queued = await MealAiQueueService.retryForCycle(userId, req.params.cycleId);
    return res.status(queued ? 202 : 409).json({
      success: queued,
      ...(queued
        ? { data: { status: 'WAITING_FOR_AI' } }
        : { error: 'This cycle cannot be retried. Refresh its status or request a new plan.' }),
    });
  } catch (error) {
    return res.status(error instanceof AppError ? error.statusCode : 500).json({
      success: false,
      error: sanitizeErrorMessage(error, 'Could not retry meal generation.'),
    });
  }
}

/**
 * POST /api/user/meals/rollover
 * Creates the current full weekly plan only when the user's starter bridge
 * ended immediately before the current shopping cycle and no weekly group
 * already exists for that cycle.
 */
export async function ensureCurrentPlanRollover(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }

    const result = await MealGenerationService.ensureCurrentWeeklyRollover(userId);
    return res.status(200).json({ success: true, data: result });
  } catch (error: unknown) {
    console.error('[MealsController] Weekly rollover failed:', sanitizeErrorMessage(error, 'Weekly rollover failure.'));
    return res.status(500).json({
      success: false,
      error: sanitizeErrorMessage(error, 'Failed to prepare the current weekly meal plan.'),
    });
  }
}

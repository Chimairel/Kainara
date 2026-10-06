import { isMealPlanNotActionableError } from '@/domain/meal-actionability.policy';

import { AppError } from '@/errors/AppError';

import { sanitizeErrorMessage } from '@/lib/sanitizeError';

import { MealSwapService } from '@/services/meal-swap.service';

import { AuthenticatedRequest } from '@/types';
import { MealType } from '@prisma/client';
import { Response } from 'express';

/**
 * GET /api/user/meals/:id/swap-options
 * Returns compatible swap choices from verified MealLibrary.
 */
export async function getSwapOptions(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }

    const mealPlanId = req.params.id;
    const options = await MealSwapService.getEligibleSwapOptions(userId, mealPlanId);

    return res.status(200).json({
      success: true,
      data: options,
    });
  } catch (error: any) {
    console.error('[MealsController] getSwapOptions error:', error);
    if (error instanceof AppError)
      return res.status(error.statusCode).json({ success: false, error: error.message, code: error.errorCode });
    if (isMealPlanNotActionableError(error)) {
      return res.status(409).json({ success: false, error: error.message });
    }
    return res.status(500).json({
      success: false,
      error: sanitizeErrorMessage(error, 'Failed to retrieve swap options.'),
    });
  }
}

/**
 * POST /api/user/meals/:id/swap
 * Performs the meal swap.
 */
export async function executeSwap(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }

    const mealPlanId = req.params.id;
    const { newLibraryMealId, warningShown, warningAcknowledged, previewToken, requestKey, groceryDeltaAcknowledged } =
      req.body;

    if (!newLibraryMealId) {
      return res.status(400).json({ success: false, error: 'Missing newLibraryMealId parameter.' });
    }

    const result = await MealSwapService.swapMeal(
      userId,
      mealPlanId,
      newLibraryMealId,
      warningShown,
      warningAcknowledged,
      previewToken,
      requestKey,
      groceryDeltaAcknowledged
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    console.error('[MealsController] executeSwap error:', sanitizeErrorMessage(error, 'Meal swap failure.'));
    if (error instanceof AppError)
      return res.status(error.statusCode).json({ success: false, error: error.message, code: error.errorCode });
    if (isMealPlanNotActionableError(error)) {
      return res.status(409).json({ success: false, error: error.message });
    }
    return res.status(400).json({
      success: false,
      error: sanitizeErrorMessage(error, 'Failed to execute meal swap.'),
    });
  }
}

/**
 * GET /api/user/meals/:id/swap-preview
 * Generates swap calorie warnings.
 */
export async function getSwapPreview(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }
    const mealPlanId = req.params.id;
    const libraryMealId = req.query.libraryMealId as string;
    if (!libraryMealId) {
      return res.status(400).json({ success: false, error: 'Missing libraryMealId query parameter.' });
    }
    const preview = await MealSwapService.getSwapPreview(userId, mealPlanId, libraryMealId);
    return res.status(200).json({ success: true, data: preview });
  } catch (error: any) {
    if (error instanceof AppError)
      return res.status(error.statusCode).json({ success: false, error: error.message, code: error.errorCode });
    if (isMealPlanNotActionableError(error)) {
      return res.status(409).json({ success: false, error: error.message });
    }
    return res.status(400).json({ success: false, error: sanitizeErrorMessage(error, 'Failed to preview swap.') });
  }
}

/**
 * GET /api/user/meals/compatible-library
 * Returns all compatible approved library meals for the logged-in user.
 */
export async function getCompatibleLibrary(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }

    const page = await MealSwapService.getCompatibleLibraryMeals(userId, {
      mealType: req.query.mealType as MealType | undefined,
      search: req.query.search as string | undefined,
      date: req.query.date as string | undefined,
      riceRole: req.query.riceRole as 'PAIR_WITH_RICE' | 'STANDALONE' | 'INCLUDES_RICE' | undefined,
      cursor: req.query.cursor as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    });

    return res.status(200).json({
      success: true,
      data: page.items,
      meta: { total: page.total, nextCursor: page.nextCursor },
    });
  } catch (error: any) {
    console.error('[MealsController] getCompatibleLibrary error:', error);
    return res.status(500).json({
      success: false,
      error: sanitizeErrorMessage(error, 'Failed to retrieve compatible meals.'),
    });
  }
}

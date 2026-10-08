import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@/middleware/errorHandler';
import { AppError } from '@/errors/AppError';
import type { AuthenticatedRequest } from '@/types';
import { mealLogFiltersSchema } from '@/validation/admin-meal-log.schemas';
import { AdminMealLogService } from '@/services/admin-meal-log.service';

const router = Router();
router.get(
  '/popularity',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const query = mealLogFiltersSchema.safeParse(req.query);
    if (!query.success || query.data.member || query.data.status || query.data.recipeKey || query.data.includeTests)
      throw new AppError('Check the popularity filters.', 400, 'INVALID_MEAL_LOG_FILTERS');
    res
      .set('Cache-Control', 'private, no-store')
      .json({ success: true, data: await AdminMealLogService.popularity(req.user!.userId, query.data) });
  })
);
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const query = mealLogFiltersSchema.safeParse(req.query);
    if (!query.success)
      throw new AppError('Check the meal log filters and date range.', 400, 'INVALID_MEAL_LOG_FILTERS');
    res
      .set('Cache-Control', 'private, no-store')
      .json({ success: true, data: await AdminMealLogService.list(req.user!.userId, query.data) });
  })
);
router.get(
  '/:logId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = z.string().min(1).max(191).safeParse(req.params.logId);
    const query = z
      .object({ page: z.coerce.number().int().min(1).max(100000).default(1) })
      .strict()
      .safeParse(req.query);
    if (!id.success || !query.success)
      throw new AppError('Choose a recorded meal log.', 400, 'INVALID_MEAL_LOG_FILTERS');
    res
      .set('Cache-Control', 'private, no-store')
      .json({ success: true, data: await AdminMealLogService.detail(req.user!.userId, id.data, query.data.page) });
  })
);
export default router;

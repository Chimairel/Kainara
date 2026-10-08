import { Router, type Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '@/types';
import { AppError } from '@/errors/AppError';
import validateZodBody from '@/middleware/validateZod';
import { mealReviewActionSchema, mealReviewSubmissionSchema } from '@/validation/meal-review.schemas';
import { adminMealInputSchema } from '@/validation/admin-meal.schemas';
import { MealReviewService } from '@/services/meal-review.service';
import { correctHeldRecipe } from '@/services/meal-review-correction.service';

export function mealReviewRouter(role: 'admin' | 'rnd') {
  // Mounted only behind the parent live role and RND eligibility guards.
  const router = Router();
  const respond =
    (handler: (req: AuthenticatedRequest) => Promise<unknown>) => async (req: AuthenticatedRequest, res: Response) => {
      res.setHeader('Cache-Control', 'private, no-store');
      try {
        return res.json({ success: true, data: await handler(req) });
      } catch (error) {
        return res.status(error instanceof AppError ? error.statusCode : 500).json({
          success: false,
          error: error instanceof AppError ? error.message : 'The review action could not be completed.',
          errorCode: error instanceof AppError ? error.errorCode : 'INTERNAL_ERROR',
        });
      }
    };
  router.get(
    '/',
    respond(() => MealReviewService.queue())
  );
  router.get(
    '/:id',
    respond((req) => MealReviewService.detail(req.params.id))
  );
  if (role === 'rnd') {
    router.post(
      '/:id/claim',
      validateZodBody(z.object({ expectedVersion: z.string().regex(/^[a-f0-9]{64}$/) }).strict()),
      respond((req) => MealReviewService.claim(req.nutritionistProfileId!, req.params.id, req.body.expectedVersion))
    );
    router.post(
      '/:id/confirm',
      validateZodBody(mealReviewSubmissionSchema),
      respond((req) => MealReviewService.confirm(req.nutritionistProfileId!, req.params.id, req.body))
    );
    router.post(
      '/:id/correct',
      validateZodBody(mealReviewActionSchema.extend({ meal: adminMealInputSchema })),
      respond((req) =>
        correctHeldRecipe(
          req.nutritionistProfileId!,
          req.params.id,
          req.body.expectedVersion,
          req.body.rationale,
          req.body.meal
        )
      )
    );
  } else {
    for (const action of ['release', 'archive'] as const)
      router.post(
        `/:id/${action}`,
        validateZodBody(mealReviewActionSchema),
        respond((req) =>
          MealReviewService.adminAction(
            req.user!.userId,
            req.params.id,
            action,
            req.body.expectedVersion,
            req.body.rationale
          )
        )
      );
  }
  return router;
}

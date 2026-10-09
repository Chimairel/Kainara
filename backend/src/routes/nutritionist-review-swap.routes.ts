import { Router, Response } from 'express';
import { AuthenticatedRequest } from '@/types';
import { asyncHandler } from '@/middleware/errorHandler';
import { validateZodRequest } from '@/middleware/validateZod';
import { reviewSwapBodySchema, reviewSwapParamsSchema, reviewSwapQuerySchema } from '@/validation/review-swap.schemas';
import { executeReviewSwap, listReviewSwapOptions } from '@/services/review-swap.service';

// Mounted after authentication, role and current RND eligibility middleware.
const router = Router();
router.get(
  '/queue/:id/swap-options',
  validateZodRequest({ params: reviewSwapParamsSchema, query: reviewSwapQuerySchema }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({ success: true, data: await listReviewSwapOptions(req.nutritionistProfileId!, req.params.id, req.query.expectedContextKey as string | undefined) });
  })
);
router.post(
  '/queue/:id/swap',
  validateZodRequest({ params: reviewSwapParamsSchema, body: reviewSwapBodySchema }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({ success: true, data: await executeReviewSwap(req.nutritionistProfileId!, req.params.id, req.body) });
  })
);
export default router;

import { Router, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@/middleware/errorHandler';
import { validateZodRequest } from '@/middleware/validateZod';
import { recipeBatchReviewSchema } from '@/domain/recipe-batch-review.policy';
import { confirmRecipeBatchReview, recipeBatchReviewPreview } from '@/services/recipe-batch-review.service';
import type { AuthenticatedRequest } from '@/types';

/** Mounted after authentication, RND role and current review-eligibility guards. */
const router = Router();
router.get(
  '/preview',
  validateZodRequest({ query: z.object({ cursor: z.string().min(1).max(160).optional() }).strict() }),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await recipeBatchReviewPreview(req.query.cursor as string | undefined) });
  })
);
router.post(
  '/confirm',
  validateZodRequest({ body: recipeBatchReviewSchema }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({ success: true, data: await confirmRecipeBatchReview(req.nutritionistProfileId!, req.body) });
  })
);
export default router;

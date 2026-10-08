import { Router, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@/middleware/errorHandler';
import { validateZodBody, validateZodRequest } from '@/middleware/validateZod';
import { ReviewRoutingService } from '@/services/review-routing.service';
import type { AuthenticatedRequest } from '@/types';

import { expertiseSchema } from '@/validation/review-routing.schemas';

const router = Router();
// Parent admin router applies authentication and current ADMIN authorization.
router.get(
  '/',
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    res.json({ success: true, data: await ReviewRoutingService.adminOverview() });
  })
);
router.patch(
  '/',
  validateZodBody(z.object({ enabled: z.boolean() }).strict()),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({ success: true, data: await ReviewRoutingService.setEnabled(req.user!.userId, req.body.enabled) });
  })
);
router.put(
  '/expertise/:id',
  validateZodRequest({ params: z.object({ id: z.string().min(1) }).strict(), body: expertiseSchema }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({
      success: true,
      data: await ReviewRoutingService.verifyExpertise(req.user!.userId, req.params.id, req.body),
    });
  })
);
export default router;

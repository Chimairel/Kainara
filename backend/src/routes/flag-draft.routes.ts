import { Router } from 'express';
import { asyncHandler } from '@/middleware/errorHandler';
import validateZodBody from '@/middleware/validateZod';
import type { AuthenticatedRequest } from '@/types';
import { flagDraftBodySchema, manageFlagDraft } from '@/services/flag-draft.service';

/** Mounted behind the same live admin/RND eligibility middleware as flag submission. */
export function flagDraftRouter(admin = false) {
  const router = Router();
  for (const action of ['status','begin','save','cancel'] as const) router.post(`/${action}`, validateZodBody(flagDraftBodySchema),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      res.setHeader('Cache-Control','private, no-store');
      res.json({ success: true, data: await manageFlagDraft(req.user!.userId, admin ? null : req.nutritionistProfileId!, action, req.body) });
    }));
  return router;
}

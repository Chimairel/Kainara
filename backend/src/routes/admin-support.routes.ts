import { Router } from 'express';
import { supportReplyLimiter } from '@/middleware/attemptLimiter';
import { asyncHandler } from '@/middleware/errorHandler';
import { z } from 'zod';
import { validateZodRequest } from '@/middleware/validateZod';
import validateZodBody from '@/middleware/validateZod';
import { supportReplySchema, supportListSchema, supportIdSchema } from '@/validation/support.schemas';
import { listSupportRequests, getSupportRequest, replyToSupportRequest } from '@/services/support.service';
import type { AuthenticatedRequest } from '@/types';

// Mounted after authenticate + ADMIN role enforcement in admin.routes.
const router = Router();
router.get('/', validateZodRequest({ query: supportListSchema }), asyncHandler(async (req: AuthenticatedRequest, res) => {
  res.json({ success: true, data: await listSupportRequests(req.user!.userId, req.query) });
}));
router.get('/:id', validateZodRequest({ params: z.object({ id: supportIdSchema }) }), asyncHandler(async (req: AuthenticatedRequest, res) => {
  res.json({ success: true, data: await getSupportRequest(req.user!.userId, req.params.id) });
}));
router.post('/:id/replies', validateZodRequest({ params: z.object({ id: supportIdSchema }) }), supportReplyLimiter, validateZodBody(supportReplySchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  res.status(202).json({ success: true, data: await replyToSupportRequest(req.user!.userId, req.params.id, req.body) });
}));
export default router;

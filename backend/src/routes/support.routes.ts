import { Router } from 'express';
import { supportConnectionLimiter, supportAccountLimiter } from '@/middleware/attemptLimiter';
import authenticate from '@/middleware/auth';
import { requireVerifiedUser } from '@/middleware/userPrerequisites';
import validateZodBody from '@/middleware/validateZod';
import { asyncHandler } from '@/middleware/errorHandler';
import { supportRequestSchema } from '@/validation/support.schemas';
import { sendSupportRequest } from '@/services/support.service';
import type { AuthenticatedRequest } from '@/types';

const router = Router();
router.post('/requests', supportConnectionLimiter, authenticate, requireVerifiedUser, supportAccountLimiter,
  validateZodBody(supportRequestSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await sendSupportRequest(req.user!.userId, req.body);
    res.status(202).json({ success: true, data });
  }));
export default router;

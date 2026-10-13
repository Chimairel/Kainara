import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import authenticate from '@/middleware/auth';
import { requireVerifiedUser } from '@/middleware/userPrerequisites';
import validateZodBody from '@/middleware/validateZod';
import { asyncHandler } from '@/middleware/errorHandler';
import { supportRequestSchema } from '@/validation/support.schemas';
import { sendSupportRequest } from '@/services/support.service';
import type { AuthenticatedRequest } from '@/types';

const router = Router();
router.post('/requests', authenticate, requireVerifiedUser,
  rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false,
    keyGenerator: (req: AuthenticatedRequest) => req.user!.userId,
    message: { success: false, error: 'You have sent several requests. Please wait an hour, or email support directly.', errorCode: 'SUPPORT_RATE_LIMITED' },
  }),
  validateZodBody(supportRequestSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await sendSupportRequest(req.user!.userId, req.body);
    res.status(202).json({ success: true, data });
  }));
export default router;

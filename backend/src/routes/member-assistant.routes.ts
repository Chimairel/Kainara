import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import authenticate from '@/middleware/auth';
import requireRole from '@/middleware/rbac';
import { requireUserPrerequisites } from '@/middleware/userPrerequisites';
import { validateZodBody, validateZodRequest } from '@/middleware/validateZod';
import { z } from 'zod';
import { asyncHandler } from '@/middleware/errorHandler';
import { assistantInputSchema } from '@/domain/member-assistant.policy';
import { MemberAssistantService } from '@/services/member-assistant.service';
import { AppError } from '@/errors/AppError';
import type { AuthenticatedRequest } from '@/types';

const router = Router();
router.use(authenticate, requireRole('USER'), requireUserPrerequisites({ emailVerified: true, onboardingDone: true, currentConsent: true }));
router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
router.get('/', asyncHandler(async (req: AuthenticatedRequest, res) => {
  res.json({ success: true, data: await MemberAssistantService.status(req.user!.userId) });
}));
router.get('/requests/:requestKey', rateLimit({ windowMs: 60000, limit: 30, standardHeaders: true, legacyHeaders: false,
  keyGenerator: req => (req as AuthenticatedRequest).user!.userId }),
validateZodRequest({ params: z.object({ requestKey: z.uuid() }).strict() }), asyncHandler(async (req: AuthenticatedRequest, res) => {
  res.json({ success: true, data: await MemberAssistantService.recover(req.user!.userId, req.params.requestKey) });
}));
router.post('/messages', rateLimit({
  windowMs: 60000, limit: 30, standardHeaders: true, legacyHeaders: false,
  keyGenerator: req => (req as AuthenticatedRequest).user!.userId,
  handler: (req, res) => {
    const retryAt = (req as typeof req & { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime ?? new Date(Date.now() + 60000);
    res.status(429).json({ success: false, error: 'Please wait before sending more messages.',
      errorCode: 'ASSISTANT_TOO_FAST', retryAt: retryAt.toISOString() });
  },
}), validateZodBody(assistantInputSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  try {
    res.json({ success: true, data: await MemberAssistantService.message(req.user!.userId, req.body) });
  } catch (error) {
    // Preserve actionable, sanitized provider-capacity messages; global errors remain generic.
    if (error instanceof AppError) {
      const retryAt = (error as AppError & { retryAt?: Date }).retryAt;
      if (retryAt) res.set('Retry-After', String(Math.max(1, Math.ceil((+retryAt - Date.now()) / 1000))));
      res.status(error.statusCode).json({ success: false, error: error.message, errorCode: error.errorCode, retryAt: retryAt?.toISOString() });
      return;
    }
    throw error;
  }
}));
export default router;

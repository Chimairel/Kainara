import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import type { AuthenticatedRequest } from '@/types';
import { AdminTestAccountsService } from '@/services/admin-test-accounts.service';
import { parseCreationRequest, testAccountRequestSchema } from '@/services/dev-test-accounts/admin-policy';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';

const router = Router();
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
router.get('/', (_req, res) => res.json({ success: true, data: AdminTestAccountsService.capabilities() }));
router.use((_req, res, next) => {
  if (!AdminTestAccountsService.capabilities().available)
    return res.status(404).json({ success: false, error: 'Test account creation is unavailable.' });
  next();
});
router.use(
  rateLimit({
    windowMs: 15 * 60_000,
    limit: 20,
    keyGenerator: (req: AuthenticatedRequest) => req.user!.userId,
    message: { success: false, error: 'Too many test account requests. Try again later.' },
  })
);
router.post('/preview', async (req: AuthenticatedRequest, res) => {
  try {
    const request = testAccountRequestSchema.parse(req.body);
    return res.json({ success: true, data: await AdminTestAccountsService.preview(req.user!.userId, request) });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error:
        error instanceof ZodError
          ? error.issues[0]?.message
          : sanitizeErrorMessage(error, 'Test accounts could not be previewed.'),
    });
  }
});
router.post('/', async (req: AuthenticatedRequest, res) => {
  try {
    const { request, previewToken } = parseCreationRequest(req.body);
    const data = await AdminTestAccountsService.create(req.user!.userId, request, previewToken);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error:
        error instanceof ZodError
          ? error.issues[0]?.message
          : sanitizeErrorMessage(error, 'Test accounts could not be created. Preview again before retrying.'),
    });
  }
});
export default router;

import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@/middleware/errorHandler';
import { validateZodBody } from '@/middleware/validateZod';
import type { AuthenticatedRequest } from '@/types';
import { naraAnswerSchema } from '@/domain/nara-answer.policy';
import { NaraAnswerService } from '@/services/nara-answer.service';

const router = Router();
router.use((_req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
});
const revision = z.object({ revision: z.number().int().min(0) }).strict();
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await NaraAnswerService.list() });
  })
);
router.post(
  '/',
  validateZodBody(naraAnswerSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    res.status(201).json({ success: true, data: await NaraAnswerService.create(req.user!.userId, req.body) });
  })
);
router.patch(
  '/:id',
  validateZodBody(revision.extend({ draft: naraAnswerSchema })),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    res.json({
      success: true,
      data: await NaraAnswerService.update(req.user!.userId, req.params.id, req.body.revision, 'save', req.body.draft),
    });
  })
);
for (const action of ['publish', 'unpublish', 'delete'] as const)
  router.post(
    `/:id/${action}`,
    validateZodBody(revision),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      res.json({
        success: true,
        data: await NaraAnswerService.update(req.user!.userId, req.params.id, req.body.revision, action),
      });
    })
  );
export default router;

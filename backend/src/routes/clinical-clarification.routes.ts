import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@/middleware/errorHandler';
import { validateZodRequest } from '@/middleware/validateZod';
import { ClinicalClarificationService } from '@/services/clinical-clarification.service';
import {
  answerClarificationSchema,
  publishClarificationSchema,
  resolveClarificationSchema,
} from '@/domain/clinical-clarification.policy';
import type { AuthenticatedRequest } from '@/types';

/** Mounted only after existing authentication, role and staff credential middleware. */
export function clinicalClarificationRouter(role: 'member' | 'rnd') {
  const router = Router();
  const id = z.string().min(1).max(191);
  if (role === 'member') {
    router.post(
      '/clinical-clarifications/:id/answers',
      validateZodRequest({ params: z.object({ id }).strict(), body: answerClarificationSchema }),
      asyncHandler(async (req: AuthenticatedRequest, res) => {
        res.setHeader('Cache-Control', 'private, no-store');
        res.json({
          success: true,
          data: await ClinicalClarificationService.answer(req.user!.userId, req.params.id, req.body),
        });
      })
    );
  } else {
    router.post(
      '/profile-reviews/:userId/clarifications',
      validateZodRequest({ params: z.object({ userId: id }).strict(), body: publishClarificationSchema }),
      asyncHandler(async (req: AuthenticatedRequest, res) => {
        res.setHeader('Cache-Control', 'private, no-store');
        res.json({
          success: true,
          data: await ClinicalClarificationService.publish(req.nutritionistProfileId!, req.params.userId, req.body),
        });
      })
    );
    router.post(
      '/profile-reviews/:userId/clarifications/:id/resolve',
      validateZodRequest({ params: z.object({ userId: id, id }).strict(), body: resolveClarificationSchema }),
      asyncHandler(async (req: AuthenticatedRequest, res) => {
        res.setHeader('Cache-Control', 'private, no-store');
        res.json({
          success: true,
          data: await ClinicalClarificationService.resolve(
            req.nutritionistProfileId!,
            req.params.userId,
            req.params.id,
            req.body
          ),
        });
      })
    );
  }
  return router;
}

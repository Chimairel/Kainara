import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@/middleware/errorHandler';
import { validateZodRequest } from '@/middleware/validateZod';
import { ClinicalClarificationService } from '@/services/clinical-clarification.service';
import {
  answerClarificationSchema,
  publishClarificationSchema,
  publishMealClarificationSchema,
  resolveClarificationSchema,
} from '@/domain/clinical-clarification.policy';
import type { AuthenticatedRequest } from '@/types';
import { MealClarificationService } from '@/services/meal-clarification.service';
import { ClinicalProfileProposalService } from '@/services/clinical-profile-proposal.service';
import { publishProfileProposalSchema, respondProfileProposalSchema } from '@/domain/clinical-profile-proposal.policy';

/** Mounted only after existing authentication, role and staff credential middleware. */
export function clinicalClarificationRouter(role: 'member' | 'rnd') {
  const router = Router();
  const id = z.string().min(1).max(191);
  if (role === 'member') {
    router.get('/meal-clarifications', asyncHandler(async (req: AuthenticatedRequest, res) => {
      res.setHeader('Cache-Control', 'private, no-store');
      res.json({ success: true, data: await ClinicalClarificationService.list(req.user!.userId, undefined, undefined, { purpose: 'MEAL' }) });
    }));
    router.post(
      '/clinical-profile-proposals/:id/respond',
      validateZodRequest({ params: z.object({ id }).strict(), body: respondProfileProposalSchema }),
      asyncHandler(async (req: AuthenticatedRequest, res) => {
        res.json({
          success: true,
          data: await ClinicalProfileProposalService.respond(req.user!.userId, req.params.id, req.body),
        });
      })
    );
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
    router.post('/queue/:id/clarifications/:formId/resolve',
      validateZodRequest({ params: z.object({ id, formId: id }).strict(),
        body: resolveClarificationSchema.extend({ expectedContextKey: z.string().regex(/^[a-f0-9]{64}$/) }).strict() }),
      asyncHandler(async (req: AuthenticatedRequest, res) => {
        res.setHeader('Cache-Control', 'private, no-store');
        res.json({ success: true, data: await MealClarificationService.resolve(req.nutritionistProfileId!, req.params.id, req.params.formId, req.body) });
      }));
    router.post(
      '/queue/:id/clarifications',
      validateZodRequest({ params: z.object({ id }).strict(), body: publishMealClarificationSchema }),
      asyncHandler(async (req: AuthenticatedRequest, res) => {
        res.setHeader('Cache-Control', 'private, no-store');
        res.json({ success: true, data: await MealClarificationService.publish(req.nutritionistProfileId!, req.params.id, req.body) });
      })
    );
    router.post(
      '/profile-reviews/:userId/proposals',
      validateZodRequest({ params: z.object({ userId: id }).strict(), body: publishProfileProposalSchema }),
      asyncHandler(async (req: AuthenticatedRequest, res) => {
        res.json({
          success: true,
          data: await ClinicalProfileProposalService.publish(req.nutritionistProfileId!, req.params.userId, req.body),
        });
      })
    );
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

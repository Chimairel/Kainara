import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@/middleware/errorHandler';
import { validateZodRequest } from '@/middleware/validateZod';
import type { AuthenticatedRequest } from '@/types';
import { ConditionClearanceService } from '@/services/condition-clearance.service';
import { conditionRuleDraftSchema } from '@/validation/condition-rule-draft.schemas';
import { NutritionRuleManagementService } from '@/services/nutrition-rule-management.service';

/** Mounted behind existing role/credential guards. Admins cannot activate clinical policies. */
export function nutritionRuleManagementRouter(role: 'ADMIN' | 'NUTRITIONIST') {
  const router = Router();
  router.get('/', asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await NutritionRuleManagementService.list() });
  }));
  router.get('/:id', validateZodRequest({ params: z.object({ id: z.string().max(100) }) }), asyncHandler(async (req, res) => {
    res.json({ success: true, data: await NutritionRuleManagementService.detail(req.params.id) });
  }));
  router.post('/', validateZodRequest({ body: conditionRuleDraftSchema }), asyncHandler(async (req, res) => {
    const data = await NutritionRuleManagementService.draft((req as AuthenticatedRequest).user!.userId, req.body);
    res.status(201).json({ success: true, data });
  }));
  if (role === 'NUTRITIONIST') router.post('/:id/:action', validateZodRequest({ params: z.object({ id: z.string().max(100), action: z.enum(['impact', 'approve', 'decline', 'suspend']) }), body: z.object({ reason: z.string().trim().min(10).max(1000) }).strict() }), asyncHandler(async (req, res) => {
    const reviewer = (req as AuthenticatedRequest).nutritionistProfileId!;
    const data = req.params.action === 'impact' ? await ConditionClearanceService.generateRulesetImpact(reviewer, req.params.id) :
      req.params.action === 'suspend' ? await ConditionClearanceService.suspendRuleset(reviewer, req.params.id, req.body.reason) :
      await ConditionClearanceService.approveRulesetVersion({ nutritionistProfileId: reviewer, policyVersionId: req.params.id,
        decision: req.params.action === 'approve' ? 'APPROVE' : 'REJECT', rationale: req.body.reason });
    res.json({ success: true, data });
  }));
  return router;
}

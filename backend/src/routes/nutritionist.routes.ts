import { Router, Response } from 'express';
import { z } from 'zod';
import authenticate from '@/middleware/auth';
import requireRole from '@/middleware/rbac';
import { AuthenticatedRequest } from '@/types';
import { NutritionistService } from '@/services/nutritionist.service';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';
import requireEligibleNutritionist from '@/middleware/nutritionistEligibility';
import { certifyMealLibrarySafetySchema } from '@/domain/meal-library-safety-review.schema';
import { prepareLibraryNutritionEvidenceSchema } from '@/domain/library-nutrition-evidence.schema';
import {
  prepareLibraryNutritionEvidence,
  searchLibraryCompositionFoods,
} from '@/services/nutritionist-library-nutrition-evidence.service';
import validateZodBody, { validateZodRequest } from '@/middleware/validateZod';
import {
  libraryMealEditSchema,
  nutritionistReviewActionSchema,
  regenerateCandidateSchema,
  replaceAndApproveSchema,
} from '@/validation/nutritionist.schemas';
import { isNutritionistReviewConflict } from '@/domain/nutritionist-review-http.policy';
import { OutsideMealReviewService } from '@/services/outside-meal-review.service';
import { ObservedMealService } from '@/services/observed-meal.service';
import {
  outsideMealReviewBodySchema,
  outsideMealReviewParamsSchema,
  observedMealAdmissionSchema,
} from '@/validation/user-action.schemas';
import { asyncHandler } from '@/middleware/errorHandler';
import { ClearanceDecisionValue, ClinicalEvidenceArea, HealthConditionType, RuleApprovalDecision } from '@prisma/client';
import { ConditionClearanceService } from '@/services/condition-clearance.service';
import { ClinicalEvidenceService } from '@/services/clinical-evidence.service';
import { ClinicalProfileReviewService } from '@/services/clinical-profile-review.service';
import { flagMealApproval, getMealApprovalCaseDetails, listDueProfileApprovals, listMealApprovals, recheckConditionApproval, recheckProfileApproval } from '@/services/meal-approval-lifecycle.service';
import { clinicalDocumentIdParamsSchema, clinicalDocumentReviewSchema } from '@/validation/clinical-evidence.schemas';
import { MealBaseVerificationService } from '@/services/meal-base-verification.service';
import { flagWholeMeal, releaseWholeMeal } from '@/services/meal-wide-flag.service';
import { NutritionistWorkCountsService } from '@/services/nutritionist-work-counts.service';

const router = Router();

// Apply auth + NUTRITIONIST role restriction
router.use(authenticate);
router.use(requireRole('NUTRITIONIST'));
router.use(requireEligibleNutritionist);

const mealVerificationParams = z.object({
  kind: z.enum(['LIBRARY_MEAL', 'RAW_RECIPE', 'GENERATED_RECIPE']),
  id: z.string().min(1),
}).strict();
const mealVerificationDecision = z.object({
  decision: z.enum(['VERIFIED', 'REJECTED']),
  rationale: z.string().trim().min(10).max(1000),
}).strict();
const profileReviewParams = z.object({ userId: z.string().min(1) }).strict();
const profileReviewDecision = z.object({
  decision: z.enum(['APPROVED', 'DECLINED', 'REQUEST_DOCUMENT']),
  notes: z.string().trim().min(10).max(2000),
  area: z.nativeEnum(ClinicalEvidenceArea).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.decision === 'REQUEST_DOCUMENT' && !value.area) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['area'], message: 'Select the clinical area for the document request.' });
  }
});

router.get('/review-work-counts', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: await NutritionistWorkCountsService.get(req.nutritionistProfileId!) });
}));

router.get('/profile-reviews', asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: await ClinicalProfileReviewService.queue() });
}));
router.get('/profile-reviews/:userId', validateZodRequest({ params: profileReviewParams }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({ success: true, data: await ClinicalProfileReviewService.detail(req.params.userId) });
  }));
router.post('/profile-reviews/:userId/decision',
  validateZodRequest({ params: profileReviewParams, body: profileReviewDecision }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({ success: true, data: await ClinicalProfileReviewService.decide(
      req.nutritionistProfileId!, req.params.userId, req.body.decision, req.body.notes, req.body.area
    ) });
  }));

router.get('/meal-verification', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const data = await MealBaseVerificationService.list(req.nutritionistProfileId!);
  res.json({ success: true, data });
}));
router.post('/meal-verification/:kind/:id/claim', validateZodRequest({ params: mealVerificationParams }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = await MealBaseVerificationService.claim(req.nutritionistProfileId!, req.params.kind as 'LIBRARY_MEAL' | 'RAW_RECIPE' | 'GENERATED_RECIPE', req.params.id);
    res.json({ success: true, data });
  }));
router.post('/meal-verification/:kind/:id/release', validateZodRequest({ params: mealVerificationParams }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await MealBaseVerificationService.release(req.nutritionistProfileId!, req.params.kind as 'LIBRARY_MEAL' | 'RAW_RECIPE' | 'GENERATED_RECIPE', req.params.id);
    res.json({ success: true });
  }));
router.post('/meal-verification/:kind/:id/decision', validateZodRequest({ params: mealVerificationParams, body: mealVerificationDecision }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = await MealBaseVerificationService.decide(req.nutritionistProfileId!, req.params.kind as 'LIBRARY_MEAL' | 'RAW_RECIPE' | 'GENERATED_RECIPE', req.params.id, req.body.decision, req.body.rationale);
    res.json({ success: true, data });
  }));

router.get(
  '/outside-meal-reviews',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = await OutsideMealReviewService.queue(req.nutritionistProfileId!);
    res.status(200).json({ success: true, data });
  })
);

router.get(
  '/observed-meal-submissions',
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    res.status(200).json({ success: true, data: await ObservedMealService.pending() });
  })
);

router.post(
  '/observed-meal-submissions/:id/admit',
  validateZodRequest({ params: outsideMealReviewParamsSchema, body: observedMealAdmissionSchema }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = await ObservedMealService.admit(req.nutritionistProfileId!, req.params.id, req.body);
    res.status(200).json({ success: true, data });
  })
);

router.post(
  '/outside-meal-reviews/:id/claim',
  validateZodRequest({ params: outsideMealReviewParamsSchema }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = await OutsideMealReviewService.claim(req.nutritionistProfileId!, req.params.id);
    res.status(200).json({ success: true, data });
  })
);

router.patch(
  '/outside-meal-reviews/:id',
  validateZodRequest({ params: outsideMealReviewParamsSchema, body: outsideMealReviewBodySchema }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const data = await OutsideMealReviewService.resolve(req.nutritionistProfileId!, req.params.id, req.body);
    res.status(200).json({ success: true, data });
  })
);

router.get(
  '/outside-meal-reviews/:id/image',
  validateZodRequest({ params: outsideMealReviewParamsSchema }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const image = await OutsideMealReviewService.imageForClaimedReview(req.nutritionistProfileId!, req.params.id);
    res.setHeader('Content-Type', image.mime);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(image.buffer);
  })
);

/**
 * GET /api/nutritionist/queue
 * Returns the review queue (assigned first, sorted by confidence flag).
 */
router.get('/queue', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const queue = await NutritionistService.getReviewQueue(req.nutritionistProfileId!);
    return res.status(200).json({ success: true, data: queue });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve review queue.') });
  }
});

router.get(
  '/clinical-evidence',
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    res.json({ success: true, data: await ClinicalEvidenceService.queue() });
  })
);
router.get(
  '/clinical-evidence/:id',
  validateZodRequest({ params: clinicalDocumentIdParamsSchema }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({
      success: true,
      data: await ClinicalEvidenceService.claimDetail(req.nutritionistProfileId!, req.params.id),
    });
  })
);
router.get(
  '/clinical-evidence/:id/file',
  validateZodRequest({ params: clinicalDocumentIdParamsSchema }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const file = await ClinicalEvidenceService.fileForClaimedReview(
      req.nutritionistProfileId!,
      req.user!.userId,
      req.params.id
    );
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.buffer);
  })
);
router.patch(
  '/clinical-evidence/:id',
  validateZodRequest({ params: clinicalDocumentIdParamsSchema, body: clinicalDocumentReviewSchema }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.json({
      success: true,
      data: await ClinicalEvidenceService.review({
        nutritionistProfileId: req.nutritionistProfileId!,
        actorUserId: req.user!.userId,
        documentId: req.params.id,
        ...req.body,
      }),
    });
  })
);

router.get('/governance/queue', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const view = req.query.view === 'disputed' ? 'disputed' : 'audit';
    const data = await ConditionClearanceService.getGovernanceQueue(req.nutritionistProfileId!, view);
    return res.json({ success: true, data });
  } catch (error: unknown) {
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve governance queue.') });
  }
});

const decisionSchema = z.object({
  decision: z.nativeEnum(ClearanceDecisionValue),
  rationale: z.string().trim().max(1000).optional(),
});

router.post(
  '/library/:id/condition-clearances',
  validateZodBody(
    decisionSchema.extend({
      condition: z.nativeEnum(HealthConditionType).refine((value) => value !== HealthConditionType.NONE),
      userScopeId: z.string().trim().min(1).optional().nullable(),
    })
  ),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await ConditionClearanceService.submitManualDecision({
        nutritionistProfileId: req.nutritionistProfileId!,
        mealLibraryId: req.params.id,
        ...req.body,
      });
      return res.json({ success: true, data });
    } catch (error: unknown) {
      return res.status(422).json({ success: false, error: sanitizeErrorMessage(error, 'Clearance decision failed.') });
    }
  }
);

router.post(
  '/condition-clearances/:id/resolve',
  validateZodBody(decisionSchema.extend({ rationale: z.string().trim().min(1).max(1000) })),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await ConditionClearanceService.resolveDispute({
        nutritionistProfileId: req.nutritionistProfileId!,
        clearanceId: req.params.id,
        ...req.body,
      });
      return res.json({ success: true, data });
    } catch (error: unknown) {
      return res.status(422).json({ success: false, error: sanitizeErrorMessage(error, 'Dispute resolution failed.') });
    }
  }
);

router.post(
  '/condition-clearances/:id/suspend',
  validateZodBody(z.object({ reason: z.string().trim().min(3).max(240) })),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await ConditionClearanceService.suspendClearance(
        req.nutritionistProfileId!,
        req.params.id,
        req.body.reason
      );
      return res.json({ success: true, data });
    } catch (error: unknown) {
      return res.status(422).json({ success: false, error: sanitizeErrorMessage(error, 'Suspension failed.') });
    }
  }
);

router.post(
  '/review/:id/dispute-resolution',
  validateZodBody(
    z.object({
      decision: z.enum(['APPROVE', 'REJECT']),
      rationale: z.string().trim().min(3).max(1000),
    })
  ),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await NutritionistService.resolveMealPlanDispute(
        req.nutritionistProfileId!,
        req.params.id,
        req.body.decision,
        req.body.rationale
      );
      return res.json({ success: true, data });
    } catch (error: unknown) {
      return res.status(422).json({ success: false, error: sanitizeErrorMessage(error, 'Adjudication failed.') });
    }
  }
);

router.post('/rule-policies/:id/impact', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await ConditionClearanceService.generateRulesetImpact(req.nutritionistProfileId!, req.params.id);
    return res.json({ success: true, data });
  } catch (error: unknown) {
    return res.status(422).json({ success: false, error: sanitizeErrorMessage(error, 'Impact analysis failed.') });
  }
});

router.post(
  '/rule-policies/:id/decisions',
  validateZodBody(
    z.object({
      decision: z.nativeEnum(RuleApprovalDecision),
      rationale: z.string().trim().max(1000).optional(),
    })
  ),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await ConditionClearanceService.approveRulesetVersion({
        nutritionistProfileId: req.nutritionistProfileId!,
        policyVersionId: req.params.id,
        ...req.body,
      });
      return res.json({ success: true, data });
    } catch (error: unknown) {
      return res.status(422).json({ success: false, error: sanitizeErrorMessage(error, 'Ruleset decision failed.') });
    }
  }
);

router.post(
  '/rule-policies/:id/suspend',
  validateZodBody(z.object({ reason: z.string().trim().min(3).max(240) })),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data = await ConditionClearanceService.suspendRuleset(
        req.nutritionistProfileId!,
        req.params.id,
        req.body.reason
      );
      return res.json({ success: true, data });
    } catch (error: unknown) {
      return res.status(422).json({ success: false, error: sanitizeErrorMessage(error, 'Ruleset suspension failed.') });
    }
  }
);

/**
 * GET /api/nutritionist/queue/:id
 * Fetches a non-claiming review preview. A separate POST acquires the lock.
 */
router.get('/queue/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const mealPlanId = req.params.id;
    const result = await NutritionistService.getReviewCardDetails(req.nutritionistProfileId!, mealPlanId);
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    const message = sanitizeErrorMessage(error, 'Failed to retrieve review card details.');
    if (message.includes('not found')) {
      return res.status(404).json({ success: false, error: message });
    }
    if (isNutritionistReviewConflict(message)) {
      return res.status(409).json({ success: false, error: message });
    }
    return res.status(500).json({ success: false, error: message });
  }
});

router.post('/queue/:id/claim', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await NutritionistService.getReviewCardDetails(req.nutritionistProfileId!, req.params.id, true);
    return res.status(200).json({ success: true, data: result });
  } catch (error: unknown) {
    const message = sanitizeErrorMessage(error, 'Could not claim this review.');
    return res.status(isNutritionistReviewConflict(message) ? 409 : 422).json({ success: false, error: message });
  }
});

router.post('/queue/:id/release', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await NutritionistService.releaseReviewClaim(req.nutritionistProfileId!, req.params.id);
    return res.status(200).json({ success: true, data: result });
  } catch (error: unknown) {
    return res
      .status(409)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Could not release this review.') });
  }
});

router.get(
  '/queue/:id/clinical-evidence/:documentId/file',
  validateZodRequest({
    params: z.object({ id: z.string().min(1).max(200), documentId: z.string().min(1).max(200) }).strict(),
  }),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const file = await ClinicalEvidenceService.fileForClaimedMealReview(
      req.nutritionistProfileId!,
      req.user!.userId,
      req.params.id,
      req.params.documentId
    );
    res.setHeader('Content-Type', file.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(file.buffer);
  })
);

/**
 * PATCH /api/nutritionist/review/:id
 * Approve or reject a meal plan.
 * Body: { action: 'approve' | 'reject', note?: string }
 */
router.patch(
  '/review/:id',
  validateZodBody(nutritionistReviewActionSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { action, note, updates } = req.body;
      const mealPlanId = req.params.id;

      if (action === 'approve') {
        const result = await NutritionistService.approveMealPlan(req.nutritionistProfileId!, mealPlanId, note, updates);
        return res.status(200).json({ success: true, data: result });
      } else if (action === 'reject') {
        if (!note) return res.status(400).json({ success: false, error: 'Rejection reason is required.' });
        const result = await NutritionistService.rejectMealPlan(req.nutritionistProfileId!, mealPlanId, note);
        return res.status(200).json({ success: true, data: result });
      } else {
        return res.status(400).json({ success: false, error: 'Action must be "approve" or "reject".' });
      }
    } catch (error: any) {
      const msg = sanitizeErrorMessage(error, 'Failed to process review action.');
      if (isNutritionistReviewConflict(msg)) {
        return res.status(409).json({ success: false, error: msg });
      }
      return res.status(500).json({ success: false, error: msg });
    }
  }
);

/**
 * POST /api/nutritionist/review/:id/regenerate-candidate
 * Generates an in-flight AI replacement candidate for a rejected meal slot
 * based on negative constraint reasoning.
 */
router.post(
  '/review/:id/regenerate-candidate',
  validateZodBody(regenerateCandidateSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const mealPlanId = req.params.id;
      const { reason } = req.body;
      const candidate = await NutritionistService.generateReplacementCandidate(
        req.nutritionistProfileId!,
        mealPlanId,
        reason
      );
      return res.status(200).json({ success: true, data: candidate });
    } catch (error: any) {
      const msg = sanitizeErrorMessage(error, 'Failed to generate replacement candidate.');
      if (isNutritionistReviewConflict(msg)) {
        return res.status(409).json({ success: false, error: msg });
      }
      return res.status(500).json({ success: false, error: msg });
    }
  }
);

/**
 * POST /api/nutritionist/review/:id/replace-and-approve
 * Atomically replaces the rejected meal with the approved candidate,
 * certifying the replacement immediately for zero-pending patient delivery.
 */
router.post(
  '/review/:id/replace-and-approve',
  validateZodBody(replaceAndApproveSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const mealPlanId = req.params.id;
      const result = await NutritionistService.replaceAndApproveMealPlan(
        req.nutritionistProfileId!,
        mealPlanId,
        req.body
      );
      return res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      const msg = sanitizeErrorMessage(error, 'Failed to replace and approve meal.');
      if (isNutritionistReviewConflict(msg)) {
        return res.status(409).json({ success: false, error: msg });
      }
      return res.status(500).json({ success: false, error: msg });
    }
  }
);

/**
 * GET /api/nutritionist/library
 * Browse the MealLibrary with search, filters, and pagination.
 */
router.get('/library', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, mealType, conditionTag, status, verifiedByMe, adminDraftsOnly, page, limit } = req.query;
    const library = await NutritionistService.getMealLibraryWithFilters(req.user!.userId, {
      search: search as string,
      mealType: mealType as string,
      conditionTag: conditionTag as string,
      status: status as string,
      verifiedByMe: verifiedByMe === 'true',
      adminDraftsOnly: adminDraftsOnly === 'true',
      page: page ? parseInt(page as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    return res.status(200).json({ success: true, data: library });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve meal library.') });
  }
});

router.get('/library-coverage', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const coverage = await NutritionistService.getMealLibraryCoverage();
    return res.status(200).json({ success: true, data: coverage });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve meal-library coverage.') });
  }
});

router.get('/library/composition-foods', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const source = req.query.source === 'USDA_FDC' ? 'USDA_FDC' : 'FNRI';
    const foods = await searchLibraryCompositionFoods(String(req.query.search ?? ''), source);
    return res.status(200).json({ success: true, data: foods });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to search food records.') });
  }
});

router.post(
  '/library/:id/nutrition-evidence/prepare',
  validateZodBody(prepareLibraryNutritionEvidenceSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await prepareLibraryNutritionEvidence(req.nutritionistProfileId!, req.params.id, req.body);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      const message = sanitizeErrorMessage(error, 'Failed to prepare nutrition evidence.');
      const status =
        message.includes('conflict') || message.includes('Flagged or archived')
          ? 409
          : message.includes('Only a currently verified')
            ? 403
            : message.includes('not found')
              ? 404
              : 422;
      return res.status(status).json({ success: false, error: message });
    }
  }
);

/**
 * POST /api/nutritionist/library/:id/safety-evidence/certify
 * Certify one exact current evidence revision after strict server validation.
 */
router.post(
  '/library/:id/safety-evidence/certify',
  validateZodBody(certifyMealLibrarySafetySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const meal = await NutritionistService.certifyLibraryMealSafety(
        req.nutritionistProfileId!,
        req.params.id,
        req.body
      );
      return res.status(200).json({ success: true, data: meal });
    } catch (error: any) {
      const message = sanitizeErrorMessage(error, 'Failed to certify meal safety evidence.');
      if (message.includes('revision conflict') || message.includes('Flagged or archived')) {
        return res.status(409).json({ success: false, error: message });
      }
      if (message.includes('requires') || message.includes('must be resolved')) {
        return res.status(422).json({ success: false, error: message });
      }
      if (message.includes('Only a currently verified')) {
        return res.status(403).json({ success: false, error: message });
      }
      if (message.includes('not found')) {
        return res.status(404).json({ success: false, error: message });
      }
      return res.status(500).json({ success: false, error: message });
    }
  }
);

/**
 * GET /api/nutritionist/library/:id
 * Retrieve details of a single library meal.
 */
router.get('/library/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const meal = await NutritionistService.getLibraryMeal(req.params.id);
    if (!meal) return res.status(404).json({ success: false, error: 'Meal not found.' });
    return res.status(200).json({ success: true, data: meal });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve library meal details.') });
  }
});

router.get('/library/:id/approvals', async (req: AuthenticatedRequest, res: Response) => {
  try {
    return res.status(200).json({ success: true, data: await listMealApprovals(req.params.id) });
  } catch (error) {
    return res.status(404).json({ success: false, error: sanitizeErrorMessage(error, 'Approvals unavailable.') });
  }
});

const mealFlagReasonSchema = z.object({ reason: z.string().trim().min(10).max(1000) }).strict();
const mealFlagReleaseSchema = z.object({ rationale: z.string().trim().min(10).max(1000) }).strict();
router.post('/library/:id/flag', validateZodBody(mealFlagReasonSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await flagWholeMeal(req.nutritionistProfileId!, req.params.id, req.body.reason);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(409).json({ success: false, error: sanitizeErrorMessage(error, 'Could not flag meal.') });
  }
});
router.post('/library/:id/release-flag', validateZodBody(mealFlagReleaseSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await releaseWholeMeal(req.nutritionistProfileId!, req.params.id, req.body.rationale);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(409).json({ success: false, error: sanitizeErrorMessage(error, 'Could not release meal flag.') });
  }
});

router.get('/approval-follow-ups', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: await listDueProfileApprovals(req.nutritionistProfileId!) });
}));

router.get('/library/:id/approvals/:kind/:approvalId', async (req: AuthenticatedRequest, res: Response) => {
  const kind = req.params.kind;
  if (kind !== 'PROFILE' && kind !== 'CONDITION') {
    return res.status(400).json({ success: false, error: 'Unknown approval type.' });
  }
  try {
    const data = await getMealApprovalCaseDetails({
      mealLibraryId: req.params.id,
      kind,
      approvalId: req.params.approvalId,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    const message = sanitizeErrorMessage(error, 'Could not load approval details.');
    return res.status(message.includes('not found') ? 404 : 500).json({ success: false, error: message });
  }
});

const scopedFlagSchema = z.object({
  kind: z.enum(['PROFILE', 'CONDITION']),
  approvalId: z.string().min(1),
  reason: z.string().trim().min(10).max(1000),
}).strict();
router.post('/library/:id/approvals/flag', validateZodBody(scopedFlagSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = await flagMealApproval({
      nutritionistProfileId: req.nutritionistProfileId!,
      mealLibraryId: req.params.id,
      ...req.body,
    });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(409).json({ success: false, error: sanitizeErrorMessage(error, 'Could not flag approval.') });
  }
});

const approvalRecheckSchema = z.object({
  kind: z.enum(['PROFILE', 'CONDITION']),
  rationale: z.string().trim().min(10).max(1000),
}).strict();
router.post('/library/:id/approvals/:approvalId/recheck', validateZodBody(approvalRecheckSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const input = {
      nutritionistProfileId: req.nutritionistProfileId!,
      mealLibraryId: req.params.id,
      approvalId: req.params.approvalId,
    };
    const data = req.body.kind === 'CONDITION'
      ? await recheckConditionApproval({ ...input, rationale: req.body.rationale })
      : await recheckProfileApproval({ ...input, rationale: req.body.rationale });
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(409).json({ success: false, error: sanitizeErrorMessage(error, 'Could not recheck approval.') });
  }
});

/**
 * PATCH /api/nutritionist/library/:id
 * Edit library meal details (Only original verifier or admin override).
 */
router.patch(
  '/library/:id',
  validateZodBody(libraryMealEditSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const updated = await NutritionistService.editLibraryMeal(
        req.user!.userId,
        req.user!.role,
        req.params.id,
        req.body
      );
      return res.status(200).json({ success: true, data: updated });
    } catch (error: any) {
      return res
        .status(400)
        .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to edit library meal.') });
    }
  }
);

/**
 * DELETE /api/nutritionist/library/:id
 * Delete a meal from library (Only original verifier or admin override).
 */
router.delete('/library/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    await NutritionistService.deleteLibraryMeal(req.user!.userId, req.user!.role, req.params.id);
    return res.status(200).json({ success: true, message: 'Meal deleted successfully.' });
  } catch (error: any) {
    return res
      .status(400)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to delete library meal.') });
  }
});

/**
 * GET /api/nutritionist/approved
 * Returns all meal plans this nutritionist has approved.
 */
router.get('/approved', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const approved = await NutritionistService.getApprovedMeals(req.nutritionistProfileId!);
    return res.status(200).json({ success: true, data: approved });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve approved meals.') });
  }
});

/**
 * POST /api/nutritionist/approved/:id/reusable-draft
 * Explicit second action: prepare a deduplicated reusable evidence draft from
 * a meal already approved for one user. This does not certify safety.
 */
router.post('/approved/:id/reusable-draft', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await NutritionistService.createReusableLibraryDraft(req.nutritionistProfileId!, req.params.id);
    return res.status(200).json({ success: true, data: result });
  } catch (error: unknown) {
    const message = sanitizeErrorMessage(error, 'Failed to prepare reusable meal evidence.');
    if (message.includes('Only the nutritionist')) return res.status(403).json({ success: false, error: message });
    if (message.includes('not found')) return res.status(404).json({ success: false, error: message });
    if (message.includes('Only a current') || message.includes('requires at least')) {
      return res.status(422).json({ success: false, error: message });
    }
    return res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/nutritionist/profile
 */
router.get('/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const profile = await NutritionistService.getProfile(req.user!.userId);
    return res.status(200).json({ success: true, data: { ...profile, user: req.user } });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to retrieve nutritionist profile.') });
  }
});

/**
 * PATCH /api/nutritionist/profile
 */
router.patch('/profile', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { bio, specialization } = req.body;
    const profile = await NutritionistService.updateProfile(req.user!.userId, { bio, specialization });
    return res.status(200).json({ success: true, data: profile });
  } catch (error: any) {
    return res
      .status(500)
      .json({ success: false, error: sanitizeErrorMessage(error, 'Failed to update nutritionist profile.') });
  }
});

export default router;

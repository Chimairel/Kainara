import { Router } from 'express';
import authenticate from '@/middleware/auth';
import requireRole from '@/middleware/rbac';
import { ProgressController } from '@/controllers/progress.controller';
import { requireUserPrerequisites } from '@/middleware/userPrerequisites';
import { validateZodBody } from '@/middleware/validateZod';
import { weightEntryBodySchema } from '@/validation/user-action.schemas';

const router = Router();

// Apply auth + USER role restrict on all /api/user/progress routes
router.use(authenticate);
router.use(requireRole('USER'));
router.use(requireUserPrerequisites({ emailVerified: true, onboardingDone: true, currentConsent: true }));

/**
 * Route: POST /api/user/progress/weight
 * Description: Logs a new weight value, updating profile and recalculating target calories.
 */
// A measurement is a profile input, not a meal action. It may stale an unaccepted report.
router.post('/weight', validateZodBody(weightEntryBodySchema), ProgressController.logWeight);

/**
 * Route: GET /api/user/progress/history
 * Description: Fetches historical weight logs and daily nutritional adherence scores.
 */
router.get('/history', ProgressController.getHistory);

export default router;

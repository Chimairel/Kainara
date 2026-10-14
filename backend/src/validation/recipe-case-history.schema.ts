import { z } from 'zod';

export const recipeCaseHistoryQuery = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  approvalsOnly: z.enum(['true']).optional(),
  condition: z.enum(['DIABETES', 'HYPERTENSION', 'KIDNEY_DISEASE', 'HEART_CONDITION', 'PREGNANT', 'NONE', 'UNRECORDED']).optional(),
}).strict();

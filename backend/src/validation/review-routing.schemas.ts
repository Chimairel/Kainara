import { z } from 'zod';

export const expertiseSchema = z
  .object({
    conditions: z.array(z.enum(['DIABETES', 'HYPERTENSION', 'KIDNEY_DISEASE', 'HEART_CONDITION', 'PREGNANT'])).max(5),
    experienceYears: z.number().int().min(0).max(70).nullable(),
    evidence: z.string().trim().min(10).max(1500),
  })
  .strict()
  .refine((data) => !data.conditions.length || data.experienceYears !== null, {
    message: 'Verify years of experience before assigning expertise.',
    path: ['experienceYears'],
  });

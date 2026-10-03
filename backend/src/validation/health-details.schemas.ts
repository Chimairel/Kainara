import { z } from 'zod';
import { ClinicalEvidenceArea } from '@prisma/client';

const answer = z.string().trim().min(2, 'Enter details, none, or unknown.').max(2000);
export const healthDetailsSchema = z
  .object({
    area: z.nativeEnum(ClinicalEvidenceArea),
    expectedSafetyRevision: z.number().int().nonnegative(),
    conditionDetails: answer.min(10, 'Describe the declared condition or restriction.'),
    medications: answer,
    dietaryAdvice: answer,
    recentSymptoms: answer,
    measurements: z.string().trim().max(1000).default(''),
  })
  .strict();
export type HealthDetailsInput = z.infer<typeof healthDetailsSchema>;

export function isCurrentHealthDetails(value: unknown, safetyRevision: number): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    row.formVersion === 'HEALTH_DETAILS_V1' &&
    row.safetyRevision === safetyRevision &&
    typeof row.conditionDetails === 'string' &&
    row.conditionDetails.trim().length >= 10 &&
    ['medications', 'dietaryAdvice', 'recentSymptoms'].every(
      (field) => typeof row[field] === 'string' && (row[field] as string).trim().length >= 2
    )
  );
}

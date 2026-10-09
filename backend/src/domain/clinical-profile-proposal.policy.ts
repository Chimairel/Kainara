import { z } from 'zod';
import { clarificationContextSchema } from './clinical-clarification.policy';
import { SAFETY_ENTRY_DOMAINS, SAFETY_ENTRY_PROVENANCE } from './safety-intake.policy';
import { healthDetailsSchema } from '@/validation/health-details.schemas';

export const profileChangesSchema = z
  .object({
    domains: z
      .array(
        z
          .object({
            domain: z.enum(SAFETY_ENTRY_DOMAINS),
            entries: z
              .array(
                z
                  .object({ value: z.string().trim().min(1).max(300), provenance: z.enum(SAFETY_ENTRY_PROVENANCE) })
                  .strict()
              )
              .min(1)
              .max(32),
          })
          .strict()
      )
      .max(4)
      .default([]),
    healthDetails: z
      .array(healthDetailsSchema.omit({ expectedSafetyRevision: true }))
      .max(8)
      .default([]),
  })
  .strict()
  .refine((v) => v.domains.length + v.healthDetails.length > 0, 'Specify a correction.')
  .refine((v) => new Set(v.domains.map((d) => d.domain)).size === v.domains.length, 'Duplicate section.')
  .refine((v) => new Set(v.healthDetails.map((d) => d.area)).size === v.healthDetails.length, 'Duplicate health area.');

export const publishProfileProposalSchema = clarificationContextSchema
  .extend({
    changes: profileChangesSchema,
    rationale: z.string().trim().min(10).max(2000),
    evidence: z
      .array(z.object({ formId: z.string().min(1).max(191), responseId: z.string().min(1).max(191) }).strict())
      .max(12)
      .refine((items) => new Set(items.map((i) => i.formId)).size === items.length)
      .default([]),
    replacesProposalId: z.string().min(1).max(191).optional(),
    requestKey: z.uuid(),
  })
  .strict();
export const respondProfileProposalSchema = clarificationContextSchema
  .extend({
    decision: z.enum(['ACCEPT', 'REQUEST_CORRECTION']),
    note: z.string().trim().max(2000).default(''),
    requestKey: z.uuid(),
  })
  .strict()
  .refine((v) => v.decision !== 'REQUEST_CORRECTION' || v.note.length >= 10, 'Explain the requested correction.');
export type ProfileChanges = z.infer<typeof profileChangesSchema>;
export function proposalDisplayStatus(
  proposal: { status: string; profileRevision: number; scopeKey: string },
  current: { profileRevision: number; scopeKey: string }
) {
  if (
    ['PENDING', 'CORRECTION_REQUESTED'].includes(proposal.status) &&
    (proposal.profileRevision !== current.profileRevision || proposal.scopeKey !== current.scopeKey)
  )
    return 'SUPERSEDED';
  return proposal.status;
}

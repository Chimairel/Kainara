import { z } from 'zod';

const questionBase = {
  id: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,40}$/)
    .refine((id) => !['__proto__', 'prototype', 'constructor'].includes(id)),
  label: z.string().trim().min(3).max(500),
  required: z.boolean(),
};
export const clarificationQuestionSchema = z.discriminatedUnion('type', [
  z.object({ ...questionBase, type: z.literal('TEXT') }).strict(),
  z
    .object({
      ...questionBase,
      type: z.literal('CHOICE'),
      options: z.array(z.string().trim().min(1).max(120)).min(2).max(8),
    })
    .strict()
    .refine((q) => new Set(q.options).size === q.options.length, 'Choice options must be distinct.'),
]);
export const clarificationQuestionsSchema = z
  .array(clarificationQuestionSchema)
  .min(1)
  .max(12)
  .refine(
    (questions) => new Set(questions.map((q) => q.id)).size === questions.length,
    'Question IDs must be distinct.'
  )
  .refine((questions) => questions.some((q) => q.required), 'Mark at least one question as required.');
export const clarificationContextSchema = z.object({
  profileRevision: z.number().int().min(1),
  scopeKey: z.string().min(1).max(10000),
});
export const publishClarificationSchema = clarificationContextSchema
  .extend({
    title: z.string().trim().min(3).max(160),
    questions: clarificationQuestionsSchema,
    requestKey: z.uuid(),
  })
  .strict();
export const answerClarificationSchema = clarificationContextSchema
  .extend({
    answers: z.record(z.string().max(40), z.string().trim().max(2000)),
    expectedResponseId: z.string().min(1).max(191).nullable(),
    requestKey: z.uuid(),
  })
  .strict();
export const resolveClarificationSchema = clarificationContextSchema
  .extend({
    responseId: z.string().min(1).max(191),
    rationale: z.string().trim().min(10).max(2000),
  })
  .strict();
export type ClarificationQuestion = z.infer<typeof clarificationQuestionSchema>;
export type ClarificationContext = z.infer<typeof clarificationContextSchema>;

/** IDs, units and enum options are explicit; submitted text never becomes a profile classification. */
export function validateClarificationAnswers(
  questions: readonly ClarificationQuestion[],
  answers: Record<string, string>
) {
  if (Object.keys(answers).some((id) => !questions.some((q) => q.id === id))) return false;
  return questions.every((q) => {
    const supplied = Object.prototype.hasOwnProperty.call(answers, q.id) ? answers[q.id] : '';
    if (typeof supplied !== 'string') return false;
    const value = supplied.trim();
    return (
      (!q.required || value.length > 0) &&
      value.length <= 2000 &&
      (!value || q.type !== 'CHOICE' || q.options.includes(value))
    );
  });
}

export function clarificationDisplayState(
  form: ClarificationContext,
  current: ClarificationContext,
  answered: boolean,
  resolved: boolean
) {
  if (form.profileRevision !== current.profileRevision || form.scopeKey !== current.scopeKey) return 'SUPERSEDED';
  return resolved ? 'RESOLVED' : answered ? 'ANSWERED' : 'AWAITING_MEMBER';
}

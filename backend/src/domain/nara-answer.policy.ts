import { z } from 'zod';
import { assistantAiQuestion, assistantDirectAction, normalizeAssistantQuestion } from './member-assistant-information';

export const NARA_ANSWER_PREFIX = 'nara-answer-';
export const NARA_ANSWER_LIMIT = 100;
const question = z.string().trim().min(3).max(240);
const unrelated =
  /\b(politics?|president|elections?|horoscope|celebrity|gambling|write (?:a |some )?code|solve (?:this |a )?equation|ignore (?:all |your )?instructions)\b/u;
const personalClinical = /\b(diagnos\w*|prescrib\w*|dosage|insulin dose|stop (?:my )?medication|cure\w*)\b/u;
const personalPermission =
  /\b(can|may|could) i (eat|have)\b|\b(is|are)\b.*\b(safe|approved|cleared|suitable) for (me|my)\b|\bis it safe\b|\b(pwede|puwede)\b.*\b(kumain|kainin|lahat|sa akin|sakin)\b/u;
const appSubject =
  /\b(kainara|nara|app|account|onboarding|membership|credits?|subscription|profile|report|guidance|meal|meals|plan|planning|grocery|groceries|logging|log|water|weight|reminders?|notifications?|nutritionist|rnd|review|approval|password|login|sign in|check in|support|help|pagkain|plano|tubig|timbang|nutrisyon)\b/u;
const nutritionSubject =
  /\b(nutrition|nutrients?|food|foods|meal|meals|protein|carbohydrates?|carbs?|fats?|fibre|fiber|calories|kcal|hydration|water|vitamins?|minerals?|vegetables?|fruit|rice|pagkain|tubig|gulay|kanin|nutrisyon)\b/u;

/** Curated educational content only. Personal status and AI routing stay authoritative. */
export function naraQuestionAllowed(text: string, category: 'APP_HELP' | 'NUTRITION') {
  if (assistantAiQuestion(text) !== null || assistantDirectAction(text) !== null) return false;
  const normalized = normalizeAssistantQuestion(text);
  return (
    !unrelated.test(normalized) &&
    !personalClinical.test(normalized) &&
    !personalPermission.test(normalized) &&
    (category === 'APP_HELP' ? appSubject : nutritionSubject).test(normalized)
  );
}

export const naraAnswerSchema = z
  .object({
    question,
    variants: z.array(question).max(5).default([]),
    answer: z.string().trim().min(1).max(2500),
    category: z.enum(['APP_HELP', 'NUTRITION']),
  })
  .strict()
  .superRefine((value, ctx) => {
    const questions = [value.question, ...value.variants];
    if (new Set(questions.map(normalizeAssistantQuestion)).size !== questions.length)
      ctx.addIssue({
        code: 'custom',
        path: ['variants'],
        message: 'Each question or alternative phrasing must be different.',
      });
    for (const text of questions)
      if (!naraQuestionAllowed(text, value.category))
        ctx.addIssue({
          code: 'custom',
          path: ['question'],
          message:
            'Use an app-help or general nutrition question. AI commands, personal status, medical clearance and unrelated requests keep their existing routes.',
        });
    if (personalClinical.test(normalizeAssistantQuestion(value.answer)))
      ctx.addIssue({
        code: 'custom',
        path: ['answer'],
        message: 'Instant answers cannot diagnose, prescribe, give dosages or promise a cure.',
      });
  });
export type NaraAnswer = z.infer<typeof naraAnswerSchema>;
export const naraAnswerKeys = (answer: NaraAnswer) =>
  [answer.question, ...answer.variants].map(normalizeAssistantQuestion);
export function matchNaraAnswer(message: string, answers: NaraAnswer[]) {
  const key = normalizeAssistantQuestion(message);
  return (
    answers.find((answer) => naraQuestionAllowed(message, answer.category) && naraAnswerKeys(answer).includes(key)) ??
    null
  );
}

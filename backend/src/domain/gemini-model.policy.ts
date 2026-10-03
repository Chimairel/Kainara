/**
 * Stable Gemini text models used for structured NutriMind generation.
 * Route routine extraction/estimates to Flash-Lite and complex meal composition
 * to full Flash models. This is a task-fit preference, not an uptime guarantee.
 *
 * Keep this list pinned to explicit GA model IDs. Moving aliases such as
 * `gemini-flash-latest` make production behavior and audit evidence drift over
 * time without a corresponding code change.
 */
export const GEMINI_MODEL_SEQUENCE = [
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
] as const;

export const GEMINI_MODEL_TIMEOUT_MS = 15_000;

export type NutriMindGeminiModel = (typeof GEMINI_MODEL_SEQUENCE)[number];

const COMPLEX_MEAL_MODEL_SEQUENCE = [
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
] as const satisfies readonly NutriMindGeminiModel[];

/** Unknown callers use full Flash; a new task must explicitly qualify for Lite. */
export function getGeminiModelSequence(
  usage: { operation?: string; purpose?: string } = {}
): readonly NutriMindGeminiModel[] {
  const routine =
    usage.operation === 'OUTSIDE_MEAL_ESTIMATE' ||
    usage.operation === 'MEAL_PLAN_CORPUS_LOOKUP' ||
    (usage.operation === 'OTHER' &&
      ['FNRI_LOOKUP_ESTIMATE', 'HEALTH_TERM_NORMALIZATION'].includes(usage.purpose ?? ''));
  return routine ? GEMINI_MODEL_SEQUENCE : COMPLEX_MEAL_MODEL_SEQUENCE;
}

/**
 * Gemini 3.6+ deprecates the legacy temperature/top-p/top-k sampling controls.
 * NutriMind only asks the provider for JSON here; Zod remains the authoritative
 * application-level response validator.
 */
export function buildGeminiGenerationConfig() {
  return {
    responseMimeType: 'application/json' as const,
  };
}

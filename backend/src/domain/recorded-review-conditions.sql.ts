import { Prisma } from '@prisma/client';

/** Built-in condition codes only. Never infer historical conditions from today's member profile. */
export function recordedReviewConditionsSql(snapshot: Prisma.Sql) {
  const recorded = Prisma.sql`CASE
    WHEN jsonb_typeof(${snapshot}->'reviewContext'->'clinical'->'conditions') = 'array'
      THEN ${snapshot}->'reviewContext'->'clinical'->'conditions'
    WHEN jsonb_typeof(${snapshot}->'recordedProfile'->'conditions') = 'array'
      THEN ${snapshot}->'recordedProfile'->'conditions'
    WHEN jsonb_typeof(${snapshot}->'conditions') = 'array' THEN ${snapshot}->'conditions'
    ELSE NULL END`;
  return Prisma.sql`(SELECT CASE WHEN jsonb_typeof(saved.conditions) = 'array' THEN (
    SELECT CASE WHEN count(*) = 0 OR bool_or(code = 'NONE') OR count(*) FILTER (
      WHERE code IN ('DIABETES', 'HYPERTENSION', 'KIDNEY_DISEASE', 'HEART_CONDITION', 'PREGNANT')) > 0
      THEN COALESCE(jsonb_agg(DISTINCT code ORDER BY code) FILTER (
        WHERE code IN ('DIABETES', 'HYPERTENSION', 'KIDNEY_DISEASE', 'HEART_CONDITION', 'PREGNANT')), '[]'::jsonb)
      ELSE NULL END
    FROM jsonb_array_elements_text(saved.conditions) codes(code)
  ) ELSE NULL END FROM (SELECT ${recorded} AS conditions) saved)`;
}

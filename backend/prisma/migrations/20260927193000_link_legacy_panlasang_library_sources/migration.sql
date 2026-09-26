-- Existing Panlasang library rows recorded their article URL in the source
-- description. Link only a verbatim, uniquely indexed URL. Name similarity
-- never establishes source identity or clinical approval.
WITH unique_sources AS (
  SELECT "sourceUrl", MIN("id") AS "id"
  FROM "RawRecipeCandidate"
  WHERE "sourceName" = 'PANLASANG_PINOY'
  GROUP BY "sourceUrl"
  HAVING COUNT(*) = 1
), exact_links AS (
  SELECT library."id" AS "libraryId", source."id" AS "sourceId"
  FROM "MealLibrary" AS library
  JOIN unique_sources AS source
    ON source."sourceUrl" = substring(
      library."description" FROM 'Source: (https?://panlasangpinoy\.com/[^[:space:]]+)'
    )
  WHERE library."sourceRawRecipeCandidateId" IS NULL
)
UPDATE "MealLibrary" AS library
SET "sourceRawRecipeCandidateId" = links."sourceId"
FROM exact_links AS links
WHERE library."id" = links."libraryId";

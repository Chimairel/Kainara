ALTER TABLE "MealLibrary" ADD COLUMN "sourceRawRecipeCandidateId" TEXT;
ALTER TABLE "MealPlan" ADD COLUMN "profileApprovalId" TEXT;
ALTER TABLE "MealLibraryProfileApproval"
  ADD COLUMN "reviewDueAt" TIMESTAMP(3) NOT NULL DEFAULT (NOW() + INTERVAL '1 year'),
  ADD COLUMN "flaggedAt" TIMESTAMP(3),
  ADD COLUMN "flagReason" TEXT,
  ADD COLUMN "flaggedByNutritionistId" TEXT,
  ADD COLUMN "scopeSnapshot" JSONB;

CREATE INDEX "MealLibrary_sourceRawRecipeCandidateId_idx" ON "MealLibrary"("sourceRawRecipeCandidateId");
CREATE INDEX "MealPlan_profileApprovalId_idx" ON "MealPlan"("profileApprovalId");
CREATE INDEX "MealLibraryProfileApproval_reviewDueAt_flaggedAt_idx"
  ON "MealLibraryProfileApproval"("reviewDueAt", "flaggedAt");

ALTER TABLE "MealLibrary" ADD CONSTRAINT "MealLibrary_sourceRawRecipeCandidateId_fkey"
  FOREIGN KEY ("sourceRawRecipeCandidateId") REFERENCES "RawRecipeCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_profileApprovalId_fkey"
  FOREIGN KEY ("profileApprovalId") REFERENCES "MealLibraryProfileApproval"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MealLibraryProfileApproval" ADD CONSTRAINT "MealLibraryProfileApproval_flaggedByNutritionistId_fkey"
  FOREIGN KEY ("flaggedByNutritionistId") REFERENCES "NutritionistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing approved plan rows retain their review decisions. Link only rows
-- whose source recipe is unambiguous; unmatched legacy rows remain standalone.
UPDATE "MealLibrary" AS library
SET "sourceRawRecipeCandidateId" = links."sourceRawRecipeCandidateId"
FROM (
  SELECT "libraryMealId", MIN("sourceRawRecipeCandidateId") AS "sourceRawRecipeCandidateId"
  FROM "MealPlan"
  WHERE "libraryMealId" IS NOT NULL AND "sourceRawRecipeCandidateId" IS NOT NULL
  GROUP BY "libraryMealId"
  HAVING COUNT(DISTINCT "sourceRawRecipeCandidateId") = 1
) AS links
WHERE library."id" = links."libraryMealId";

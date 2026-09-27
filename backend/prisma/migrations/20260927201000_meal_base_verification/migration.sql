CREATE TYPE "MealVerificationTargetKind" AS ENUM ('LIBRARY_MEAL', 'RAW_RECIPE', 'GENERATED_RECIPE');
CREATE TYPE "MealVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

CREATE TABLE "MealBaseVerification" (
  "id" TEXT NOT NULL,
  "targetKind" "MealVerificationTargetKind" NOT NULL,
  "targetId" TEXT NOT NULL,
  "revisionKey" VARCHAR(64) NOT NULL,
  "status" "MealVerificationStatus" NOT NULL DEFAULT 'PENDING',
  "claimedByNutritionistId" TEXT,
  "claimedAt" TIMESTAMP(3),
  "reviewedByNutritionistId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rationale" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MealBaseVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MealBaseVerification_targetKind_targetId_revisionKey_key" ON "MealBaseVerification"("targetKind", "targetId", "revisionKey");
CREATE INDEX "MealBaseVerification_status_createdAt_idx" ON "MealBaseVerification"("status", "createdAt");

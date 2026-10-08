ALTER TABLE "NutritionistProfile"
  ADD COLUMN "acceptingReviews" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "verifiedExpertise" "HealthConditionType"[] NOT NULL DEFAULT ARRAY[]::"HealthConditionType"[],
  ADD COLUMN "verifiedExperienceYears" INTEGER,
  ADD COLUMN "expertiseEvidence" VARCHAR(1500),
  ADD COLUMN "expertiseVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "expertiseVerifiedById" TEXT,
  ADD COLUMN "lastRoutingAssignedAt" TIMESTAMP(3);
ALTER TABLE "NutritionistProfile" ADD CONSTRAINT "NutritionistProfile_verifiedExperienceYears_check"
  CHECK ("verifiedExperienceYears" IS NULL OR "verifiedExperienceYears" BETWEEN 0 AND 70);
CREATE TABLE "ReviewRoutingConfig" (
  "id" TEXT PRIMARY KEY DEFAULT 'global', "enabled" BOOLEAN NOT NULL DEFAULT false,
  "enabledAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE "ReviewRoutingEpisode" (
  "id" TEXT PRIMARY KEY, "episodeKey" VARCHAR(200) NOT NULL UNIQUE, "userId" TEXT NOT NULL,
  "safetyRevision" INTEGER NOT NULL, "scopeKey" VARCHAR(64) NOT NULL,
  "conditions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "selectedReviewerIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "firstCycleId" TEXT UNIQUE,
  "stage" VARCHAR(20) NOT NULL DEFAULT 'GENERAL', "reason" VARCHAR(64) NOT NULL,
  "beganAt" TIMESTAMP(3) NOT NULL, "opensAt" TIMESTAMP(3) NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReviewRoutingEpisode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReviewRoutingEpisode_stage_check" CHECK ("stage" IN ('GENERAL', 'SPECIALIST'))
);
CREATE INDEX "ReviewRoutingEpisode_stage_opensAt_idx" ON "ReviewRoutingEpisode"("stage", "opensAt");
CREATE INDEX "ReviewRoutingEpisode_userId_safetyRevision_idx" ON "ReviewRoutingEpisode"("userId", "safetyRevision");
ALTER TABLE "MealPlanCycle" ADD COLUMN "reviewRoutingEpisodeId" TEXT;
ALTER TABLE "MealPlanCycle" ADD CONSTRAINT "MealPlanCycle_reviewRoutingEpisodeId_fkey"
  FOREIGN KEY ("reviewRoutingEpisodeId") REFERENCES "ReviewRoutingEpisode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

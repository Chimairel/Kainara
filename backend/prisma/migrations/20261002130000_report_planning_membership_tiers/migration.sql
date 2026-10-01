CREATE TYPE "MembershipTier" AS ENUM ('LIFESTYLE', 'HEALTH');
ALTER TABLE "MembershipGrant" ADD COLUMN "tier" "MembershipTier" NOT NULL DEFAULT 'HEALTH';
ALTER TABLE "UserProfile" ADD COLUMN "planningReportVersion" INTEGER, ADD COLUMN "firstReportAcknowledgedAt" TIMESTAMP(3);
ALTER TABLE "NutritionReportVersion" ADD COLUMN "confirmationKind" VARCHAR(40) NOT NULL DEFAULT 'PROFILE_UPDATE';
ALTER TABLE "WeeklyCheckin" ADD COLUMN "reportVersion" INTEGER;
-- Preserve the latest actually accepted baseline, including accounts with a newer draft.
UPDATE "UserProfile" p SET "planningReportVersion" = r.version,
  "firstReportAcknowledgedAt" = (SELECT MIN(v."acknowledgedAt") FROM "NutritionReportVersion" v WHERE v."userId" = p."userId")
FROM (SELECT DISTINCT ON ("userId") "userId", version FROM "NutritionReportVersion"
      WHERE "acknowledgedAt" IS NOT NULL ORDER BY "userId", version DESC) r
WHERE r."userId" = p."userId";
ALTER TABLE "UserProfile" ADD CONSTRAINT "planning_report_version_positive" CHECK ("planningReportVersion" IS NULL OR "planningReportVersion" > 0);

ALTER TABLE "MealPlanCycleSnapshot" ADD COLUMN "nutritionReportVersion" INTEGER;

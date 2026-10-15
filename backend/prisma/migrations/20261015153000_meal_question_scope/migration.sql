-- Existing questions retain their original profile-review meaning.
CREATE TYPE "ClarificationPurpose" AS ENUM ('PROFILE', 'MEAL');

ALTER TABLE "ClinicalClarificationForm"
ADD COLUMN "purpose" "ClarificationPurpose" NOT NULL DEFAULT 'PROFILE';

ALTER TABLE "ClinicalClarificationForm"
ADD CONSTRAINT "ClinicalClarificationForm_meal_scope_check"
CHECK ("purpose" <> 'MEAL' OR ("sourceMealPlanId" IS NOT NULL AND "sourceContextKey" IS NOT NULL));

CREATE INDEX "ClinicalClarificationForm_sourceMealPlanId_purpose_createdAt_idx"
ON "ClinicalClarificationForm"("sourceMealPlanId", "purpose", "createdAt");

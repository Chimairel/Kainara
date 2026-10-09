CREATE TABLE "ClinicalProfileReviewEpoch" (
  "userId" TEXT NOT NULL,
  "key" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClinicalProfileReviewEpoch_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "ClinicalProfileReviewEpoch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE "ClinicalClarificationForm"
  ADD COLUMN "sourceMealPlanId" TEXT,
  ADD COLUMN "sourceContextKey" VARCHAR(64),
  ADD CONSTRAINT "ClinicalClarificationForm_sourceMealPlanId_fkey" FOREIGN KEY ("sourceMealPlanId") REFERENCES "MealPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ClinicalClarificationForm_source_context_check" CHECK (
    ("sourceMealPlanId" IS NULL AND "sourceContextKey" IS NULL) OR
    ("sourceMealPlanId" IS NOT NULL AND "sourceContextKey" IS NOT NULL AND "sourceContextKey" ~ '^[a-f0-9]{64}$')
  );
CREATE INDEX "ClinicalClarificationForm_sourceMealPlanId_idx" ON "ClinicalClarificationForm"("sourceMealPlanId");

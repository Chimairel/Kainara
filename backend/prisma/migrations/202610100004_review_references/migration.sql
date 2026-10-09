CREATE TABLE "MealReviewReference" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "policyVersion" VARCHAR(64) NOT NULL,
    "contextKey" VARCHAR(64) NOT NULL,
    "servingKey" VARCHAR(64) NOT NULL,
    "plateFacts" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MealReviewReference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MealReviewReference_decisionId_key" ON "MealReviewReference"("decisionId");
CREATE INDEX "MealReviewReference_match_idx"
    ON "MealReviewReference"("policyVersion", "contextKey", "servingKey", "createdAt");
ALTER TABLE "MealReviewReference" ADD CONSTRAINT "MealReviewReference_decisionId_fkey"
    FOREIGN KEY ("decisionId") REFERENCES "MealPlanReviewDecision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

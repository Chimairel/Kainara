CREATE TABLE "PatientNutritionLimit" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "nutritionistProfileId" TEXT NOT NULL,
  "replacesRuleId" TEXT,
  "condition" "HealthConditionType" NOT NULL,
  "nutrient" "ConditionRuleNutrient" NOT NULL,
  "operator" "ConditionRuleOperator" NOT NULL,
  "threshold" DOUBLE PRECISION NOT NULL,
  "unit" VARCHAR(32) NOT NULL,
  "basis" "ConditionRuleBasis" NOT NULL,
  "severity" "ConditionRuleSeverity" NOT NULL,
  "rationale" TEXT NOT NULL,
  "sourceTitle" VARCHAR(240) NOT NULL,
  "sourceCitation" VARCHAR(1000) NOT NULL,
  "version" INTEGER NOT NULL,
  "scopeKey" VARCHAR(240) NOT NULL,
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validUntil" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PatientNutritionLimit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PatientNutritionLimit_threshold_check" CHECK ("threshold" >= 0 AND "threshold" < 'Infinity'::float8),
  CONSTRAINT "PatientNutritionLimit_dates_check" CHECK ("validUntil" IS NULL OR "validUntil" > "validFrom"),
  CONSTRAINT "PatientNutritionLimit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PatientNutritionLimit_nutritionistProfileId_fkey" FOREIGN KEY ("nutritionistProfileId") REFERENCES "NutritionistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PatientNutritionLimit_replacesRuleId_fkey" FOREIGN KEY ("replacesRuleId") REFERENCES "ConditionNutrientRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PatientNutritionLimit_scope_version" ON "PatientNutritionLimit"("userId", "scopeKey", "version");
CREATE INDEX "PatientNutritionLimit_userId_validFrom_validUntil_idx" ON "PatientNutritionLimit"("userId", "validFrom", "validUntil");
ALTER TABLE "MealPlan" ADD COLUMN "clinicalRuleKey" VARCHAR(64);

-- Preserve diagnoses and support states; an assessment is a separate, nullable record.
ALTER TABLE "SafetyProfileEntry" ADD COLUMN "mealPlanningAssessment" JSONB;

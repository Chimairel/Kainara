-- AlterTable
ALTER TABLE "MealLibrary" ADD COLUMN     "reviewLineageId" TEXT;

-- CreateTable
CREATE TABLE "MealReviewLineage" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "incidentCount" INTEGER NOT NULL DEFAULT 0,
    "everQuarantined" BOOLEAN NOT NULL DEFAULT false,
    "legacyHistoryUnknown" BOOLEAN NOT NULL DEFAULT false,
    "state" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealReviewLineage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealReviewIncident" (
    "id" TEXT NOT NULL,
    "lineageId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "legacy" BOOLEAN NOT NULL DEFAULT false,
    "excludedReviewerIds" JSONB NOT NULL,
    "claimedByNutritionistId" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "MealReviewIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealReviewReport" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorNutritionistId" TEXT,
    "actorSnapshot" JSONB NOT NULL,
    "expectedVersion" TEXT NOT NULL,
    "notes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealReviewReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealReviewDecision" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorSnapshot" JSONB NOT NULL,
    "snapshot" JSONB NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealReviewDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealReviewConfirmation" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "nutritionistId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "resolutions" JSONB NOT NULL,
    "actorSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealReviewConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealBatchImport" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedAt" TIMESTAMP(3),

    CONSTRAINT "MealBatchImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MealReviewLineage_key_key" ON "MealReviewLineage"("key");

-- CreateIndex
CREATE INDEX "MealReviewIncident_state_createdAt_idx" ON "MealReviewIncident"("state", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MealReviewIncident_lineageId_number_key" ON "MealReviewIncident"("lineageId", "number");

-- CreateIndex
CREATE INDEX "MealReviewReport_incidentId_createdAt_idx" ON "MealReviewReport"("incidentId", "createdAt");

-- CreateIndex
CREATE INDEX "MealReviewDecision_incidentId_createdAt_idx" ON "MealReviewDecision"("incidentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MealReviewConfirmation_incidentId_nutritionistId_version_key" ON "MealReviewConfirmation"("incidentId", "nutritionistId", "version");

-- CreateIndex
CREATE INDEX "MealBatchImport_actorUserId_createdAt_idx" ON "MealBatchImport"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "MealReviewIncident" ADD CONSTRAINT "MealReviewIncident_lineageId_fkey" FOREIGN KEY ("lineageId") REFERENCES "MealReviewLineage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealReviewReport" ADD CONSTRAINT "MealReviewReport_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "MealReviewIncident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealReviewDecision" ADD CONSTRAINT "MealReviewDecision_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "MealReviewIncident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealReviewConfirmation" ADD CONSTRAINT "MealReviewConfirmation_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "MealReviewIncident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealLibrary" ADD CONSTRAINT "MealLibrary_reviewLineageId_fkey" FOREIGN KEY ("reviewLineageId") REFERENCES "MealReviewLineage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- New review evidence is append-only. Legacy flag rows retain their existing lifecycle.
CREATE FUNCTION "meal_review_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Recorded meal review evidence is immutable' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER "MealReviewDecision_immutable" BEFORE UPDATE OR DELETE ON "MealReviewDecision" FOR EACH ROW EXECUTE FUNCTION "meal_review_append_only"();
CREATE TRIGGER "MealReviewConfirmation_immutable" BEFORE UPDATE OR DELETE ON "MealReviewConfirmation" FOR EACH ROW EXECUTE FUNCTION "meal_review_append_only"();
CREATE TRIGGER "MealReviewReport_immutable" BEFORE UPDATE OR DELETE ON "MealReviewReport" FOR EACH ROW EXECUTE FUNCTION "meal_review_append_only"();

ALTER TABLE "MealReviewLineage" ADD CONSTRAINT "MealReviewLineage_state_check" CHECK (state IN ('PUBLISHED', 'PENDING_REREVIEW', 'QUARANTINED', 'ARCHIVED'));
ALTER TABLE "MealReviewIncident" ADD CONSTRAINT "MealReviewIncident_state_check" CHECK (state IN ('PENDING_REREVIEW', 'QUARANTINED', 'RELEASED', 'ARCHIVED'));
ALTER TABLE "MealReviewLineage" ADD CONSTRAINT "MealReviewLineage_incident_count_check" CHECK ("incidentCount" >= 0);
CREATE UNIQUE INDEX "MealReviewIncident_one_open_case" ON "MealReviewIncident" ("lineageId") WHERE "closedAt" IS NULL;

-- Existing eligibility code relies on FLAGGED. New versions cannot escape a
-- known lineage hold, including concurrent serving creation and source imports.
CREATE FUNCTION "meal_review_enforce_lineage_hold"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  lineage_key TEXT;
  root_source TEXT;
  root_id TEXT;
  governed "MealReviewLineage"%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."reviewLineageId" IS NOT NULL AND
     (NEW."recipeFamilyId" IS DISTINCT FROM OLD."recipeFamilyId" OR
      NEW."sourceRawRecipeCandidateId" IS DISTINCT FROM OLD."sourceRawRecipeCandidateId" OR
      NEW."reviewLineageId" IS DISTINCT FROM OLD."reviewLineageId") THEN
    RAISE EXCEPTION 'A governed recipe cannot change its review lineage' USING ERRCODE = '23514';
  END IF;
  root_id := COALESCE(NEW."recipeFamilyId", NEW.id);
  IF NEW."recipeFamilyId" IS NOT NULL THEN
    SELECT "sourceRawRecipeCandidateId" INTO root_source FROM "MealLibrary" WHERE id = NEW."recipeFamilyId";
  ELSE
    root_source := NEW."sourceRawRecipeCandidateId";
  END IF;
  lineage_key := CASE WHEN root_source IS NOT NULL THEN 'source:' || root_source ELSE 'recipe:' || root_id END;
  PERFORM pg_advisory_xact_lock(hashtext(lineage_key));
  SELECT * INTO governed FROM "MealReviewLineage" WHERE key = lineage_key;
  IF governed.id IS NOT NULL THEN
    NEW."reviewLineageId" := governed.id;
    IF governed.state = 'ARCHIVED' THEN
      NEW.status := 'ARCHIVED';
    ELSIF governed.state IN ('PENDING_REREVIEW', 'QUARANTINED') AND NEW.status <> 'ARCHIVED' THEN
      NEW.status := 'FLAGGED';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "MealLibrary_lineage_hold" BEFORE INSERT OR UPDATE OF status, "recipeFamilyId", "sourceRawRecipeCandidateId", "reviewLineageId" ON "MealLibrary" FOR EACH ROW EXECUTE FUNCTION "meal_review_enforce_lineage_hold"();

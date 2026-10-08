-- Append-only evidence and a current projection. Legacy context is explicitly unknown.
CREATE TABLE "MealLogAuditRecord" (
  "logId" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "firstRecordedAt" TIMESTAMP(3), "ageGroup" VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',
  membership VARCHAR(24) NOT NULL DEFAULT 'UNKNOWN', "contextVersion" VARCHAR(64) NOT NULL DEFAULT 'LEGACY_UNAVAILABLE',
  "lastActionAt" TIMESTAMP(3), snapshot JSONB NOT NULL, deleted BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX "MealLogAuditRecord_userId_lastActionAt_idx" ON "MealLogAuditRecord"("userId", "lastActionAt");
CREATE TABLE "MealLogAuditEvent" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, sequence BIGSERIAL NOT NULL UNIQUE,
  "logId" TEXT NOT NULL REFERENCES "MealLogAuditRecord"("logId") ON DELETE CASCADE,
  "entityType" VARCHAR(16) NOT NULL, "entityId" TEXT NOT NULL, action VARCHAR(16) NOT NULL,
  "actorUserId" TEXT, "actorRole" VARCHAR(24) NOT NULL, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT (clock_timestamp() AT TIME ZONE 'UTC'),
  reason VARCHAR(2000), before JSONB, after JSONB
);
CREATE INDEX "MealLogAuditEvent_logId_sequence_idx" ON "MealLogAuditEvent"("logId", sequence);

CREATE FUNCTION meal_log_recipe_key(library_id TEXT) RETURNS TEXT LANGUAGE plpgsql STABLE AS $$
DECLARE row_data RECORD; current_id TEXT := library_id; seen TEXT[] := ARRAY[]::TEXT[]; lineage_key TEXT;
BEGIN
  WHILE current_id IS NOT NULL AND NOT current_id = ANY(seen) AND cardinality(seen) < 50 LOOP
    seen := array_append(seen, current_id);
    SELECT "reviewLineageId", "recipeFamilyId", "parentMealId", "sourceRawRecipeCandidateId" INTO row_data FROM "MealLibrary" WHERE id = current_id;
    IF NOT FOUND THEN RETURN NULL; END IF;
    IF row_data."reviewLineageId" IS NOT NULL THEN
      SELECT key INTO lineage_key FROM "MealReviewLineage" WHERE id = row_data."reviewLineageId";
      IF lineage_key IS NOT NULL THEN RETURN lineage_key; END IF;
    END IF;
    IF COALESCE(NULLIF(row_data."recipeFamilyId", current_id), row_data."parentMealId") IS NULL THEN
      RETURN COALESCE('source:' || row_data."sourceRawRecipeCandidateId", 'recipe:' || current_id);
    END IF;
    current_id := COALESCE(NULLIF(row_data."recipeFamilyId", current_id), row_data."parentMealId");
  END LOOP;
  RETURN NULL;
END $$;

CREATE FUNCTION meal_log_audit_snapshot(row_data JSONB) RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'mealName', row_data->'mealName', 'source', row_data->'source', 'status', row_data->'status',
    'calories', row_data->'calories', 'proteinG', row_data->'proteinG', 'carbsG', row_data->'carbsG', 'fatG', row_data->'fatG',
    'dataSource', row_data->'dataSource', 'mealType', row_data->'mealType',
    'loggedForAt', to_char((row_data->>'loggedAt')::timestamp, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'mealDate', to_char(COALESCE(p."scheduledDate", (row_data->>'loggedAt')::timestamp), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'notes', row_data->'notes', 'voidedAt', to_char((row_data->>'voidedAt')::timestamp, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'nutritionCompleteness', row_data->'nutritionCompleteness', 'provisionalCalories', row_data->'provisionalCalories',
    'hasImage', row_data->>'outsideImage' IS NOT NULL,
    'recipeKey', COALESCE(meal_log_recipe_key(p."libraryMealId"), 'source:' || p."sourceRawRecipeCandidateId"),
    'libraryMealId', p."libraryMealId", 'mealPlanId', row_data->'mealPlanId'
  ) FROM (SELECT 1) one LEFT JOIN "MealPlan" p ON p.id = row_data->>'mealPlanId'
$$;

CREATE FUNCTION outside_item_audit_snapshot(row_data JSONB) RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'id', row_data->'id', 'mealLogId', row_data->'mealLogId', 'position', row_data->'position',
    'name', row_data->'name', 'portionGrams', row_data->'portionGrams', 'source', row_data->'source',
    'nutritionStatus', row_data->'nutritionStatus', 'includedInTotals', row_data->'includedInTotals',
    'calories', row_data->'calories', 'proteinG', row_data->'proteinG', 'carbsG', row_data->'carbsG',
    'fatG', row_data->'fatG', 'calorieLow', row_data->'calorieLow', 'calorieHigh', row_data->'calorieHigh',
    'foodItemId', row_data->'foodItemId', 'mealLibraryId', row_data->'mealLibraryId', 'currentRevision', row_data->'currentRevision',
    'recipeKey', COALESCE(meal_log_recipe_key(row_data->>'mealLibraryId'), 'food:' || (row_data->>'foodItemId')))
$$;

-- Historical rows retain their recorded log values, not today's profile or subscription.
INSERT INTO "MealLogAuditRecord"("logId", "userId", snapshot)
SELECT id, "userId", meal_log_audit_snapshot(to_jsonb(l)) FROM "MealLog" l;

CREATE FUNCTION meal_log_audit_membership(member_id TEXT, envelope JSONB, at_time TIMESTAMP) RETURNS TEXT LANGUAGE plpgsql STABLE AS $$
DECLARE paid_health BOOLEAN; paid_lifestyle BOOLEAN; trial_start TIMESTAMP;
BEGIN
  IF envelope IS NULL OR NOT envelope ? 'membershipEnabled' THEN RETURN 'UNKNOWN'; END IF;
  IF envelope->>'membershipEnabled' <> 'true' THEN RETURN 'DISABLED'; END IF;
  SELECT EXISTS(SELECT 1 FROM "MembershipGrant" g WHERE g."userId" = member_id AND g.tier = 'HEALTH'
    AND g.source IN ('PAID_INVOICE', 'ADMIN_ADJUSTMENT') AND g."verifiedAt" <= at_time
    AND g."effectiveFrom" <= at_time AND g."effectiveUntil" > at_time
    AND (g."revokedAt" IS NULL OR g."revokedAt" > at_time)) INTO paid_health;
  SELECT EXISTS(SELECT 1 FROM "MembershipGrant" g WHERE g."userId" = member_id AND g.tier = 'LIFESTYLE'
    AND g.source IN ('PAID_INVOICE', 'ADMIN_ADJUSTMENT') AND g."verifiedAt" <= at_time
    AND g."effectiveFrom" <= at_time AND g."effectiveUntil" > at_time
    AND (g."revokedAt" IS NULL OR g."revokedAt" > at_time)) INTO paid_lifestyle;
  IF envelope->>'checkoutHash' IS NOT NULL THEN
    SELECT paid_health OR EXISTS(SELECT 1 FROM "MembershipTestCheckout" c WHERE c."userId" = member_id
      AND c.tier = 'HEALTH' AND c.status = 'PAID' AND c."accountHash" = envelope->>'checkoutHash'
      AND c."verifiedAt" <= at_time AND c."revokedAt" IS NULL AND c."effectiveFrom" <= at_time
      AND LEAST(c."effectiveUntil", COALESCE(c."supersededAt", c."effectiveUntil")) > at_time) INTO paid_health;
    SELECT paid_lifestyle OR EXISTS(SELECT 1 FROM "MembershipTestCheckout" c WHERE c."userId" = member_id
      AND c.tier = 'LIFESTYLE' AND c.status = 'PAID' AND c."accountHash" = envelope->>'checkoutHash'
      AND c."verifiedAt" <= at_time AND c."revokedAt" IS NULL AND c."effectiveFrom" <= at_time
      AND LEAST(c."effectiveUntil", COALESCE(c."supersededAt", c."effectiveUntil")) > at_time) INTO paid_lifestyle;
  END IF;
  IF paid_health THEN RETURN 'HEALTH'; END IF;
  SELECT "trialStartedAt" INTO trial_start FROM "MembershipAccount" WHERE "userId" = member_id;
  IF trial_start IS NULL THEN RETURN 'TRIAL_PENDING'; END IF;
  IF trial_start <= at_time AND trial_start + interval '30 days' > at_time THEN RETURN 'FREE_HEALTH'; END IF;
  IF paid_lifestyle THEN RETURN 'LIFESTYLE'; END IF;
  RETURN 'FREE';
END $$;

CREATE FUNCTION capture_meal_log_audit() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE old_snapshot JSONB; new_snapshot JSONB; envelope JSONB; log_id TEXT; member_id TEXT;
  actor_id TEXT; actor_role TEXT; at_time TIMESTAMP := clock_timestamp() AT TIME ZONE 'UTC'; recorded_age INT;
BEGIN
  envelope := NULLIF(current_setting('kainara.meal_log_write', true), '')::jsonb;
  IF TG_TABLE_NAME = 'MealLog' THEN
    log_id := COALESCE(NEW.id, OLD.id); member_id := COALESCE(NEW."userId", OLD."userId");
    IF TG_OP <> 'INSERT' THEN SELECT snapshot INTO old_snapshot FROM "MealLogAuditRecord" WHERE "logId" = log_id; END IF;
    IF TG_OP <> 'DELETE' THEN
      new_snapshot := meal_log_audit_snapshot(to_jsonb(NEW));
      IF TG_OP = 'UPDATE' AND OLD."mealPlanId" IS NOT NULL AND NEW."mealPlanId" IS NULL THEN
        new_snapshot := new_snapshot || jsonb_build_object('recipeKey', old_snapshot->'recipeKey',
          'libraryMealId', old_snapshot->'libraryMealId', 'mealDate', old_snapshot->'mealDate');
      END IF;
    END IF;
  ELSE
    log_id := COALESCE(NEW."mealLogId", OLD."mealLogId");
    SELECT "userId" INTO member_id FROM "MealLogAuditRecord" WHERE "logId" = log_id;
    IF TG_OP <> 'INSERT' THEN old_snapshot := outside_item_audit_snapshot(to_jsonb(OLD)); END IF;
    IF TG_OP <> 'DELETE' THEN
      new_snapshot := outside_item_audit_snapshot(to_jsonb(NEW));
    END IF;
  END IF;
  -- Account erasure cascades remove audit records too; never retain private meal evidence after erasure.
  IF member_id IS NULL OR NOT EXISTS(SELECT 1 FROM "User" WHERE id = member_id) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_TABLE_NAME = 'MealLog' AND TG_OP = 'INSERT' THEN
    SELECT age INTO recorded_age FROM "UserProfile" WHERE "userId" = member_id;
    INSERT INTO "MealLogAuditRecord"("logId", "userId", "firstRecordedAt", "ageGroup", membership, "contextVersion", snapshot)
    VALUES(log_id, member_id, at_time,
      CASE WHEN recorded_age BETWEEN 18 AND 24 THEN '18-24' WHEN recorded_age BETWEEN 25 AND 34 THEN '25-34'
        WHEN recorded_age BETWEEN 35 AND 44 THEN '35-44' WHEN recorded_age BETWEEN 45 AND 120 THEN '45+' ELSE 'UNKNOWN' END,
      meal_log_audit_membership(member_id, envelope, at_time), 'RECORDED_CONTEXT_V1', new_snapshot);
  END IF;
  IF old_snapshot IS NOT DISTINCT FROM new_snapshot THEN RETURN NEW; END IF;
  actor_id := envelope->>'actorUserId';
  SELECT role::text INTO actor_role FROM "User" WHERE id = actor_id;
  IF actor_role IS NULL THEN actor_id := NULL; actor_role := 'SYSTEM'; END IF;
  IF TG_TABLE_NAME = 'MealLog' THEN
    UPDATE "MealLogAuditRecord" SET snapshot = COALESCE(new_snapshot, old_snapshot),
      deleted = TG_OP = 'DELETE', "lastActionAt" = at_time WHERE "logId" = log_id;
  ELSE
    UPDATE "MealLogAuditRecord" SET "lastActionAt" = at_time WHERE "logId" = log_id;
  END IF;
  INSERT INTO "MealLogAuditEvent"("logId", "entityType", "entityId", action, "actorUserId", "actorRole", "occurredAt", reason, before, after)
  VALUES(log_id, CASE WHEN TG_TABLE_NAME = 'MealLog' THEN 'LOG' ELSE 'ITEM' END, COALESCE(NEW.id, OLD.id),
    TG_OP, actor_id, actor_role, at_time, left(envelope->>'reason', 2000), old_snapshot, new_snapshot);
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;

CREATE FUNCTION protect_meal_log_audit() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF TG_TABLE_NAME = 'MealLogAuditRecord' THEN
      IF NOT EXISTS(SELECT 1 FROM "User" WHERE id = OLD."userId") THEN RETURN OLD; END IF;
    ELSE
      IF NOT EXISTS(SELECT 1 FROM "MealLogAuditRecord" WHERE "logId" = OLD."logId") THEN RETURN OLD; END IF;
    END IF;
  END IF;
  IF TG_TABLE_NAME = 'MealLogAuditRecord' AND TG_OP = 'UPDATE' AND pg_trigger_depth() > 1
    AND (to_jsonb(NEW) - ARRAY['snapshot','deleted','lastActionAt']) = (to_jsonb(OLD) - ARRAY['snapshot','deleted','lastActionAt']) THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' AND pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Meal log audit evidence is immutable' USING ERRCODE = '23514';
END $$;
CREATE TRIGGER "MealLog_capture_audit" BEFORE INSERT OR UPDATE OR DELETE ON "MealLog" FOR EACH ROW EXECUTE FUNCTION capture_meal_log_audit();
CREATE TRIGGER "OutsideMealLogItem_capture_audit" BEFORE INSERT OR UPDATE OR DELETE ON "OutsideMealLogItem" FOR EACH ROW EXECUTE FUNCTION capture_meal_log_audit();
CREATE TRIGGER "MealLogAuditRecord_protect" BEFORE INSERT OR UPDATE OR DELETE ON "MealLogAuditRecord" FOR EACH ROW EXECUTE FUNCTION protect_meal_log_audit();
CREATE TRIGGER "MealLogAuditEvent_protect" BEFORE INSERT OR UPDATE OR DELETE ON "MealLogAuditEvent" FOR EACH ROW EXECUTE FUNCTION protect_meal_log_audit();

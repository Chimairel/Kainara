ALTER TABLE "AuditEvent" ADD COLUMN "actorRole" "Role", ADD COLUMN "actorName" VARCHAR(200);

-- Capture staff attribution in the same transaction without extra application reads.
-- Member names are not copied into this staff audit snapshot.
CREATE FUNCTION nutrimind_audit_actor_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE account_role "Role"; account_name TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW."actorRole" := OLD."actorRole";
    NEW."actorName" := OLD."actorName";
  ELSE
    SELECT "role", "name" INTO account_role, account_name FROM "User" WHERE "id" = NEW."actorUserId";
    NEW."actorRole" := account_role;
    NEW."actorName" := CASE WHEN account_role IN ('ADMIN', 'NUTRITIONIST') THEN LEFT(account_name, 200) ELSE NULL END;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER audit_actor_snapshot BEFORE INSERT OR UPDATE ON "AuditEvent"
FOR EACH ROW EXECUTE FUNCTION nutrimind_audit_actor_snapshot();
CREATE INDEX "AuditEvent_actorRole_createdAt_id_idx" ON "AuditEvent"("actorRole", "createdAt", "id");

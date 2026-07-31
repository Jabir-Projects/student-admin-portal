-- Convert the retired ADMIN compatibility role without changing any existing
-- capability assignment. The enclosing transaction makes audit, conversion,
-- session invalidation, invariant checks, and enum replacement atomic.
BEGIN;

LOCK TABLE "User" IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE "UserCapabilityAssignment" IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMPORARY TABLE "v2_3_admin_conversion_snapshot"
ON COMMIT DROP
AS
SELECT
  legacy."id",
  legacy."sessionVersion",
  count(assignment."capability")::INTEGER AS "capabilityCount"
FROM "User" legacy
LEFT JOIN "UserCapabilityAssignment" assignment
  ON assignment."userId" = legacy."id"
WHERE legacy."role" = 'ADMIN'
GROUP BY legacy."id", legacy."sessionVersion";

DO $admin_conversion_preflight$
BEGIN
  IF EXISTS (SELECT 1 FROM "v2_3_admin_conversion_snapshot")
    AND NOT EXISTS (
      SELECT 1
      FROM "UserCapabilityAssignment" assignment
      JOIN "User" manager ON manager."id" = assignment."userId"
      WHERE assignment."capability" = 'MANAGE_STAFF_CAPABILITIES'
        AND manager."status" = 'ACTIVE'
        AND manager."role" IN ('STAFF', 'ADMIN')
    )
  THEN
    RAISE EXCEPTION
      'ADMIN-to-STAFF conversion requires an active capability manager';
  END IF;
END
$admin_conversion_preflight$;

INSERT INTO "AuditLog"
  ("id", "actorId", "action", "entityType", "entityId", "metadata")
SELECT
  md5(
    'v2-3-admin-to-staff-conversion:' || snapshot."id"::text
  )::UUID,
  NULL,
  'LEGACY_ADMIN_CONVERTED_TO_STAFF',
  'User',
  snapshot."id"::text,
  jsonb_build_object(
    'previousRole', 'ADMIN',
    'newRole', 'STAFF',
    'preservedCapabilityCount', snapshot."capabilityCount"
  )
FROM "v2_3_admin_conversion_snapshot" snapshot;

UPDATE "User" subject
SET
  "role" = 'STAFF',
  "sessionVersion" = subject."sessionVersion" + 1,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "v2_3_admin_conversion_snapshot" snapshot
WHERE subject."id" = snapshot."id";

DO $admin_conversion_verification$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "v2_3_admin_conversion_snapshot" snapshot
    LEFT JOIN "User" subject ON subject."id" = snapshot."id"
    WHERE subject."role" IS DISTINCT FROM 'STAFF'
      OR subject."sessionVersion" IS DISTINCT FROM snapshot."sessionVersion" + 1
  ) THEN
    RAISE EXCEPTION 'ADMIN-to-STAFF role conversion verification failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "v2_3_admin_conversion_snapshot" snapshot
    WHERE snapshot."capabilityCount" <> (
      SELECT count(*)::INTEGER
      FROM "UserCapabilityAssignment" assignment
      WHERE assignment."userId" = snapshot."id"
    )
  ) THEN
    RAISE EXCEPTION 'ADMIN capability preservation verification failed';
  END IF;

  IF EXISTS (SELECT 1 FROM "v2_3_admin_conversion_snapshot")
    AND NOT EXISTS (
      SELECT 1
      FROM "UserCapabilityAssignment" assignment
      JOIN "User" manager ON manager."id" = assignment."userId"
      WHERE assignment."capability" = 'MANAGE_STAFF_CAPABILITIES'
        AND manager."status" = 'ACTIVE'
        AND manager."role" = 'STAFF'
    )
  THEN
    RAISE EXCEPTION
      'ADMIN-to-STAFF conversion did not preserve an active capability manager';
  END IF;
END
$admin_conversion_verification$;

ALTER TYPE "UserRole" RENAME TO "UserRole_legacy";
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'STAFF');
ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "UserRole"
  USING ("role"::text::"UserRole");
DROP TYPE "UserRole_legacy";

COMMIT;

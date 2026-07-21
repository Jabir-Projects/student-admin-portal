-- Fail before changing data when Phase 2 values cannot be converted safely.
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "StudentProfile" WHERE "academicYear" NOT IN (1, 2, 3)) THEN
    RAISE EXCEPTION 'Unsupported StudentProfile.academicYear value; expected only 1, 2, or 3';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "User" GROUP BY lower(btrim("email")) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Email normalization would create duplicate values';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "StudentProfile" GROUP BY upper(btrim("studentNumber")) HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Student Number normalization would create duplicate values';
  END IF;
END $$;

-- Preserve the existing name data with a true column rename.
ALTER TABLE "User" RENAME COLUMN "displayName" TO "fullName";

-- Normalize existing identifiers only after collision checks pass.
UPDATE "User" SET "email" = lower(btrim("email"))
WHERE "email" <> lower(btrim("email"));
UPDATE "StudentProfile" SET "studentNumber" = upper(btrim("studentNumber"))
WHERE "studentNumber" <> upper(btrim("studentNumber"));

CREATE TYPE "AccountStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'DISABLED');
CREATE TYPE "AcademicYear" AS ENUM ('FOUNDATION', 'YEAR_1', 'YEAR_2', 'YEAR_3', 'MASTER_1', 'MASTER_2');

-- The temporary ACTIVE default backfills all existing legitimate Phase 2 users.
ALTER TABLE "User"
  ADD COLUMN "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "approvedAt" TIMESTAMPTZ(3),
  ADD COLUMN "approvedById" UUID,
  ADD COLUMN "disabledAt" TIMESTAMPTZ(3),
  ADD COLUMN "disabledById" UUID;
ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT 'PENDING_APPROVAL';

ALTER TABLE "StudentProfile"
  ALTER COLUMN "academicYear" TYPE "AcademicYear"
  USING (
    CASE "academicYear"
      WHEN 1 THEN 'YEAR_1'
      WHEN 2 THEN 'YEAR_2'
      WHEN 3 THEN 'YEAR_3'
    END
  )::"AcademicYear";

ALTER TABLE "User"
  ADD CONSTRAINT "User_email_normalized_check"
    CHECK ("email" = lower(btrim("email"))),
  ADD CONSTRAINT "User_approval_tracking_pair_check"
    CHECK (("approvedAt" IS NULL) = ("approvedById" IS NULL)),
  ADD CONSTRAINT "User_disabling_tracking_pair_check"
    CHECK (("disabledAt" IS NULL) = ("disabledById" IS NULL)),
  ADD CONSTRAINT "User_status_tracking_check"
    CHECK (
      ("status" = 'PENDING_APPROVAL' AND "approvedAt" IS NULL AND "disabledAt" IS NULL)
      OR ("status" = 'ACTIVE' AND "disabledAt" IS NULL)
      OR ("status" = 'DISABLED' AND "disabledAt" IS NOT NULL)
    );

ALTER TABLE "StudentProfile"
  ADD CONSTRAINT "StudentProfile_studentNumber_normalized_check"
    CHECK ("studentNumber" = upper(btrim("studentNumber")));

CREATE INDEX "User_status_role_createdAt_idx" ON "User"("status", "role", "createdAt");
CREATE INDEX "User_approvedById_approvedAt_idx" ON "User"("approvedById", "approvedAt");
CREATE INDEX "User_disabledById_disabledAt_idx" ON "User"("disabledById", "disabledAt");

ALTER TABLE "User" ADD CONSTRAINT "User_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_disabledById_fkey"
  FOREIGN KEY ("disabledById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;

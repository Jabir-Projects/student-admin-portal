-- Add only the V2-3 authorization foundation. Capability data backfill and
-- ADMIN-to-STAFF conversion require separate product-owner approval.
BEGIN;

CREATE TYPE "Capability" AS ENUM (
  'MANAGE_STUDENT_ACCOUNTS',
  'REACTIVATE_STUDENT_ACCOUNTS',
  'MANAGE_STAFF_ACCOUNTS',
  'MANAGE_STAFF_CAPABILITIES',
  'PROCESS_REQUESTS',
  'MANAGE_REQUEST_CATEGORIES',
  'GENERATE_DOCUMENTS',
  'RELEASE_DOCUMENTS',
  'REVOKE_DOCUMENTS',
  'REGISTRY_IMPORT_UPLOAD',
  'REGISTRY_IMPORT_APPROVE',
  'FINANCE_IMPORT_UPLOAD',
  'FINANCE_IMPORT_APPROVE',
  'VIEW_FINANCE',
  'VIEW_AUDIT_LOG',
  'EXPORT_STUDENT_DATA',
  'EXPORT_REQUEST_DATA',
  'EXPORT_FINANCE_DATA'
);

ALTER TABLE "User"
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "User_sessionVersion_nonnegative_check"
    CHECK ("sessionVersion" >= 0);

CREATE TABLE "UserCapabilityAssignment" (
  "userId" UUID NOT NULL,
  "capability" "Capability" NOT NULL,
  "grantedById" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserCapabilityAssignment_pkey"
    PRIMARY KEY ("userId", "capability"),
  CONSTRAINT "UserCapabilityAssignment_no_self_grant_check"
    CHECK ("grantedById" IS NULL OR "grantedById" <> "userId")
);

CREATE INDEX "UserCapabilityAssignment_capability_userId_idx"
  ON "UserCapabilityAssignment"("capability", "userId");
CREATE INDEX "UserCapabilityAssignment_grantedById_createdAt_idx"
  ON "UserCapabilityAssignment"("grantedById", "createdAt");

ALTER TABLE "UserCapabilityAssignment"
  ADD CONSTRAINT "UserCapabilityAssignment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "UserCapabilityAssignment_grantedById_fkey"
    FOREIGN KEY ("grantedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;

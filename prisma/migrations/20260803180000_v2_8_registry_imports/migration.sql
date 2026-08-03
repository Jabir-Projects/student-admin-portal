-- V2-8 additive controlled Student Registry import staging and lifecycle.
BEGIN;

CREATE TYPE "ImportType" AS ENUM ('REGISTRY');
CREATE TYPE "ImportBatchStatus" AS ENUM (
  'UPLOADED',
  'VALIDATED',
  'PENDING_APPROVAL',
  'APPROVED',
  'REJECTED',
  'FAILED'
);
CREATE TYPE "RegistryImportRowValidation" AS ENUM ('VALID', 'INVALID');
CREATE TYPE "RegistryImportOperation" AS ENUM ('CREATE', 'UPDATE');

CREATE TABLE "ImportBatch" (
  "id" UUID NOT NULL,
  "type" "ImportType" NOT NULL DEFAULT 'REGISTRY',
  "status" "ImportBatchStatus" NOT NULL DEFAULT 'UPLOADED',
  "uploaderId" UUID NOT NULL,
  "reviewerId" UUID,
  "checksum" CHAR(64) NOT NULL,
  "originalFilename" VARCHAR(255) NOT NULL,
  "originalByteSize" INTEGER NOT NULL,
  "totalRows" INTEGER NOT NULL,
  "validRows" INTEGER NOT NULL,
  "invalidRows" INTEGER NOT NULL,
  "rejectionReason" VARCHAR(500),
  "failureCode" VARCHAR(120),
  "uploadedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validatedAt" TIMESTAMPTZ(3),
  "submittedAt" TIMESTAMPTZ(3),
  "reviewedAt" TIMESTAMPTZ(3),
  "appliedAt" TIMESTAMPTZ(3),
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "purgedAt" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ImportBatch_checksum_check"
    CHECK ("checksum" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "ImportBatch_byteSize_check"
    CHECK ("originalByteSize" > 0 AND "originalByteSize" <= 5242880),
  CONSTRAINT "ImportBatch_counts_check"
    CHECK (
      "totalRows" >= 0
      AND "validRows" >= 0
      AND "invalidRows" >= 0
      AND "totalRows" = "validRows" + "invalidRows"
      AND "totalRows" <= 5000
    ),
  CONSTRAINT "ImportBatch_version_check" CHECK ("version" >= 0),
  CONSTRAINT "ImportBatch_expiry_check" CHECK ("expiresAt" > "uploadedAt"),
  CONSTRAINT "ImportBatch_review_tracking_check"
    CHECK (
      ("status" IN ('APPROVED', 'REJECTED') AND "reviewerId" IS NOT NULL AND "reviewedAt" IS NOT NULL)
      OR
      ("status" NOT IN ('APPROVED', 'REJECTED') AND "reviewerId" IS NULL AND "reviewedAt" IS NULL)
    ),
  CONSTRAINT "ImportBatch_submission_tracking_check"
    CHECK (
      ("status" IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED') AND "submittedAt" IS NOT NULL)
      OR
      ("status" NOT IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED') AND "submittedAt" IS NULL)
    ),
  CONSTRAINT "ImportBatch_application_tracking_check"
    CHECK (("status" = 'APPROVED') = ("appliedAt" IS NOT NULL)),
  CONSTRAINT "ImportBatch_rejection_reason_check"
    CHECK (
      ("status" = 'REJECTED' AND length(btrim("rejectionReason")) BETWEEN 3 AND 500)
      OR
      ("status" <> 'REJECTED' AND "rejectionReason" IS NULL)
    ),
  CONSTRAINT "ImportBatch_purge_check"
    CHECK ("purgedAt" IS NULL OR "status" <> 'APPROVED')
);

CREATE TABLE "RegistryImportRow" (
  "id" UUID NOT NULL,
  "batchId" UUID NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "studentNumber" VARCHAR(50),
  "fullName" VARCHAR(200),
  "normalizedFullName" VARCHAR(200),
  "email" VARCHAR(320),
  "program" VARCHAR(200),
  "academicYear" "AcademicYear",
  "status" "StudentRegistryStatus",
  "operation" "RegistryImportOperation",
  "validation" "RegistryImportRowValidation" NOT NULL DEFAULT 'INVALID',
  "errorCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RegistryImportRow_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RegistryImportRow_rowNumber_check" CHECK ("rowNumber" > 1 AND "rowNumber" <= 5001),
  CONSTRAINT "RegistryImportRow_errorCodes_check" CHECK (cardinality("errorCodes") <= 8),
  CONSTRAINT "RegistryImportRow_valid_payload_check"
    CHECK (
      "validation" = 'INVALID'
      OR (
        "studentNumber" IS NOT NULL
        AND "fullName" IS NOT NULL
        AND "normalizedFullName" IS NOT NULL
        AND "email" IS NOT NULL
        AND "program" IS NOT NULL
        AND "academicYear" IS NOT NULL
        AND "status" IS NOT NULL
        AND "operation" IS NOT NULL
        AND cardinality("errorCodes") = 0
      )
    )
);

CREATE UNIQUE INDEX "ImportBatch_type_checksum_key"
  ON "ImportBatch"("type", "checksum");
CREATE INDEX "ImportBatch_uploaderId_uploadedAt_id_idx"
  ON "ImportBatch"("uploaderId", "uploadedAt", "id");
CREATE INDEX "ImportBatch_status_submittedAt_id_idx"
  ON "ImportBatch"("status", "submittedAt", "id");
CREATE INDEX "ImportBatch_reviewerId_reviewedAt_id_idx"
  ON "ImportBatch"("reviewerId", "reviewedAt", "id");
CREATE INDEX "ImportBatch_expiresAt_purgedAt_status_idx"
  ON "ImportBatch"("expiresAt", "purgedAt", "status");
CREATE UNIQUE INDEX "RegistryImportRow_batchId_rowNumber_key"
  ON "RegistryImportRow"("batchId", "rowNumber");
CREATE INDEX "RegistryImportRow_batchId_validation_rowNumber_idx"
  ON "RegistryImportRow"("batchId", "validation", "rowNumber");

ALTER TABLE "ImportBatch"
  ADD CONSTRAINT "ImportBatch_uploaderId_fkey"
  FOREIGN KEY ("uploaderId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ImportBatch_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RegistryImportRow"
  ADD CONSTRAINT "RegistryImportRow_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;

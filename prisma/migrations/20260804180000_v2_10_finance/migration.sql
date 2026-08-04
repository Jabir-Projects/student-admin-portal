-- V2-10 immutable MAD finance ledger and controlled import workflow.
CREATE TYPE "FinanceEntryType" AS ENUM ('CHARGE', 'PAYMENT', 'CREDIT', 'REFUND', 'REVERSAL');
CREATE TYPE "FinanceTerm" AS ENUM ('ANNUAL', 'SEMESTER_1', 'SEMESTER_2', 'SUMMER');
CREATE TYPE "FinanceImportBatchStatus" AS ENUM ('UPLOADED', 'VALIDATED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'FAILED');
CREATE TYPE "FinanceImportRowValidation" AS ENUM ('VALID', 'INVALID');

ALTER TYPE "NotificationEventType" ADD VALUE 'FINANCE_BALANCE_UPDATED';

CREATE TABLE "StudentFinanceAccount" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "studentId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "StudentFinanceAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentFinanceAccount_studentId_key" UNIQUE ("studentId")
);

CREATE TABLE "FinanceImportBatch" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "status" "FinanceImportBatchStatus" NOT NULL DEFAULT 'UPLOADED',
  "uploaderId" UUID NOT NULL,
  "reviewerId" UUID,
  "checksum" CHAR(64) NOT NULL,
  "originalFilename" VARCHAR(255) NOT NULL,
  "originalByteSize" INTEGER NOT NULL,
  "totalRows" INTEGER NOT NULL,
  "validRows" INTEGER NOT NULL,
  "invalidRows" INTEGER NOT NULL,
  "rejectionReason" VARCHAR(1000),
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
  CONSTRAINT "FinanceImportBatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinanceImportBatch_checksum_key" UNIQUE ("checksum"),
  CONSTRAINT "FinanceImportBatch_checksum_check" CHECK ("checksum" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "FinanceImportBatch_byte_size_check" CHECK ("originalByteSize" > 0 AND "originalByteSize" <= 5242880),
  CONSTRAINT "FinanceImportBatch_counts_check" CHECK ("totalRows" > 0 AND "validRows" >= 0 AND "invalidRows" >= 0 AND "totalRows" = "validRows" + "invalidRows" AND "totalRows" <= 5000),
  CONSTRAINT "FinanceImportBatch_version_check" CHECK ("version" >= 0),
  CONSTRAINT "FinanceImportBatch_expiry_check" CHECK ("expiresAt" > "uploadedAt"),
  CONSTRAINT "FinanceImportBatch_submission_check" CHECK (("status" IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED') AND "submittedAt" IS NOT NULL) OR ("status" NOT IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED') AND "submittedAt" IS NULL)),
  CONSTRAINT "FinanceImportBatch_review_check" CHECK (("status" IN ('APPROVED', 'REJECTED') AND "reviewerId" IS NOT NULL AND "reviewedAt" IS NOT NULL) OR ("status" NOT IN ('APPROVED', 'REJECTED') AND "reviewerId" IS NULL AND "reviewedAt" IS NULL)),
  CONSTRAINT "FinanceImportBatch_application_check" CHECK (("status" = 'APPROVED') = ("appliedAt" IS NOT NULL)),
  CONSTRAINT "FinanceImportBatch_rejection_check" CHECK (("status" = 'REJECTED' AND length(btrim("rejectionReason")) BETWEEN 3 AND 1000) OR ("status" <> 'REJECTED' AND "rejectionReason" IS NULL)),
  CONSTRAINT "FinanceImportBatch_purge_check" CHECK ("purgedAt" IS NULL OR "status" NOT IN ('PENDING_APPROVAL', 'APPROVED'))
);

CREATE TABLE "FinanceImportRow" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "batchId" UUID NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "studentNumber" VARCHAR(50),
  "studentId" UUID,
  "entryType" "FinanceEntryType",
  "amountMinor" BIGINT,
  "currency" CHAR(3),
  "effectiveDate" DATE,
  "postingDate" DATE,
  "billingPeriod" CHAR(9),
  "term" "FinanceTerm",
  "sourceSystem" VARCHAR(64),
  "externalTransactionId" VARCHAR(160),
  "sourceReference" VARCHAR(200),
  "description" VARCHAR(1000),
  "validation" "FinanceImportRowValidation" NOT NULL DEFAULT 'INVALID',
  "errorCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinanceImportRow_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinanceImportRow_batch_row_key" UNIQUE ("batchId", "rowNumber"),
  CONSTRAINT "FinanceImportRow_number_check" CHECK ("rowNumber" > 1 AND "rowNumber" <= 5001),
  CONSTRAINT "FinanceImportRow_errors_check" CHECK (cardinality("errorCodes") <= 12),
  CONSTRAINT "FinanceImportRow_valid_payload_check" CHECK ("validation" = 'INVALID' OR ("studentNumber" IS NOT NULL AND "studentId" IS NOT NULL AND "entryType" IN ('CHARGE', 'PAYMENT', 'CREDIT', 'REFUND') AND "amountMinor" > 0 AND "currency" = 'MAD' AND "effectiveDate" IS NOT NULL AND "postingDate" IS NOT NULL AND "billingPeriod" ~ '^[0-9]{4}-[0-9]{4}$' AND "term" IS NOT NULL AND "sourceSystem" = 'SIST_FINANCE_OFFICIAL' AND length(btrim("externalTransactionId")) > 0 AND length(btrim("sourceReference")) > 0 AND cardinality("errorCodes") = 0))
);

CREATE TABLE "FinanceTransaction" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "accountId" UUID NOT NULL,
  "entryType" "FinanceEntryType" NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "ledgerEffectMinor" BIGINT NOT NULL,
  "currency" CHAR(3) NOT NULL DEFAULT 'MAD',
  "effectiveDate" DATE NOT NULL,
  "postedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "billingPeriod" CHAR(9) NOT NULL,
  "term" "FinanceTerm" NOT NULL DEFAULT 'ANNUAL',
  "sourceSystem" VARCHAR(64) NOT NULL,
  "externalTransactionId" VARCHAR(160) NOT NULL,
  "sourceReference" VARCHAR(200) NOT NULL,
  "description" VARCHAR(1000) NOT NULL DEFAULT '',
  "importBatchId" UUID,
  "originalTransactionId" UUID,
  "createdById" UUID NOT NULL,
  "appliedById" UUID NOT NULL,
  "reversedById" UUID,
  "reversalReason" VARCHAR(1000),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinanceTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinanceTransaction_source_identity_key" UNIQUE ("sourceSystem", "externalTransactionId"),
  CONSTRAINT "FinanceTransaction_original_key" UNIQUE ("originalTransactionId"),
  CONSTRAINT "FinanceTransaction_amount_check" CHECK ("amountMinor" > 0),
  CONSTRAINT "FinanceTransaction_currency_check" CHECK ("currency" = 'MAD'),
  CONSTRAINT "FinanceTransaction_effect_check" CHECK ("ledgerEffectMinor" <> 0 AND (("entryType" = 'CHARGE' AND "ledgerEffectMinor" = "amountMinor") OR ("entryType" IN ('PAYMENT', 'CREDIT') AND "ledgerEffectMinor" = -"amountMinor") OR ("entryType" = 'REFUND' AND "ledgerEffectMinor" = "amountMinor") OR ("entryType" = 'REVERSAL' AND "ledgerEffectMinor" = -"amountMinor"))),
  CONSTRAINT "FinanceTransaction_period_check" CHECK ("billingPeriod" ~ '^[0-9]{4}-[0-9]{4}$' AND substring("billingPeriod" from 6 for 4)::integer = substring("billingPeriod" from 1 for 4)::integer + 1),
  CONSTRAINT "FinanceTransaction_source_check" CHECK ("sourceSystem" = 'SIST_FINANCE_OFFICIAL'),
  CONSTRAINT "FinanceTransaction_reference_check" CHECK (length(btrim("externalTransactionId")) > 0 AND length(btrim("sourceReference")) > 0),
  CONSTRAINT "FinanceTransaction_no_self_reversal" CHECK ("originalTransactionId" IS NULL OR "originalTransactionId" <> "id"),
  CONSTRAINT "FinanceTransaction_reversal_check" CHECK (("entryType" = 'REVERSAL' AND "originalTransactionId" IS NOT NULL AND "importBatchId" IS NULL AND "reversedById" IS NOT NULL AND length(btrim("reversalReason")) BETWEEN 3 AND 1000) OR ("entryType" <> 'REVERSAL' AND "originalTransactionId" IS NULL AND "reversedById" IS NULL AND "reversalReason" IS NULL))
);

CREATE INDEX "FinanceImportBatch_uploader_uploaded_id_idx" ON "FinanceImportBatch"("uploaderId", "uploadedAt", "id");
CREATE INDEX "FinanceImportBatch_status_submitted_id_idx" ON "FinanceImportBatch"("status", "submittedAt", "id");
CREATE INDEX "FinanceImportBatch_expiry_purged_status_idx" ON "FinanceImportBatch"("expiresAt", "purgedAt", "status");
CREATE INDEX "FinanceImportRow_batch_validation_number_idx" ON "FinanceImportRow"("batchId", "validation", "rowNumber");
CREATE INDEX "FinanceImportRow_student_batch_idx" ON "FinanceImportRow"("studentId", "batchId");
CREATE INDEX "FinanceTransaction_account_posted_id_idx" ON "FinanceTransaction"("accountId", "postedAt", "id");
CREATE INDEX "FinanceTransaction_period_effective_id_idx" ON "FinanceTransaction"("billingPeriod", "effectiveDate", "id");
CREATE INDEX "FinanceTransaction_batch_posted_id_idx" ON "FinanceTransaction"("importBatchId", "postedAt", "id");

ALTER TABLE "StudentFinanceAccount" ADD CONSTRAINT "StudentFinanceAccount_student_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceImportBatch" ADD CONSTRAINT "FinanceImportBatch_uploader_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceImportBatch" ADD CONSTRAINT "FinanceImportBatch_reviewer_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceImportRow" ADD CONSTRAINT "FinanceImportRow_batch_fkey" FOREIGN KEY ("batchId") REFERENCES "FinanceImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceImportRow" ADD CONSTRAINT "FinanceImportRow_student_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_account_fkey" FOREIGN KEY ("accountId") REFERENCES "StudentFinanceAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_batch_fkey" FOREIGN KEY ("importBatchId") REFERENCES "FinanceImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_original_fkey" FOREIGN KEY ("originalTransactionId") REFERENCES "FinanceTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_created_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_applied_fkey" FOREIGN KEY ("appliedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_reversed_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

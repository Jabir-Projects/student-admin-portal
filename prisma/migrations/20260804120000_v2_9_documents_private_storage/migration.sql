CREATE TYPE "DocumentArtifactType" AS ENUM ('REQUEST_FULFILMENT_CONFIRMATION');
CREATE TYPE "DocumentArtifactStatus" AS ENUM ('GENERATED', 'RELEASED', 'REVOKED', 'SUPERSEDED');
CREATE TYPE "DocumentStorageProvider" AS ENUM ('VERCEL_BLOB');

ALTER TYPE "NotificationEventType" ADD VALUE 'DOCUMENT_RELEASED';
ALTER TYPE "NotificationEventType" ADD VALUE 'DOCUMENT_REVOKED';

CREATE TABLE "DocumentArtifact" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(), "requestId" UUID NOT NULL,
    "type" "DocumentArtifactType" NOT NULL, "status" "DocumentArtifactStatus" NOT NULL DEFAULT 'GENERATED',
    "version" INTEGER NOT NULL, "storageProvider" "DocumentStorageProvider" NOT NULL DEFAULT 'VERCEL_BLOB',
    "storageKey" VARCHAR(300) NOT NULL, "filename" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL, "byteSize" INTEGER NOT NULL, "checksum" CHAR(64) NOT NULL,
    "generatedById" UUID NOT NULL, "releasedById" UUID, "revokedById" UUID, "supersededByArtifactId" UUID,
    "revocationReason" VARCHAR(1000), "generatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMPTZ(3), "revokedAt" TIMESTAMPTZ(3), "supersededAt" TIMESTAMPTZ(3),
    "orphanedAt" TIMESTAMPTZ(3), "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "DocumentArtifact_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DocumentArtifact_version_check" CHECK ("version" > 0),
    CONSTRAINT "DocumentArtifact_mimeType_check" CHECK ("mimeType" = 'application/pdf'),
    CONSTRAINT "DocumentArtifact_byteSize_check" CHECK ("byteSize" > 0 AND "byteSize" <= 5242880),
    CONSTRAINT "DocumentArtifact_checksum_check" CHECK ("checksum" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "DocumentArtifact_storageKey_check" CHECK ("storageKey" ~ '^documents/[0-9a-f-]{36}/v[1-9][0-9]*/[a-z0-9-]{36}[.]pdf$'),
    CONSTRAINT "DocumentArtifact_no_self_supersession" CHECK ("supersededByArtifactId" IS NULL OR "supersededByArtifactId" <> "id"),
    CONSTRAINT "DocumentArtifact_lifecycle_check" CHECK (("status" = 'GENERATED' AND "releasedById" IS NULL AND "releasedAt" IS NULL AND "revokedById" IS NULL AND "revokedAt" IS NULL AND "supersededAt" IS NULL AND "supersededByArtifactId" IS NULL AND "revocationReason" IS NULL) OR ("status" = 'RELEASED' AND "releasedById" IS NOT NULL AND "releasedAt" IS NOT NULL AND "revokedById" IS NULL AND "revokedAt" IS NULL AND "supersededAt" IS NULL AND "supersededByArtifactId" IS NULL AND "revocationReason" IS NULL) OR ("status" = 'REVOKED' AND "releasedById" IS NOT NULL AND "releasedAt" IS NOT NULL AND "revokedById" IS NOT NULL AND "revokedAt" IS NOT NULL AND "supersededAt" IS NULL AND "supersededByArtifactId" IS NULL AND "revocationReason" IS NOT NULL) OR ("status" = 'SUPERSEDED' AND "supersededAt" IS NOT NULL AND "supersededByArtifactId" IS NOT NULL))
);

CREATE UNIQUE INDEX "DocumentArtifact_requestId_version_key" ON "DocumentArtifact"("requestId", "version");
CREATE UNIQUE INDEX "DocumentArtifact_storageKey_key" ON "DocumentArtifact"("storageKey");
CREATE INDEX "DocumentArtifact_requestId_status_generatedAt_idx" ON "DocumentArtifact"("requestId", "status", "generatedAt");
CREATE INDEX "DocumentArtifact_status_releasedAt_id_idx" ON "DocumentArtifact"("status", "releasedAt", "id");
CREATE INDEX "DocumentArtifact_orphanedAt_status_id_idx" ON "DocumentArtifact"("orphanedAt", "status", "id");

ALTER TABLE "DocumentArtifact" ADD CONSTRAINT "DocumentArtifact_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "DocumentRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentArtifact" ADD CONSTRAINT "DocumentArtifact_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentArtifact" ADD CONSTRAINT "DocumentArtifact_releasedById_fkey" FOREIGN KEY ("releasedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentArtifact" ADD CONSTRAINT "DocumentArtifact_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DocumentArtifact" ADD CONSTRAINT "DocumentArtifact_supersededByArtifactId_fkey" FOREIGN KEY ("supersededByArtifactId") REFERENCES "DocumentArtifact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

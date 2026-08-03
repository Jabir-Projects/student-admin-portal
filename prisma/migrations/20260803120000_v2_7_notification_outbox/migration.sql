-- V2-7 additive notification identity and transactional email outbox.
CREATE TYPE "NotificationEventType" AS ENUM (
  'LEGACY',
  'REQUEST_STATUS_CHANGED',
  'REQUEST_PUBLIC_MESSAGE_ADDED',
  'REQUEST_SUBMITTED',
  'REQUEST_CANCELLED'
);

CREATE TYPE "NotificationDeliveryChannel" AS ENUM ('EMAIL');

CREATE TYPE "NotificationDeliveryStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'SENT',
  'FAILED'
);

ALTER TABLE "Notification"
  ADD COLUMN "eventType" "NotificationEventType" NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN "eventKey" VARCHAR(240);

UPDATE "Notification"
SET "eventKey" = 'legacy:' || "id"::text
WHERE "eventKey" IS NULL;

ALTER TABLE "Notification"
  ALTER COLUMN "eventKey" SET NOT NULL;

CREATE UNIQUE INDEX "Notification_eventKey_key"
  ON "Notification"("eventKey");

CREATE INDEX "Notification_userId_createdAt_id_idx"
  ON "Notification"("userId", "createdAt", "id");

CREATE TABLE "NotificationDelivery" (
  "id" UUID NOT NULL,
  "notificationId" UUID NOT NULL,
  "channel" "NotificationDeliveryChannel" NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" VARCHAR(256) NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processingStartedAt" TIMESTAMPTZ(3),
  "sentAt" TIMESTAMPTZ(3),
  "providerMessageId" VARCHAR(200),
  "errorCode" VARCHAR(120),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationDelivery_attemptCount_check"
    CHECK ("attemptCount" >= 0 AND "attemptCount" <= 5)
);

CREATE UNIQUE INDEX "NotificationDelivery_idempotencyKey_key"
  ON "NotificationDelivery"("idempotencyKey");

CREATE INDEX "NotificationDelivery_status_nextAttemptAt_id_idx"
  ON "NotificationDelivery"("status", "nextAttemptAt", "id");

CREATE INDEX "NotificationDelivery_notificationId_channel_idx"
  ON "NotificationDelivery"("notificationId", "channel");

ALTER TABLE "NotificationDelivery"
  ADD CONSTRAINT "NotificationDelivery_notificationId_fkey"
  FOREIGN KEY ("notificationId") REFERENCES "Notification"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "AuditLog_action_createdAt_id_idx"
  ON "AuditLog"("action", "createdAt", "id");

CREATE INDEX "AuditLog_entityType_createdAt_id_idx"
  ON "AuditLog"("entityType", "createdAt", "id");

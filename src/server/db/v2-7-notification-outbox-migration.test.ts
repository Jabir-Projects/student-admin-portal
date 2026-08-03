import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  path.join(
    process.cwd(),
    "prisma/migrations/20260803120000_v2_7_notification_outbox/migration.sql",
  ),
  "utf8",
);

describe("V2-7 notification outbox migration", () => {
  it("is additive and backfills deterministic legacy event keys", () => {
    expect(sql).toContain('ADD COLUMN "eventType"');
    expect(sql).toContain("'legacy:' || \"id\"::text");
    expect(sql).toContain('ALTER COLUMN "eventKey" SET NOT NULL');
    expect(sql).toContain('CREATE UNIQUE INDEX "Notification_eventKey_key"');
    expect(sql).not.toMatch(/DROP TABLE|DROP COLUMN|TRUNCATE/iu);
  });

  it("bounds delivery attempts and creates query indexes", () => {
    expect(sql).toContain('CREATE TABLE "NotificationDelivery"');
    expect(sql).toContain('"attemptCount" >= 0 AND "attemptCount" <= 5');
    expect(sql).toContain('"NotificationDelivery_idempotencyKey_key"');
    expect(sql).toContain('"NotificationDelivery_status_nextAttemptAt_id_idx"');
    expect(sql).toContain('"AuditLog_action_createdAt_id_idx"');
  });
});

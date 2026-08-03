import { randomUUID } from "node:crypto";

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  type TestContext,
} from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  addRequestMessageAsActor,
  transitionRequestAsActor,
} from "@/server/administration/mutations.node";
import { dispatchNotificationDeliveries } from "@/server/notifications/dispatcher.node";
import {
  markAllOwnedNotificationsRead,
  markOwnedNotificationRead,
} from "@/server/notifications/mutations.node";
import { FakeEmailProvider } from "@/server/notifications/provider.node";
import {
  listAuditLog,
  listOwnedNotifications,
} from "@/server/notifications/reads.node";
import {
  cancelRequestAsActor,
  submitRequestAsActor,
} from "@/server/student-portal/mutations.node";
import {
  openVerifiedIsolatedTestDatabase,
  type VerifiedIsolatedTestDatabase,
} from "@/test/isolated-database.node";

const ids = {
  processor: "a7800000-0000-4000-8000-000000000001",
  viewer: "a7800000-0000-4000-8000-000000000002",
  zero: "a7800000-0000-4000-8000-000000000003",
  disabled: "a7800000-0000-4000-8000-000000000004",
  studentA: "a7800000-0000-4000-8000-000000000005",
  studentB: "a7800000-0000-4000-8000-000000000006",
  profileA: "a7800000-0000-4000-8000-000000000007",
  profileB: "a7800000-0000-4000-8000-000000000008",
  category: "a7800000-0000-4000-8000-000000000009",
} as const;

let verified: VerifiedIsolatedTestDatabase | undefined;
let database: PrismaClient | undefined;
const claims = (actorId: string) => ({ actorId, claimedSessionVersion: 0 });

function dbOrSkip(context: TestContext) {
  if (database) return database;
  context.skip(
    "V2-7 PostgreSQL integration requires the verified isolated test database.",
  );
}

async function createRequest(
  db: PrismaClient,
  status: "SUBMITTED" | "UNDER_REVIEW" = "SUBMITTED",
) {
  return db.documentRequest.create({
    data: {
      id: randomUUID(),
      studentId: ids.profileA,
      categoryId: ids.category,
      status,
      deliveryMethod: "DIGITAL_DELIVERY",
      copyCount: 1,
    },
  });
}

beforeAll(async () => {
  try {
    verified = await openVerifiedIsolatedTestDatabase(process.env);
  } catch {
    return;
  }
  const db = verified.database;
  database = db;
  const users = [
    [
      ids.processor,
      "v2-7-processor@example.test",
      "V2-7 Processor",
      "STAFF",
      "ACTIVE",
    ],
    [
      ids.viewer,
      "v2-7-viewer@example.test",
      "V2-7 Audit Viewer",
      "STAFF",
      "ACTIVE",
    ],
    [ids.zero, "v2-7-zero@example.test", "V2-7 Zero Staff", "STAFF", "ACTIVE"],
    [
      ids.disabled,
      "v2-7-disabled@example.test",
      "V2-7 Disabled Staff",
      "STAFF",
      "DISABLED",
    ],
    [
      ids.studentA,
      "v2-7-student-a@example.test",
      "V2-7 Student Alpha",
      "STUDENT",
      "ACTIVE",
    ],
    [
      ids.studentB,
      "v2-7-student-b@example.test",
      "V2-7 Student Beta",
      "STUDENT",
      "ACTIVE",
    ],
  ] as const;
  for (const [id, email, fullName, role, status] of users) {
    await db.user.upsert({
      where: { id },
      create: {
        id,
        email,
        fullName,
        role,
        status,
        passwordHash: "suite-owned-non-authenticating-value",
        sessionVersion: 0,
        disabledAt:
          status === "DISABLED" ? new Date("2026-01-01T00:00:00Z") : null,
        disabledById: status === "DISABLED" ? ids.processor : null,
      },
      update: {
        email,
        fullName,
        role,
        status,
        sessionVersion: 0,
        disabledAt:
          status === "DISABLED" ? new Date("2026-01-01T00:00:00Z") : null,
        disabledById: status === "DISABLED" ? ids.processor : null,
      },
    });
  }
  for (const [id, userId, studentNumber] of [
    [ids.profileA, ids.studentA, "V27TESTA"],
    [ids.profileB, ids.studentB, "V27TESTB"],
  ] as const) {
    await db.studentProfile.upsert({
      where: { id },
      create: {
        id,
        userId,
        studentNumber,
        program: "V2-7 Test Programme",
        academicYear: "YEAR_1",
      },
      update: { userId, studentNumber },
    });
  }
  await db.requestCategory.upsert({
    where: { id: ids.category },
    create: {
      id: ids.category,
      name: "V2-7 Test Certificate",
      slug: "v2-7-test-certificate",
      isActive: true,
    },
    update: { isActive: true },
  });
  await db.userCapabilityAssignment.deleteMany({
    where: {
      userId: { in: [ids.processor, ids.viewer, ids.zero, ids.disabled] },
    },
  });
  await db.userCapabilityAssignment.createMany({
    data: [
      { userId: ids.processor, capability: "PROCESS_REQUESTS" },
      { userId: ids.viewer, capability: "VIEW_AUDIT_LOG" },
      { userId: ids.disabled, capability: "PROCESS_REQUESTS" },
    ],
  });
});

afterAll(async () => {
  await verified?.close();
});

describe("V2-7 PostgreSQL notifications and audit", () => {
  it("notifies only active PROCESS_REQUESTS staff on submit and cancel", async (context) => {
    const db = dbOrSkip(context);
    await db.documentRequest.updateMany({
      where: {
        studentId: ids.profileA,
        categoryId: ids.category,
        status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "READY"] },
      },
      data: { status: "CANCELLED" },
    });
    const result = await submitRequestAsActor(
      claims(ids.studentA),
      {
        categoryId: ids.category,
        copyCount: 1,
        deliveryMethod: "DIGITAL_DELIVERY",
        details: `v27-${randomUUID()}`,
      },
      db,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      await db.notification.count({
        where: {
          requestId: result.requestId,
          userId: ids.processor,
          eventType: "REQUEST_SUBMITTED",
        },
      }),
    ).toBe(1);
    expect(
      await db.notification.count({
        where: {
          requestId: result.requestId,
          userId: { in: [ids.disabled, ids.zero, ids.studentA] },
          eventType: "REQUEST_SUBMITTED",
        },
      }),
    ).toBe(0);
    expect(
      (
        await cancelRequestAsActor(
          claims(ids.studentA),
          { requestId: result.requestId },
          db,
        )
      ).ok,
    ).toBe(true);
    expect(
      await db.notification.count({
        where: {
          requestId: result.requestId,
          userId: ids.processor,
          eventType: "REQUEST_CANCELLED",
        },
      }),
    ).toBe(1);
  });

  it("creates student in-portal and email events but never exposes internal notes", async (context) => {
    const db = dbOrSkip(context);
    const request = await createRequest(db);
    expect(
      (
        await transitionRequestAsActor(
          claims(ids.processor),
          {
            requestId: request.id,
            targetStatus: "UNDER_REVIEW",
            publicMessage: "Public update",
            internalNote: "Private note",
          },
          db,
        )
      ).ok,
    ).toBe(true);
    const notifications = await db.notification.findMany({
      where: { requestId: request.id, userId: ids.studentA },
      include: { deliveries: true },
    });
    expect(notifications.map((item) => item.eventType).sort()).toEqual([
      "REQUEST_PUBLIC_MESSAGE_ADDED",
      "REQUEST_STATUS_CHANGED",
    ]);
    expect(notifications.every((item) => item.deliveries.length === 1)).toBe(
      true,
    );
    expect(JSON.stringify(notifications)).not.toContain("Private note");
    const before = notifications.length;
    expect(
      (
        await addRequestMessageAsActor(
          claims(ids.processor),
          {
            requestId: request.id,
            visibility: "INTERNAL",
            body: "Another private note",
          },
          db,
        )
      ).ok,
    ).toBe(true);
    expect(
      await db.notification.count({
        where: { requestId: request.id, userId: ids.studentA },
      }),
    ).toBe(before);
  });

  it("enforces ownership and idempotent read operations", async (context) => {
    const db = dbOrSkip(context);
    const request = await createRequest(db);
    const notification = await db.notification.create({
      data: {
        userId: ids.studentA,
        requestId: request.id,
        eventType: "REQUEST_STATUS_CHANGED",
        eventKey: `v27-read:${randomUUID()}`,
        title: "Read test",
        body: "Owned body",
      },
    });
    expect(
      await markOwnedNotificationRead(
        claims(ids.studentB),
        "STUDENT",
        { notificationId: notification.id },
        db,
      ),
    ).toEqual({ ok: false, reason: "NOT_FOUND" });
    expect(
      await markOwnedNotificationRead(
        claims(ids.studentA),
        "STUDENT",
        { notificationId: notification.id },
        db,
      ),
    ).toEqual({ ok: true, changed: 1 });
    expect(
      await markOwnedNotificationRead(
        claims(ids.studentA),
        "STUDENT",
        { notificationId: notification.id },
        db,
      ),
    ).toEqual({ ok: true, changed: 0 });
    expect(
      (
        await listOwnedNotifications(
          claims(ids.studentB),
          "STUDENT",
          { page: 1 },
          db,
        )
      ).ok,
    ).toBe(true);
    expect(
      await markAllOwnedNotificationsRead(claims(ids.studentA), "STUDENT", db),
    ).toMatchObject({ ok: true });
  });

  it("deduplicates concurrent event inserts", async (context) => {
    const db = dbOrSkip(context);
    const request = await createRequest(db);
    const key = `v27-race:${randomUUID()}`;
    await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        db.notification.upsert({
          where: { eventKey: key },
          create: {
            userId: ids.studentA,
            requestId: request.id,
            eventType: "REQUEST_STATUS_CHANGED",
            eventKey: key,
            title: "Race",
            body: "Race",
          },
          update: {},
        }),
      ),
    );
    expect(await db.notification.count({ where: { eventKey: key } })).toBe(1);
  });

  it("retries provider failures, terminates at five attempts, and sends a key once", async (context) => {
    const db = dbOrSkip(context);
    const request = await createRequest(db);
    const suffix = randomUUID();
    const notification = await db.notification.create({
      data: {
        userId: ids.studentA,
        requestId: request.id,
        eventType: "REQUEST_STATUS_CHANGED",
        eventKey: `v27-delivery:${suffix}`,
        title: "Delivery",
        body: "Delivery",
      },
    });
    const delivery = await db.notificationDelivery.create({
      data: {
        notificationId: notification.id,
        channel: "EMAIL",
        idempotencyKey: `v27-delivery:${suffix}`,
        nextAttemptAt: new Date("2000-01-01T00:00:00Z"),
      },
    });
    await db.notificationDelivery.updateMany({
      where: {
        id: { not: delivery.id },
        status: { in: ["PENDING", "PROCESSING"] },
      },
      data: {
        status: "PENDING",
        nextAttemptAt: new Date("2100-01-01T00:00:00Z"),
        processingStartedAt: null,
      },
    });
    const failing = new FakeEmailProvider(5);
    for (let attempt = 0; attempt < 5; attempt += 1)
      await dispatchNotificationDeliveries(db, {
        provider: failing,
        from: "noreply@example.test",
        portalBaseUrl: "https://portal.example.test",
        limit: 1,
        now: new Date(2000, 0, 1, 0, 10 + attempt * 20),
      });
    expect(
      await db.notificationDelivery.findUnique({
        where: { id: delivery.id },
        select: { status: true, attemptCount: true, errorCode: true },
      }),
    ).toEqual({
      status: "FAILED",
      attemptCount: 5,
      errorCode: "FAKE_TRANSIENT_FAILURE",
    });
    const sentNotification = await db.notification.create({
      data: {
        userId: ids.studentA,
        requestId: request.id,
        eventType: "REQUEST_STATUS_CHANGED",
        eventKey: `v27-sent:${suffix}`,
        title: "Sent",
        body: "Sent",
      },
    });
    await db.notificationDelivery.create({
      data: {
        notificationId: sentNotification.id,
        channel: "EMAIL",
        idempotencyKey: `v27-sent:${suffix}`,
        nextAttemptAt: new Date("2000-01-01T00:00:00Z"),
      },
    });
    const successful = new FakeEmailProvider();
    await Promise.all(
      [1, 2].map(() =>
        dispatchNotificationDeliveries(db, {
          provider: successful,
          from: "noreply@example.test",
          portalBaseUrl: "https://portal.example.test",
          limit: 1,
          now: new Date("2001-01-01T00:00:00Z"),
        }),
      ),
    );
    expect(successful.submissions).toHaveLength(1);
  }, 30_000);

  it("requires VIEW_AUDIT_LOG and sanitizes metadata", async (context) => {
    const db = dbOrSkip(context);
    const entityId = randomUUID();
    await db.auditLog.create({
      data: {
        actorId: ids.processor,
        action: "V2_7_AUDIT_TEST",
        entityType: "V27Fixture",
        entityId,
        metadata: {
          status: "SAFE",
          password: "must-not-render",
          nested: { secret: true },
        },
      },
    });
    expect(
      (await listAuditLog(claims(ids.zero), { page: 1, pageSize: 25 }, db)).ok,
    ).toBe(false);
    const allowed = await listAuditLog(
      claims(ids.viewer),
      { page: 1, pageSize: 25, action: "V2_7_AUDIT_TEST" },
      db,
    );
    expect(allowed.ok).toBe(true);
    if (allowed.ok)
      expect(allowed.rows[0]?.metadata).toEqual([
        { label: "status", value: "SAFE" },
      ]);
    await expect(
      db.auditLog.update({
        where: { id: (allowed.ok && allowed.rows[0]?.id) || randomUUID() },
        data: { action: "ILLEGAL" },
      }),
    ).rejects.toThrow();
  });
});

// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import {
  enqueueStaffRequestNotifications,
  enqueueStudentRequestNotification,
} from "@/server/notifications/events.node";

function fixture() {
  const upsert = vi.fn().mockResolvedValue({ id: "notification-id" });
  const createMany = vi.fn().mockResolvedValue({ count: 1 });
  const findMany = vi
    .fn()
    .mockResolvedValue([{ id: "staff-1" }, { id: "staff-2" }]);
  return {
    transaction: {
      notification: { upsert },
      notificationDelivery: { createMany },
      user: { findMany },
    } as never,
    upsert,
    createMany,
    findMany,
  };
}

describe("notification event matrix", () => {
  it("creates student in-portal and email outbox identities", async () => {
    const test = fixture();
    await enqueueStudentRequestNotification(test.transaction, {
      requestId: "request-1",
      studentUserId: "student-1",
      eventType: "REQUEST_STATUS_CHANGED",
      eventId: "history-1",
      status: "READY",
    });
    expect(test.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventKey: "REQUEST_STATUS_CHANGED:history-1:student-1" },
      }),
    );
    expect(test.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          expect.objectContaining({
            idempotencyKey: "email:REQUEST_STATUS_CHANGED:history-1:student-1",
          }),
        ],
      }),
    );
  });

  it("fans operational events only through the active PROCESS_REQUESTS query and does not enqueue staff email", async () => {
    const test = fixture();
    await enqueueStaffRequestNotifications(test.transaction, {
      requestId: "request-1",
      eventType: "REQUEST_SUBMITTED",
    });
    expect(test.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          role: "STAFF",
          status: "ACTIVE",
          capabilityAssignments: { some: { capability: "PROCESS_REQUESTS" } },
        },
      }),
    );
    expect(test.upsert).toHaveBeenCalledTimes(2);
    expect(test.createMany).not.toHaveBeenCalled();
  });
});

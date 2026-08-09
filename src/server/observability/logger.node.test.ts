// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import {
  logOperationalEvent,
  serializeOperationalEvent,
} from "@/server/observability/logger.node";

describe("operational logger", () => {
  it("emits a correlated structured event with allowlisted metadata only", () => {
    const output = serializeOperationalEvent({
      event: "document.download.unavailable",
      level: "warn",
      metadata: {
        operation: "student-download",
        reasonCode: "PROVIDER_FAILURE",
        // @ts-expect-error verifies that sensitive ad-hoc metadata is rejected.
        email: "student@example.test",
      },
      requestId: "0ea3233b-efad-4be6-a9f4-36f523719e12",
    });

    expect(JSON.parse(output)).toEqual({
      event: "document.download.unavailable",
      level: "warn",
      metadata: {
        operation: "student-download",
        reasonCode: "PROVIDER_FAILURE",
      },
      requestId: "0ea3233b-efad-4be6-a9f4-36f523719e12",
    });
    expect(output).not.toContain("student@example.test");
  });

  it("writes one JSON record without accepting an exception or request payload", () => {
    const write = vi.fn();
    logOperationalEvent(
      { event: "notifications.dispatch.failed", level: "error" },
      write,
    );
    expect(write).toHaveBeenCalledOnce();
    expect(JSON.parse(write.mock.calls[0]?.[0] ?? "")).toMatchObject({
      event: "notifications.dispatch.failed",
      level: "error",
    });
  });
});

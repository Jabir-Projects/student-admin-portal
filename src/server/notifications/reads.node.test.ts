// @vitest-environment node

import { describe, expect, it } from "vitest";
import { sanitizeAuditMetadata } from "@/server/notifications/reads.node";

describe("audit presentation sanitization", () => {
  it("renders only approved primitive metadata", () => {
    expect(
      sanitizeAuditMetadata({
        previousStatus: "SUBMITTED",
        hasInternalNote: true,
        token: "forbidden",
        rawError: "forbidden",
        nested: { password: "forbidden" },
      }),
    ).toEqual([
      { label: "previous status", value: "SUBMITTED" },
      { label: "has internal note", value: "true" },
    ]);
  });
});

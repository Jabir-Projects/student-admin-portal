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

  it("renders only non-identifying V2-8 import metadata", () => {
    expect(
      sanitizeAuditMetadata({
        sourceType: "CSV",
        originalByteSize: 512,
        totalRows: 3,
        validRows: 2,
        invalidRows: 1,
        retentionDays: 30,
        originalFilename: "private-students.csv",
        checksum: "forbidden",
        studentNumber: "forbidden",
        email: "forbidden@example.test",
      }),
    ).toEqual([
      { label: "source type", value: "CSV" },
      { label: "original byte size", value: "512" },
      { label: "total rows", value: "3" },
      { label: "valid rows", value: "2" },
      { label: "invalid rows", value: "1" },
      { label: "retention days", value: "30" },
    ]);
  });
});

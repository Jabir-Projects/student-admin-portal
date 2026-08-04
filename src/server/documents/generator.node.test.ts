// @vitest-environment node

import { describe, expect, it } from "vitest";

import { generateRequestFulfilmentPdf } from "@/server/documents/generator.node";
import { MAX_DOCUMENT_BYTES } from "@/server/documents/storage.node";

const input = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  version: 1,
  referenceNumber: "REQ-00000001",
  category: "General request <script>alert(1)</script>",
  fullName: "Example Student",
  studentNumber: "SIST-TEST-001",
  program: "Software Engineering",
  academicYear: "YEAR_3",
  issueDate: "2026-08-04",
} as const;

describe("trusted request fulfilment PDF", () => {
  it("renders a bounded PDF with safe filename and checksum", async () => {
    const result = await generateRequestFulfilmentPdf(input);
    expect(new TextDecoder().decode(result.bytes.slice(0, 5))).toBe("%PDF-");
    expect(result.bytes.byteLength).toBeGreaterThan(100);
    expect(result.bytes.byteLength).toBeLessThanOrEqual(MAX_DOCUMENT_BYTES);
    expect(result.checksum).toMatch(/^[0-9a-f]{64}$/u);
    expect(result.filename).toBe("sist-request-REQ-00000001-v1.pdf");
    expect(result.filename).not.toContain("Example Student");
  });

  it("is deterministic for identical authoritative input", async () => {
    const first = await generateRequestFulfilmentPdf(input);
    const second = await generateRequestFulfilmentPdf(input);
    expect(second.checksum).toBe(first.checksum);
    expect(second.bytes).toEqual(first.bytes);
  });
});

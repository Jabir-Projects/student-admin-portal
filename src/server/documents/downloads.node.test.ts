// @vitest-environment node

import { describe, expect, it } from "vitest";

import { privatePdfResponse } from "@/server/documents/downloads.node";

describe("private PDF response contract", () => {
  it("uses private no-store headers and a controlled attachment filename", async () => {
    const response = privatePdfResponse({
      bytes: new Uint8Array([37, 80, 68, 70]),
      byteSize: 4,
      filename: 'unsafe\r\nname " student.pdf',
    });
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-length")).toBe("4");
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0, must-revalidate",
    );
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, noarchive");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="unsafe__name___student.pdf"',
    );
    expect((await response.arrayBuffer()).byteLength).toBe(4);
  });

  it("does not expose storage or provider metadata", () => {
    const response = privatePdfResponse({
      bytes: new Uint8Array([1]),
      byteSize: 1,
      filename: "document.pdf",
    });
    const serializedHeaders = JSON.stringify([...response.headers]);
    expect(serializedHeaders).not.toMatch(/blob|storage|token|vercel/iu);
  });
});

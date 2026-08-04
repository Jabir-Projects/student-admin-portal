// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  InMemoryDocumentStorage,
  checksumDocument,
  createDocumentStorageKey,
} from "@/server/documents/storage.node";

describe("document storage contract", () => {
  it("stores copies, lists bounded metadata, retrieves, and deletes", async () => {
    const now = new Date("2026-08-04T12:00:00.000Z");
    const storage = new InMemoryDocumentStorage(() => now);
    const bytes = new Uint8Array([37, 80, 68, 70]);
    await storage.put("documents/example", bytes);
    bytes[0] = 0;
    expect(await storage.get("documents/example")).toEqual({
      body: new Uint8Array([37, 80, 68, 70]),
      size: 4,
    });
    expect(await storage.list("documents/")).toEqual([
      { key: "documents/example", size: 4, uploadedAt: now },
    ]);
    await storage.delete("documents/example");
    expect(await storage.exists("documents/example")).toBe(false);
  });

  it("generates PII-free opaque keys and SHA-256 checksums", () => {
    const key = createDocumentStorageKey(
      "123e4567-e89b-42d3-a456-426614174000",
      2,
    );
    expect(key).toMatch(
      /^documents\/123e4567-e89b-42d3-a456-426614174000\/v2\/[0-9a-f-]{36}\.pdf$/u,
    );
    expect(key).not.toMatch(/student|email|request/iu);
    expect(checksumDocument(new Uint8Array([1, 2, 3]))).toBe(
      "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81",
    );
  });
});

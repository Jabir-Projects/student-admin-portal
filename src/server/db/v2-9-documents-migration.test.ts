// @vitest-environment node

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationName = "20260804120000_v2_9_documents_private_storage";
const migrationDirectory = path.resolve(process.cwd(), "prisma/migrations");
const sql = fs.readFileSync(
  path.join(migrationDirectory, migrationName, "migration.sql"),
  "utf8",
);

describe("V2-9 document artifact migration", () => {
  it("remains the additive tenth migration as later migrations are added", () => {
    const migrations = fs
      .readdirSync(migrationDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(migrations.length).toBeGreaterThanOrEqual(10);
    expect(migrations.at(9)).toBe(migrationName);
    expect(sql).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE\s+FROM)\b/iu);
  });

  it("defines the locked type, lifecycle, provider, and notification enums", () => {
    expect(sql).toContain("REQUEST_FULFILMENT_CONFIRMATION");
    for (const status of ["GENERATED", "RELEASED", "REVOKED", "SUPERSEDED"])
      expect(sql).toContain(`'${status}'`);
    expect(sql).toContain("VERCEL_BLOB");
    expect(sql).toContain("DOCUMENT_RELEASED");
    expect(sql).toContain("DOCUMENT_REVOKED");
  });

  it("enforces immutable version, private metadata, and lifecycle integrity", () => {
    for (const name of [
      "DocumentArtifact_requestId_version_key",
      "DocumentArtifact_storageKey_key",
      "DocumentArtifact_version_check",
      "DocumentArtifact_mimeType_check",
      "DocumentArtifact_byteSize_check",
      "DocumentArtifact_checksum_check",
      "DocumentArtifact_storageKey_check",
      "DocumentArtifact_no_self_supersession",
      "DocumentArtifact_lifecycle_check",
    ])
      expect(sql).toContain(name);
    expect(sql).toContain('REFERENCES "DocumentRequest"("id")');
    expect(sql.match(/REFERENCES "User"\("id"\)/gu)).toHaveLength(3);
    expect(sql).not.toMatch(/providerUrl|publicUrl|documentBytes|pdfBytes/iu);
  });
});

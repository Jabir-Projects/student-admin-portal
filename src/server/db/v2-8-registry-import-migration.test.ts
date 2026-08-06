// @vitest-environment node

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationName = "20260803180000_v2_8_registry_imports";
const migrationDirectory = path.resolve(process.cwd(), "prisma/migrations");
const sql = fs.readFileSync(
  path.join(migrationDirectory, migrationName, "migration.sql"),
  "utf8",
);
const normalizedSql = sql.replace(/\r\n/gu, "\n");
const schema = fs.readFileSync(
  path.resolve(process.cwd(), "prisma/schema.prisma"),
  "utf8",
);

describe("V2-8 registry import migration", () => {
  it("remains the additive ninth migration as later migrations are added", () => {
    const migrations = fs
      .readdirSync(migrationDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(migrations.length).toBeGreaterThanOrEqual(9);
    expect(migrations.at(8)).toBe(migrationName);
    expect(sql).not.toMatch(/\bDROP\s+(?:TABLE|TYPE|COLUMN)\b/iu);
  });

  it("defines the exact registry-only lifecycle and staging models", () => {
    expect(sql).toContain(`CREATE TYPE "ImportType" AS ENUM ('REGISTRY')`);
    expect(sql).toContain("'UPLOADED'");
    expect(sql).toContain("'VALIDATED'");
    expect(sql).toContain("'PENDING_APPROVAL'");
    expect(sql).toContain("'APPROVED'");
    expect(sql).toContain("'REJECTED'");
    expect(sql).toContain("'FAILED'");
    expect(sql).toContain('CREATE TABLE "ImportBatch"');
    expect(sql).toContain('CREATE TABLE "RegistryImportRow"');
    expect(schema).toContain("model ImportBatch {");
    expect(schema).toContain("model RegistryImportRow {");
  });

  it("enforces identity, bounds, attribution, retention, and safe cascading", () => {
    expect(sql).toContain('"ImportBatch_type_checksum_key"');
    expect(sql).toContain('"ImportBatch_byteSize_check"');
    expect(sql).toContain('"ImportBatch_counts_check"');
    expect(sql).toContain('"ImportBatch_review_tracking_check"');
    expect(sql).toContain('"ImportBatch_purge_check"');
    expect(sql).toContain('"RegistryImportRow_errorCodes_check"');
    expect(sql).toContain('REFERENCES "User"("id")');
    expect(normalizedSql).toContain(
      'REFERENCES "ImportBatch"("id")\n  ON DELETE CASCADE ON UPDATE CASCADE',
    );
  });

  it("does not store uploaded bytes or filesystem paths", () => {
    expect(sql).not.toMatch(/(?:rawFile|fileBytes|filePath|workbookBytes)/iu);
    expect(schema).not.toMatch(/(?:rawFile|fileBytes|filePath|workbookBytes)/u);
  });
});

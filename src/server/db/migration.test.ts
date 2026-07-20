// @vitest-environment node

import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const migrationDirectory = path.resolve(process.cwd(), "prisma/migrations");
const migrationPath = fs
  .readdirSync(migrationDirectory, { withFileTypes: true })
  .filter(
    (entry) => entry.isDirectory() && entry.name.endsWith("_init_database"),
  )
  .map((entry) => path.join(migrationDirectory, entry.name, "migration.sql"))
  .at(0);

if (!migrationPath) {
  throw new Error("The init_database migration is missing.");
}

const migrationSql = fs.readFileSync(migrationPath, "utf8");

describe("init_database migration", () => {
  it("uses a sequence instead of counting request rows", () => {
    expect(migrationSql).toContain(
      'CREATE SEQUENCE "document_request_reference_seq"',
    );
    expect(migrationSql).toContain(
      "nextval('document_request_reference_seq'::regclass)",
    );
    expect(migrationSql).not.toMatch(/count\s*\(/iu);
  });

  it("enforces positive copy counts", () => {
    expect(migrationSql).toContain(
      'CONSTRAINT "DocumentRequest_copyCount_check" CHECK ("copyCount" > 0)',
    );
  });

  it("protects status history and audit logs from mutation", () => {
    expect(migrationSql).toContain(
      'CREATE TRIGGER "RequestStatusHistory_append_only"',
    );
    expect(migrationSql).toContain('CREATE TRIGGER "AuditLog_append_only"');
    expect(migrationSql.match(/BEFORE UPDATE OR DELETE/gu)).toHaveLength(2);
  });

  it("contains no destructive data or schema statements", () => {
    expect(migrationSql).not.toMatch(/^\s*DROP\s/imu);
    expect(migrationSql).not.toMatch(/^\s*TRUNCATE\s/imu);
    expect(migrationSql).not.toMatch(/^\s*DELETE\s+FROM\s/imu);
  });
});

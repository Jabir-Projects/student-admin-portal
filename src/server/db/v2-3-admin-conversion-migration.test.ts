// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "prisma/migrations/20260731120000_v2_3_admin_to_staff_conversion/migration.sql",
);
const schemaPath = path.resolve(process.cwd(), "prisma/schema.prisma");
const sql = fs.readFileSync(migrationPath, "utf8");
const schema = fs.readFileSync(schemaPath, "utf8");
const executableSql = sql
  .replace(/--[^\r\n]*/gu, " ")
  .replace(/\s+/gu, " ")
  .trim();

describe("V2-3 ADMIN-to-STAFF conversion migration", () => {
  it("keeps the entire conversion and enum replacement atomic", () => {
    expect(sql.match(/^BEGIN;$/gmu)).toHaveLength(1);
    expect(sql.match(/^COMMIT;$/gmu)).toHaveLength(1);
    expect(executableSql.startsWith("BEGIN;")).toBe(true);
    expect(executableSql.endsWith("COMMIT;")).toBe(true);
    expect(executableSql).toContain(
      'LOCK TABLE "User" IN SHARE ROW EXCLUSIVE MODE',
    );
    expect(executableSql).toContain(
      'LOCK TABLE "UserCapabilityAssignment" IN SHARE ROW EXCLUSIVE MODE',
    );
  });

  it("converts every legacy ADMIN without an identity allowlist or privilege grant", () => {
    expect(executableSql).toContain(`WHERE legacy."role" = 'ADMIN'`);
    expect(executableSql).toContain(
      `UPDATE "User" subject SET "role" = 'STAFF'`,
    );
    expect(executableSql).not.toMatch(
      /@example\.|10000000-0000-4000-8000-000000000001/iu,
    );
    expect(executableSql).not.toMatch(
      /INSERT INTO "UserCapabilityAssignment"|UPDATE "UserCapabilityAssignment"|DELETE FROM "UserCapabilityAssignment"/iu,
    );
  });

  it("preserves exact assignment counts and invalidates converted sessions", () => {
    expect(executableSql).toContain(
      `count(assignment."capability")::INTEGER AS "capabilityCount"`,
    );
    expect(executableSql).toContain(
      `"sessionVersion" = subject."sessionVersion" + 1`,
    );
    expect(executableSql).toContain(
      `snapshot."capabilityCount" <> ( SELECT count(*)::INTEGER FROM "UserCapabilityAssignment"`,
    );
  });

  it("fails closed unless an active capability manager survives", () => {
    expect(
      executableSql.match(
        /assignment\."capability" = 'MANAGE_STAFF_CAPABILITIES'/gu,
      ),
    ).toHaveLength(2);
    expect(executableSql).toContain(`manager."status" = 'ACTIVE'`);
    expect(executableSql).toContain(
      "conversion requires an active capability manager",
    );
    expect(executableSql).toContain(
      "conversion did not preserve an active capability manager",
    );
  });

  it("writes one deterministic, redacted system audit event per conversion", () => {
    expect(executableSql).toContain(`INSERT INTO "AuditLog"`);
    expect(executableSql).toContain(`'LEGACY_ADMIN_CONVERTED_TO_STAFF'`);
    expect(executableSql).toContain(
      `md5( 'v2-3-admin-to-staff-conversion:' || snapshot."id"::text )::UUID`,
    );
    expect(executableSql).toContain(`'preservedCapabilityCount'`);
    expect(executableSql).not.toMatch(/email|fullName|password|token|secret/iu);
  });

  it("removes ADMIN from the current database and Prisma enum contract", () => {
    expect(executableSql).toContain(
      `CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'STAFF')`,
    );
    expect(executableSql).toContain(
      `ALTER COLUMN "role" TYPE "UserRole" USING ("role"::text::"UserRole")`,
    );
    expect(executableSql).toContain(`DROP TYPE "UserRole_legacy"`);

    const enumBody = schema.match(/enum UserRole \{([\s\S]*?)\}/u)?.[1];
    expect(enumBody?.match(/[A-Z]+/gu)).toEqual(["STUDENT", "STAFF"]);
  });
});

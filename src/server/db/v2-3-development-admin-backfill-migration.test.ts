// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = fs.readFileSync(
  path.resolve(
    process.cwd(),
    "prisma/migrations/20260727122000_v2_3_development_admin_capability_backfill/migration.sql",
  ),
  "utf8",
);
const executableSql = sql
  .replace(/--[^\r\n]*/gu, " ")
  .replace(/\s+/gu, " ")
  .trim();
const approvedCapabilities = [
  "MANAGE_STUDENT_ACCOUNTS",
  "REACTIVATE_STUDENT_ACCOUNTS",
  "MANAGE_STAFF_ACCOUNTS",
  "MANAGE_STAFF_CAPABILITIES",
] as const;

describe("V2-3 development ADMIN capability backfill migration", () => {
  it("wraps all preflight, insertion, and verification in one transaction", () => {
    expect(sql.match(/^BEGIN;$/gmu)).toHaveLength(1);
    expect(sql.match(/^COMMIT;$/gmu)).toHaveLength(1);
    expect(executableSql.startsWith("BEGIN;")).toBe(true);
    expect(executableSql.endsWith("COMMIT;")).toBe(true);

    const preflight = executableSql.indexOf('SELECT "email", "role", "status"');
    const insertion = executableSql.indexOf(
      'INSERT INTO "UserCapabilityAssignment"',
    );
    const verification = executableSql.indexOf(
      "SELECT count(*) INTO resulting_capability_count",
    );
    expect(preflight).toBeGreaterThan(-1);
    expect(insertion).toBeGreaterThan(preflight);
    expect(verification).toBeGreaterThan(insertion);
  });

  it("targets exactly the approved deterministic development identity", () => {
    expect(sql).toContain("10000000-0000-4000-8000-000000000001");
    expect(sql).toContain("admin.dev@example.invalid");
    expect(executableSql).toContain(`target_role <> 'ADMIN'::"UserRole"`);
    expect(executableSql).toContain(
      `target_status <> 'ACTIVE'::"AccountStatus"`,
    );
    expect(sql.match(/@example\.invalid/gu)).toHaveLength(1);
    expect(sql.match(/10000000-0000-4000-8000-000000000001/gu)).toHaveLength(1);
  });

  it("inserts exactly the four approved capabilities with a bootstrap grantor", () => {
    const insertBody = executableSql.match(
      /INSERT INTO "UserCapabilityAssignment" \("userId", "capability", "grantedById"\) VALUES (.*?);/u,
    )?.[1];
    expect(insertBody).toBeDefined();

    const insertedCapabilities =
      insertBody
        ?.match(/'([A-Z_]+)'::"Capability"/gu)
        ?.map((value) => value.match(/'([A-Z_]+)'/u)?.[1]) ?? [];
    expect(insertedCapabilities).toEqual(approvedCapabilities);
    expect(insertBody?.match(/, NULL\)/gu)).toHaveLength(4);

    const referencedCapabilities = [
      ...new Set(
        sql
          .match(/'([A-Z_]+)'::"Capability"/gu)
          ?.map((value) => value.match(/'([A-Z_]+)'/u)?.[1]) ?? [],
      ),
    ];
    expect(referencedCapabilities).toEqual(approvedCapabilities);
  });

  it("fails before insertion for missing, mismatched, inactive, or preassigned targets", () => {
    expect(executableSql).toContain("IF NOT FOUND THEN RAISE EXCEPTION");
    expect(executableSql).toContain(
      "IF target_email <> expected_email THEN RAISE EXCEPTION",
    );
    expect(executableSql).toContain(
      `IF target_role <> 'ADMIN'::"UserRole" THEN RAISE EXCEPTION`,
    );
    expect(executableSql).toContain(
      `IF target_status <> 'ACTIVE'::"AccountStatus" THEN RAISE EXCEPTION`,
    );
    expect(executableSql).toContain(
      'IF EXISTS ( SELECT 1 FROM "UserCapabilityAssignment" WHERE "userId" = target_user_id ) THEN RAISE EXCEPTION',
    );
    expect(sql).not.toMatch(/ON\s+CONFLICT/iu);
  });

  it("verifies the resulting set and nullable bootstrap grantor after insertion", () => {
    expect(executableSql).toContain(
      'SELECT count(*) INTO resulting_capability_count FROM "UserCapabilityAssignment" WHERE "userId" = target_user_id',
    );
    expect(executableSql).toContain(
      "IF resulting_capability_count <> 4 THEN RAISE EXCEPTION",
    );
    expect(executableSql).toContain('AND "capability" NOT IN (');
    expect(executableSql).toContain('AND "grantedById" IS NOT NULL');
  });

  it("does not convert roles, modify session versions, or use destructive SQL", () => {
    expect(executableSql).not.toMatch(
      /UPDATE\s+"User"|ALTER\s+TABLE\s+"User"|sessionVersion|'STAFF'/iu,
    );
    expect(executableSql).not.toMatch(
      /\bDELETE\b|\bDROP\b|\bTRUNCATE\b|migrate\s+reset|db\s+push/iu,
    );
  });
});

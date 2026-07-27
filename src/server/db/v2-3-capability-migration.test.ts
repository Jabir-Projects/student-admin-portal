// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const staffRoleSql = fs.readFileSync(
  path.resolve(
    process.cwd(),
    "prisma/migrations/20260727120000_v2_3_add_staff_role/migration.sql",
  ),
  "utf8",
);
const foundationSql = fs.readFileSync(
  path.resolve(
    process.cwd(),
    "prisma/migrations/20260727121000_v2_3_capability_session_foundation/migration.sql",
  ),
  "utf8",
);
const executableFoundationSql = foundationSql
  .replace(/--[^\r\n]*/gu, " ")
  .replace(/\s+/gu, " ")
  .trim();

const capabilities = [
  "MANAGE_STUDENT_ACCOUNTS",
  "REACTIVATE_STUDENT_ACCOUNTS",
  "MANAGE_STAFF_ACCOUNTS",
  "MANAGE_STAFF_CAPABILITIES",
  "PROCESS_REQUESTS",
  "MANAGE_REQUEST_CATEGORIES",
  "GENERATE_DOCUMENTS",
  "RELEASE_DOCUMENTS",
  "REVOKE_DOCUMENTS",
  "REGISTRY_IMPORT_UPLOAD",
  "REGISTRY_IMPORT_APPROVE",
  "FINANCE_IMPORT_UPLOAD",
  "FINANCE_IMPORT_APPROVE",
  "VIEW_FINANCE",
  "VIEW_AUDIT_LOG",
  "EXPORT_STUDENT_DATA",
  "EXPORT_REQUEST_DATA",
  "EXPORT_FINANCE_DATA",
] as const;

function executableStatements(sql: string): string[] {
  return sql
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("--"));
}

describe("V2-3 STAFF role migration contract", () => {
  it("commits STAFF as a separate additive enum change", () => {
    const statements = executableStatements(staffRoleSql);
    expect(statements[0]).toBe("BEGIN;");
    expect(statements.at(-1)).toBe("COMMIT;");
    expect(staffRoleSql).toContain(`ALTER TYPE "UserRole" ADD VALUE 'STAFF';`);
    expect(staffRoleSql).not.toContain("UserCapabilityAssignment");
    expect(staffRoleSql).not.toMatch(/\bDROP\b|\bDELETE\b|\bTRUNCATE\b/iu);
  });
});

describe("V2-3 capability and session foundation migration contract", () => {
  it("wraps the additive foundation in one transaction", () => {
    const statements = executableStatements(foundationSql);
    expect(statements[0]).toBe("BEGIN;");
    expect(statements.at(-1)).toBe("COMMIT;");
    expect(foundationSql.match(/^BEGIN;$/gmu)).toHaveLength(1);
    expect(foundationSql.match(/^COMMIT;$/gmu)).toHaveLength(1);
  });

  it("defines exactly the approved 18 capabilities", () => {
    const enumBody = foundationSql.match(
      /CREATE TYPE "Capability" AS ENUM \(([\s\S]*?)\);/u,
    )?.[1];
    expect(enumBody).toBeDefined();
    expect(
      enumBody?.match(/'([A-Z_]+)'/gu)?.map((value) => value.slice(1, -1)),
    ).toEqual(capabilities);
  });

  it("adds a non-negative sessionVersion with a safe existing-row default", () => {
    expect(executableFoundationSql).toContain(
      'ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0',
    );
    expect(executableFoundationSql).toContain(
      'CONSTRAINT "User_sessionVersion_nonnegative_check" CHECK ("sessionVersion" >= 0)',
    );
  });

  it("creates the assignment key, relations, checks, and lookup indexes", () => {
    expect(executableFoundationSql).toContain(
      'CREATE TABLE "UserCapabilityAssignment"',
    );
    expect(executableFoundationSql).toContain(
      'PRIMARY KEY ("userId", "capability")',
    );
    expect(executableFoundationSql).toContain(
      'CHECK ("grantedById" IS NULL OR "grantedById" <> "userId")',
    );
    expect(executableFoundationSql).toContain(
      'FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    );
    expect(executableFoundationSql).toContain(
      'FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE',
    );
    expect(foundationSql).toContain(
      '"UserCapabilityAssignment_capability_userId_idx"',
    );
    expect(foundationSql).toContain(
      '"UserCapabilityAssignment_grantedById_createdAt_idx"',
    );
  });

  it("does not backfill, convert ADMIN, or use destructive operations", () => {
    const dataMutationSql = executableFoundationSql
      .replace(/\bON DELETE RESTRICT\b/giu, "")
      .replace(/\bON UPDATE CASCADE\b/giu, "");
    expect(dataMutationSql).not.toMatch(
      /\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bTRUNCATE\b/iu,
    );
    expect(foundationSql).not.toContain("'ADMIN'");
    expect(foundationSql).not.toMatch(
      /migrate\s+reset|db\s+push|prisma\s+migrate\s+deploy/iu,
    );
  });
});

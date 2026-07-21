// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sql = fs.readFileSync(
  path.resolve(
    process.cwd(),
    "prisma/migrations/20260721120000_phase_3_authentication/migration.sql",
  ),
  "utf8",
);

const executableStatements = sql
  .split(/\r?\n/u)
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("--"));

describe("Phase 3 migration contract", () => {
  it("wraps every operation in one explicit transaction", () => {
    expect(executableStatements[0]).toBe("BEGIN;");
    expect(executableStatements.at(-1)).toBe("COMMIT;");
    expect(sql.match(/^BEGIN;$/gmu)).toHaveLength(1);
    expect(sql.match(/^COMMIT;$/gmu)).toHaveLength(1);
  });

  it("preserves full names with a true column rename", () => {
    expect(sql).toContain('RENAME COLUMN "displayName" TO "fullName"');
    expect(sql).not.toContain('DROP COLUMN "displayName"');
    expect(sql).not.toMatch(/ADD COLUMN\s+"fullName"/iu);
  });

  it("defines the exact approved enums", () => {
    expect(sql).toContain(
      `CREATE TYPE "AccountStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'DISABLED')`,
    );
    expect(sql).toContain(
      `CREATE TYPE "AcademicYear" AS ENUM ('FOUNDATION', 'YEAR_1', 'YEAR_2', 'YEAR_3', 'MASTER_1', 'MASTER_2')`,
    );
  });

  it("guards and maps every supported legacy academic year", () => {
    expect(sql).toContain('"academicYear" NOT IN (1, 2, 3)');
    expect(sql).toContain("WHEN 1 THEN 'YEAR_1'");
    expect(sql).toContain("WHEN 2 THEN 'YEAR_2'");
    expect(sql).toContain("WHEN 3 THEN 'YEAR_3'");
  });

  it("backfills existing users and changes only the future default", () => {
    expect(sql).toContain(
      'ADD COLUMN "status" "AccountStatus" NOT NULL DEFAULT \'ACTIVE\'',
    );
    expect(sql).toContain(
      'ALTER TABLE "User" ALTER COLUMN "status" SET DEFAULT \'PENDING_APPROVAL\'',
    );
  });

  it("normalizes identifiers after collision guards and enforces checks", () => {
    const guardEnd = sql.indexOf("END $$;");
    const emailUpdate = sql.indexOf('UPDATE "User" SET "email"');
    const studentNumberUpdate = sql.indexOf(
      'UPDATE "StudentProfile" SET "studentNumber"',
    );
    expect(sql).toContain('GROUP BY lower(btrim("email"))');
    expect(sql).toContain('GROUP BY upper(btrim("studentNumber"))');
    expect(emailUpdate).toBeGreaterThan(guardEnd);
    expect(studentNumberUpdate).toBeGreaterThan(guardEnd);
    expect(sql).toContain('"email" = lower(btrim("email"))');
    expect(sql).toContain('"studentNumber" = upper(btrim("studentNumber"))');
    expect(sql).toContain('"User_email_normalized_check"');
    expect(sql).toContain('"StudentProfile_studentNumber_normalized_check"');
  });

  it("enforces paired tracking while allowing every approved transition", () => {
    expect(sql).toContain(
      'CHECK (("approvedAt" IS NULL) = ("approvedById" IS NULL))',
    );
    expect(sql).toContain(
      'CHECK (("disabledAt" IS NULL) = ("disabledById" IS NULL))',
    );
    expect(sql).toContain(
      `("status" = 'PENDING_APPROVAL' AND "approvedAt" IS NULL AND "disabledAt" IS NULL)`,
    );
    expect(sql).toContain(`OR ("status" = 'ACTIVE' AND "disabledAt" IS NULL)`);
    expect(sql).toContain(
      `OR ("status" = 'DISABLED' AND "disabledAt" IS NOT NULL)`,
    );
  });

  it("creates both restrictive self-relations and approved indexes", () => {
    for (const field of ["approvedById", "disabledById"]) {
      expect(sql).toContain(
        `FOREIGN KEY ("${field}") REFERENCES "User"("id") ON DELETE RESTRICT`,
      );
    }
    expect(sql).toContain('"User_status_role_createdAt_idx"');
    expect(sql).toContain('"User_approvedById_approvedAt_idx"');
    expect(sql).toContain('"User_disabledById_disabledAt_idx"');
  });

  it("contains no destructive or alternate-migration strategy", () => {
    expect(sql).not.toMatch(
      /DROP\s+(DATABASE|SCHEMA|TABLE)|TRUNCATE|DELETE\s+FROM|migrate\s+reset|db\s+push/iu,
    );
    expect(sql).not.toMatch(/CREATE\s+TABLE\s+"(?:User|StudentProfile)"/iu);
  });
});

// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function stripPostgreSqlComments(source: string): string {
  let executable = "";
  let index = 0;

  while (index < source.length) {
    const character = source[index];

    if (character === "'" || character === '"') {
      const quote = character;
      const start = index;
      let closed = false;
      index += 1;

      while (index < source.length) {
        if (source[index] !== quote) {
          index += 1;
          continue;
        }
        if (source[index + 1] === quote) {
          index += 2;
          continue;
        }

        index += 1;
        closed = true;
        break;
      }

      if (!closed) throw new Error("Unterminated quoted SQL value");
      executable += source.slice(start, index);
      continue;
    }

    if (character === "$") {
      const tag = source
        .slice(index)
        .match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/u)?.[0];

      if (tag) {
        const closingIndex = source.indexOf(tag, index + tag.length);
        if (closingIndex === -1)
          throw new Error("Unterminated dollar-quoted SQL value");

        const end = closingIndex + tag.length;
        executable += source.slice(index, end);
        index = end;
        continue;
      }
    }

    if (source.startsWith("--", index)) {
      executable += " ";
      index += 2;
      while (
        index < source.length &&
        source[index] !== "\r" &&
        source[index] !== "\n"
      ) {
        index += 1;
      }
      continue;
    }

    if (source.startsWith("/*", index)) {
      executable += " ";
      index += 2;
      let depth = 1;

      while (index < source.length && depth > 0) {
        if (source.startsWith("/*", index)) {
          depth += 1;
          index += 2;
        } else if (source.startsWith("*/", index)) {
          depth -= 1;
          index += 2;
        } else {
          if (source[index] === "\r" || source[index] === "\n") {
            executable += source[index];
          }
          index += 1;
        }
      }

      if (depth > 0) throw new Error("Unterminated SQL block comment");
      continue;
    }

    executable += character;
    index += 1;
  }

  return executable;
}

const migrationPath = path.resolve(
  process.cwd(),
  "prisma/migrations/20260722125928_phase_3_2_student_registry/migration.sql",
);
const sql = fs.readFileSync(migrationPath, "utf8");
const executableSql = stripPostgreSqlComments(sql);
const compactExecutableSql = executableSql.replace(/\s+/gu, " ").trim();

describe("Phase 3.2 Student Registry migration contract", () => {
  it("strips comments without altering quoted executable SQL", () => {
    const sample = stripPostgreSqlComments(`
      -- CREATE TABLE "CommentedOut" ("id" UUID);
      SELECT '-- literal', '/* literal */', "identifier--part", $$-- dollar literal$$;
      /* DROP TABLE "CommentedOut"; /* nested block comment */ */
    `);

    expect(sample).not.toContain('CREATE TABLE "CommentedOut"');
    expect(sample).not.toContain('DROP TABLE "CommentedOut"');
    expect(sample).toContain(
      `SELECT '-- literal', '/* literal */', "identifier--part", $$-- dollar literal$$;`,
    );
  });

  it("wraps every schema operation in one explicit transaction", () => {
    const beginStatements =
      executableSql.match(/^[\t ]*BEGIN[\t ]*;[\t ]*$/gimu) ?? [];
    const commitStatements =
      executableSql.match(/^[\t ]*COMMIT[\t ]*;[\t ]*$/gimu) ?? [];

    expect(beginStatements).toHaveLength(1);
    expect(commitStatements).toHaveLength(1);
    expect(executableSql).toMatch(/^\s*BEGIN[\t ]*;/iu);
    expect(executableSql).toMatch(/COMMIT[\t ]*;\s*$/iu);
  });

  it("defines the exact approved registry enums", () => {
    expect(compactExecutableSql).toContain(
      `CREATE TYPE "StudentRegistryStatus" AS ENUM ('ACTIVE', 'INACTIVE');`,
    );
    expect(compactExecutableSql).toContain(
      `CREATE TYPE "StudentRegistrySource" AS ENUM ('DEVELOPMENT_DEMO', 'OFFICIAL_IMPORT');`,
    );
    expect(executableSql).not.toMatch(
      /ALTER\s+TYPE\s+"(?:StudentRegistryStatus|StudentRegistrySource)"/iu,
    );
  });

  it("creates the executable StudentRegistry table and every expected column", () => {
    const tableStatement = executableSql.match(
      /(?:^|;)\s*(CREATE\s+TABLE\s+"StudentRegistry"\s*\([\s\S]*?\)\s*;)/iu,
    )?.[1];

    expect(tableStatement).toBeDefined();
    const compactTableStatement = (tableStatement ?? "")
      .replace(/\s+/gu, " ")
      .trim();

    for (const column of [
      '"id" UUID NOT NULL',
      '"studentNumber" VARCHAR(50) NOT NULL',
      '"fullName" VARCHAR(200) NOT NULL',
      '"normalizedFullName" VARCHAR(200) NOT NULL',
      '"email" VARCHAR(320) NOT NULL',
      '"program" VARCHAR(200) NOT NULL',
      '"academicYear" "AcademicYear" NOT NULL',
      '"status" "StudentRegistryStatus" NOT NULL DEFAULT \'ACTIVE\'',
      '"source" "StudentRegistrySource" NOT NULL',
      '"registeredUserId" UUID',
      '"registeredAt" TIMESTAMPTZ(3)',
      '"createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP',
      '"updatedAt" TIMESTAMPTZ(3) NOT NULL',
    ]) {
      expect(compactTableStatement).toContain(column);
    }

    expect(compactTableStatement).toContain(
      'CONSTRAINT "StudentRegistry_pkey" PRIMARY KEY ("id")',
    );
  });

  it("creates executable unique indexes for registry identifiers and linkage", () => {
    for (const [indexName, column] of [
      ["StudentRegistry_studentNumber_key", "studentNumber"],
      ["StudentRegistry_email_key", "email"],
      ["StudentRegistry_registeredUserId_key", "registeredUserId"],
    ]) {
      expect(compactExecutableSql).toContain(
        `CREATE UNIQUE INDEX "${indexName}" ON "StudentRegistry"("${column}");`,
      );
    }
  });

  it("creates the executable restrictive one-to-one User foreign key", () => {
    expect(compactExecutableSql).toContain(
      'ALTER TABLE "StudentRegistry" ADD CONSTRAINT "StudentRegistry_registeredUserId_fkey" FOREIGN KEY ("registeredUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;',
    );
  });

  it("binds every required CHECK name to its executable expression", () => {
    for (const [constraintName, expression] of [
      [
        "StudentRegistry_email_normalized_check",
        'CHECK ("email" = lower(btrim("email")))',
      ],
      [
        "StudentRegistry_studentNumber_normalized_check",
        'CHECK ("studentNumber" = upper(btrim("studentNumber")))',
      ],
      [
        "StudentRegistry_studentNumber_format_check",
        `CHECK ("studentNumber" ~ '^[A-Z0-9][A-Z0-9._/-]{0,49}$')`,
      ],
      [
        "StudentRegistry_normalizedFullName_check",
        'CHECK (length("normalizedFullName") > 0 AND "normalizedFullName" = btrim("normalizedFullName"))',
      ],
      [
        "StudentRegistry_registration_link_pair_check",
        'CHECK (("registeredUserId" IS NULL) = ("registeredAt" IS NULL))',
      ],
    ]) {
      expect(compactExecutableSql).toContain(
        `ADD CONSTRAINT "${constraintName}" ${expression}`,
      );
    }
  });

  it("contains no executable destructive operation or existing-data rewrite", () => {
    const executableSqlWithoutStringLiterals = executableSql.replace(
      /'(?:''|[^'])*'/gu,
      "''",
    );
    const destructiveSql = executableSqlWithoutStringLiterals.replace(
      /\bON\s+UPDATE\s+CASCADE\b/giu,
      "",
    );

    expect(destructiveSql).not.toMatch(/\bDROP\b/iu);
    expect(destructiveSql).not.toMatch(/\bTRUNCATE\b/iu);
    expect(destructiveSql).not.toMatch(/\bDELETE\s+FROM\b/iu);
    expect(destructiveSql).not.toMatch(/\bUPDATE\b/iu);
    expect(destructiveSql).not.toMatch(/\bINSERT\s+INTO\b/iu);
    expect(destructiveSql).not.toMatch(
      /\b(?:prisma\s+)?migrate\s+reset\b|\bdb\s+(?:push|reset)\b|\bdatabase\s+reset\b/iu,
    );
    expect(destructiveSql).not.toMatch(/\bALTER\s+TYPE\b/iu);

    const alteredTables = [
      ...destructiveSql.matchAll(
        /\bALTER\s+TABLE\s+(?:ONLY\s+)?(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))/giu,
      ),
    ].map((match) => match[1] ?? match[2]);

    expect(alteredTables.length).toBeGreaterThan(0);
    expect(alteredTables.every((table) => table === "StudentRegistry")).toBe(
      true,
    );
    expect(destructiveSql).not.toMatch(
      /\bCREATE\s+TABLE\s+"(?:User|StudentProfile)"/iu,
    );
  });
});

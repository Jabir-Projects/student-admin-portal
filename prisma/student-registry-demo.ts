import { z } from "zod";

import {
  Prisma,
  type PrismaClient,
  StudentRegistrySource,
  StudentRegistryStatus,
} from "@/generated/prisma/client";
import {
  type StudentRegistryEntry,
  studentRegistryEntrySchema,
} from "@/features/student-registry/schemas";

const fixtureIdSchema = z.uuid();

const fixtureInputs = [
  {
    id: "90000000-0000-4000-8000-000000000001",
    studentNumber: "SIST-DEMO-0001",
    fullName: "Demo Student One",
    email: "demo.student1@example.test",
    program: "Foundation Year",
    academicYear: "FOUNDATION",
  },
  {
    id: "90000000-0000-4000-8000-000000000002",
    studentNumber: "SIST-DEMO-0002",
    fullName: "Demo Student Two",
    email: "demo.student2@example.test",
    program: "BAC+3 Software Engineering",
    academicYear: "YEAR_2",
  },
  {
    id: "90000000-0000-4000-8000-000000000003",
    studentNumber: "SIST-DEMO-0003",
    fullName: "Demo Student Three",
    email: "demo.student3@example.test",
    program: "BAC+5 Business Administration",
    academicYear: "MASTER_1",
  },
] as const;

export type StudentRegistryDemoFixture = StudentRegistryEntry & {
  id: string;
  status: typeof StudentRegistryStatus.ACTIVE;
  source: typeof StudentRegistrySource.DEVELOPMENT_DEMO;
  registeredUserId: null;
  registeredAt: null;
};

export type StudentRegistryDemoSummary = {
  inserted: number;
  existing: number;
  preservedLinked: number;
  preservedInactive: number;
};

type StudentRegistryDemoDatabase = Pick<PrismaClient, "$transaction">;

const registrySelect = {
  id: true,
  studentNumber: true,
  fullName: true,
  normalizedFullName: true,
  email: true,
  program: true,
  academicYear: true,
  status: true,
  source: true,
  registeredUserId: true,
  registeredAt: true,
} satisfies Prisma.StudentRegistrySelect;

type RegistryRow = Prisma.StudentRegistryGetPayload<{
  select: typeof registrySelect;
}>;

type PreservedState = Pick<
  RegistryRow,
  "status" | "registeredUserId" | "registeredAt"
>;

class StudentRegistryDemoSeedError extends Error {
  constructor(category: string) {
    super(`STUDENT_REGISTRY_DEMO_${category}`);
    this.name = "StudentRegistryDemoSeedError";
  }
}

function fail(category: string): never {
  throw new StudentRegistryDemoSeedError(category);
}

function assertRuntime(
  runtime: string | undefined,
): asserts runtime is "development" | "test" {
  if (runtime === "production") fail("PRODUCTION_REFUSED");
  if (runtime !== "development" && runtime !== "test") {
    fail("INVALID_RUNTIME");
  }
}

function assertUnique(values: string[]): void {
  if (new Set(values).size !== values.length) fail("INVALID_FIXTURES");
}

function buildValidatedFixtures(): StudentRegistryDemoFixture[] {
  const fixtures = fixtureInputs.map(({ id, ...rawIdentity }) => {
    const identity = studentRegistryEntrySchema.safeParse(rawIdentity);
    const parsedId = fixtureIdSchema.safeParse(id);
    if (!identity.success || !parsedId.success) fail("INVALID_FIXTURES");

    return {
      id: parsedId.data,
      ...identity.data,
      status: StudentRegistryStatus.ACTIVE,
      source: StudentRegistrySource.DEVELOPMENT_DEMO,
      registeredUserId: null,
      registeredAt: null,
    } satisfies StudentRegistryDemoFixture;
  });

  if (fixtures.length !== 3) fail("INVALID_FIXTURES");
  assertUnique(fixtures.map(({ id }) => id));
  assertUnique(fixtures.map(({ studentNumber }) => studentNumber));
  assertUnique(fixtures.map(({ email }) => email));

  for (const fixture of fixtures) {
    if (!fixture.email.endsWith("@example.test")) fail("INVALID_FIXTURES");
    if (!fixture.studentNumber.startsWith("SIST-DEMO-")) {
      fail("INVALID_FIXTURES");
    }
    if (fixture.source !== StudentRegistrySource.DEVELOPMENT_DEMO) {
      fail("INVALID_FIXTURES");
    }
  }

  return fixtures;
}

export const studentRegistryDemoFixtures = Object.freeze(
  buildValidatedFixtures().map((fixture) => Object.freeze(fixture)),
);

function immutableFieldsMatch(
  row: RegistryRow,
  fixture: StudentRegistryDemoFixture,
): boolean {
  return (
    row.id === fixture.id &&
    row.studentNumber === fixture.studentNumber &&
    row.fullName === fixture.fullName &&
    row.normalizedFullName === fixture.normalizedFullName &&
    row.email === fixture.email &&
    row.program === fixture.program &&
    row.academicYear === fixture.academicYear &&
    row.source === fixture.source
  );
}

function matchesAnyKey(
  row: RegistryRow,
  fixture: StudentRegistryDemoFixture,
): boolean {
  return (
    row.id === fixture.id ||
    row.studentNumber === fixture.studentNumber ||
    row.email === fixture.email
  );
}

function sameNullableDate(left: Date | null, right: Date | null): boolean {
  if (left === null || right === null) return left === right;
  return left.getTime() === right.getTime();
}

function findExactRow(
  rows: RegistryRow[],
  fixture: StudentRegistryDemoFixture,
  failureCategory: string,
): RegistryRow | null {
  const matches = rows.filter((row) => matchesAnyKey(row, fixture));
  if (matches.length === 0) return null;
  if (matches.length !== 1 || !immutableFieldsMatch(matches[0]!, fixture)) {
    fail(failureCategory);
  }
  return matches[0]!;
}

function fixtureFilter(fixtures: StudentRegistryDemoFixture[]) {
  return {
    OR: [
      { id: { in: fixtures.map(({ id }) => id) } },
      {
        studentNumber: {
          in: fixtures.map(({ studentNumber }) => studentNumber),
        },
      },
      { email: { in: fixtures.map(({ email }) => email) } },
    ],
  } satisfies Prisma.StudentRegistryWhereInput;
}

export async function reconcileStudentRegistryDemo(
  database: StudentRegistryDemoDatabase,
  runtime: string | undefined,
): Promise<StudentRegistryDemoSummary> {
  assertRuntime(runtime);
  const fixtures = buildValidatedFixtures();
  const where = fixtureFilter(fixtures);

  return database.$transaction(async (transaction) => {
    const existingRows = await transaction.studentRegistry.findMany({
      where,
      select: registrySelect,
    });
    const missing: StudentRegistryDemoFixture[] = [];
    const preservedByFixtureId = new Map<string, PreservedState>();
    let preservedLinked = 0;
    let preservedInactive = 0;

    for (const fixture of fixtures) {
      const row = findExactRow(existingRows, fixture, "IDENTIFIER_CONFLICT");
      if (!row) {
        missing.push(fixture);
        continue;
      }

      preservedByFixtureId.set(fixture.id, {
        status: row.status,
        registeredUserId: row.registeredUserId,
        registeredAt: row.registeredAt,
      });
      if (row.registeredUserId !== null || row.registeredAt !== null) {
        preservedLinked += 1;
      }
      if (row.status === StudentRegistryStatus.INACTIVE) {
        preservedInactive += 1;
      }
    }

    const inserted = missing.length
      ? (
          await transaction.studentRegistry.createMany({
            data: missing,
            skipDuplicates: true,
          })
        ).count
      : 0;

    const finalRows = await transaction.studentRegistry.findMany({
      where,
      select: registrySelect,
    });
    if (finalRows.length !== fixtures.length) fail("FINAL_CONFLICT");

    for (const fixture of fixtures) {
      const row = findExactRow(finalRows, fixture, "FINAL_CONFLICT");
      if (!row) fail("FINAL_CONFLICT");

      const preserved = preservedByFixtureId.get(fixture.id);
      if (preserved) {
        if (
          row.status !== preserved.status ||
          row.registeredUserId !== preserved.registeredUserId ||
          !sameNullableDate(row.registeredAt, preserved.registeredAt)
        ) {
          fail("FINAL_CONFLICT");
        }
      } else if (
        row.status !== StudentRegistryStatus.ACTIVE ||
        row.registeredUserId !== null ||
        row.registeredAt !== null
      ) {
        fail("FINAL_CONFLICT");
      }
    }

    return {
      inserted,
      existing: fixtures.length - inserted,
      preservedLinked,
      preservedInactive,
    };
  });
}

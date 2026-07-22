// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  StudentRegistrySource,
  StudentRegistryStatus,
} from "@/generated/prisma/client";
import {
  reconcileStudentRegistryDemo,
  studentRegistryDemoFixtures,
  type StudentRegistryDemoFixture,
} from "../../../prisma/student-registry-demo";

type MockRow = Omit<
  StudentRegistryDemoFixture,
  "status" | "source" | "registeredUserId" | "registeredAt"
> & {
  status: StudentRegistryStatus;
  source: StudentRegistrySource;
  registeredUserId: string | null;
  registeredAt: Date | null;
};

type DatabaseOptions = {
  afterCreate?: (rows: MockRow[]) => void;
};

function cloneRow(row: MockRow): MockRow {
  return {
    ...row,
    registeredAt: row.registeredAt
      ? new Date(row.registeredAt.getTime())
      : null,
  };
}

function fixtureRow(index: number, overrides: Partial<MockRow> = {}): MockRow {
  return {
    ...studentRegistryDemoFixtures[index]!,
    ...overrides,
  };
}

function createDatabase(
  initialRows: MockRow[] = [],
  options: DatabaseOptions = {},
) {
  let committedRows = initialRows.map(cloneRow);
  let transactionRows: MockRow[] = [];

  const findMany = vi.fn(async () => {
    const fixtureIds = new Set(studentRegistryDemoFixtures.map(({ id }) => id));
    const fixtureStudentNumbers = new Set(
      studentRegistryDemoFixtures.map(({ studentNumber }) => studentNumber),
    );
    const fixtureEmails = new Set(
      studentRegistryDemoFixtures.map(({ email }) => email),
    );

    return transactionRows
      .filter(
        (row) =>
          fixtureIds.has(row.id) ||
          fixtureStudentNumbers.has(row.studentNumber) ||
          fixtureEmails.has(row.email),
      )
      .map(cloneRow);
  });

  const createMany = vi.fn(
    async ({ data }: { data: StudentRegistryDemoFixture[] }) => {
      let count = 0;
      for (const fixture of data) {
        const conflicts = transactionRows.some(
          (row) =>
            row.id === fixture.id ||
            row.studentNumber === fixture.studentNumber ||
            row.email === fixture.email,
        );
        if (conflicts) continue;
        transactionRows.push(cloneRow(fixture));
        count += 1;
      }
      options.afterCreate?.(transactionRows);
      return { count };
    },
  );

  const forbidden = {
    delete: vi.fn(),
    deleteMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
  };
  const transaction = {
    studentRegistry: { findMany, createMany, ...forbidden },
  };
  const transactionRunner = vi.fn(
    async (callback: (client: typeof transaction) => Promise<unknown>) => {
      transactionRows = committedRows.map(cloneRow);
      try {
        const result = await callback(transaction);
        committedRows = transactionRows.map(cloneRow);
        return result;
      } finally {
        transactionRows = [];
      }
    },
  );
  const database = {
    $transaction: transactionRunner,
  } as unknown as Parameters<typeof reconcileStudentRegistryDemo>[0];

  return {
    createMany,
    database,
    findMany,
    forbidden,
    rows: () => committedRows.map(cloneRow),
    transactionRunner,
  };
}

const expectedFixtures = [
  {
    id: "90000000-0000-4000-8000-000000000001",
    studentNumber: "SIST-DEMO-0001",
    fullName: "Demo Student One",
    normalizedFullName: "demo student one",
    email: "demo.student1@example.test",
    program: "Foundation Year",
    academicYear: "FOUNDATION",
    status: "ACTIVE",
    source: "DEVELOPMENT_DEMO",
    registeredUserId: null,
    registeredAt: null,
  },
  {
    id: "90000000-0000-4000-8000-000000000002",
    studentNumber: "SIST-DEMO-0002",
    fullName: "Demo Student Two",
    normalizedFullName: "demo student two",
    email: "demo.student2@example.test",
    program: "BAC+3 Software Engineering",
    academicYear: "YEAR_2",
    status: "ACTIVE",
    source: "DEVELOPMENT_DEMO",
    registeredUserId: null,
    registeredAt: null,
  },
  {
    id: "90000000-0000-4000-8000-000000000003",
    studentNumber: "SIST-DEMO-0003",
    fullName: "Demo Student Three",
    normalizedFullName: "demo student three",
    email: "demo.student3@example.test",
    program: "BAC+5 Business Administration",
    academicYear: "MASTER_1",
    status: "ACTIVE",
    source: "DEVELOPMENT_DEMO",
    registeredUserId: null,
    registeredAt: null,
  },
];

describe("Student Registry demo fixture definitions", () => {
  it("contains exactly the three approved canonical fixtures", () => {
    expect(studentRegistryDemoFixtures).toStrictEqual(expectedFixtures);
  });

  it("uses valid, unique UUIDs, Student Numbers, and emails", () => {
    const ids = studentRegistryDemoFixtures.map(({ id }) => id);
    const studentNumbers = studentRegistryDemoFixtures.map(
      ({ studentNumber }) => studentNumber,
    );
    const emails = studentRegistryDemoFixtures.map(({ email }) => email);

    expect(ids.every((id) => z.uuid().safeParse(id).success)).toBe(true);
    expect(new Set(ids)).toHaveLength(3);
    expect(new Set(studentNumbers)).toHaveLength(3);
    expect(new Set(emails)).toHaveLength(3);
  });

  it("uses only the reserved fictional namespace and source", () => {
    for (const fixture of studentRegistryDemoFixtures) {
      expect(fixture.email.endsWith("@example.test")).toBe(true);
      expect(fixture.studentNumber.startsWith("SIST-DEMO-")).toBe(true);
      expect(fixture.source).toBe(StudentRegistrySource.DEVELOPMENT_DEMO);
    }
  });
});

describe("Student Registry demo runtime guard", () => {
  it("refuses production before a transaction or query", async () => {
    const { database, findMany, transactionRunner } = createDatabase();

    await expect(
      reconcileStudentRegistryDemo(database, "production"),
    ).rejects.toThrow("STUDENT_REGISTRY_DEMO_PRODUCTION_REFUSED");
    expect(transactionRunner).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it.each([undefined, "preview", "unsafe-runtime"])(
    "fails closed for unknown runtime %s",
    async (runtime) => {
      const { database, transactionRunner } = createDatabase();

      await expect(
        reconcileStudentRegistryDemo(database, runtime),
      ).rejects.toThrow("STUDENT_REGISTRY_DEMO_INVALID_RUNTIME");
      expect(transactionRunner).not.toHaveBeenCalled();
    },
  );
});

describe("Student Registry demo reconciliation", () => {
  it("inserts exactly three missing fixtures in one createMany", async () => {
    const { createMany, database, rows, transactionRunner } = createDatabase();

    await expect(
      reconcileStudentRegistryDemo(database, "development"),
    ).resolves.toStrictEqual({
      inserted: 3,
      existing: 0,
      preservedLinked: 0,
      preservedInactive: 0,
    });
    expect(transactionRunner).toHaveBeenCalledTimes(1);
    expect(createMany).toHaveBeenCalledExactlyOnceWith({
      data: studentRegistryDemoFixtures,
      skipDuplicates: true,
    });
    expect(rows()).toHaveLength(3);
  });

  it("is idempotent across repeated executions", async () => {
    const { createMany, database, rows } = createDatabase();

    await reconcileStudentRegistryDemo(database, "test");
    await expect(
      reconcileStudentRegistryDemo(database, "test"),
    ).resolves.toStrictEqual({
      inserted: 0,
      existing: 3,
      preservedLinked: 0,
      preservedInactive: 0,
    });
    expect(createMany).toHaveBeenCalledTimes(1);
    expect(rows()).toHaveLength(3);
  });

  it("treats exact active unlinked fixtures as no-ops", async () => {
    const databaseState = createDatabase([
      fixtureRow(0),
      fixtureRow(1),
      fixtureRow(2),
    ]);

    await expect(
      reconcileStudentRegistryDemo(databaseState.database, "development"),
    ).resolves.toStrictEqual({
      inserted: 0,
      existing: 3,
      preservedLinked: 0,
      preservedInactive: 0,
    });
    expect(databaseState.createMany).not.toHaveBeenCalled();
  });

  it("preserves an exact linked fixture without clearing linkage", async () => {
    const linkedAt = new Date("2026-07-22T18:00:00.000Z");
    const linkedUserId = "a0000000-0000-4000-8000-000000000001";
    const databaseState = createDatabase([
      fixtureRow(0, { registeredUserId: linkedUserId, registeredAt: linkedAt }),
      fixtureRow(1),
      fixtureRow(2),
    ]);

    await expect(
      reconcileStudentRegistryDemo(databaseState.database, "test"),
    ).resolves.toMatchObject({ preservedLinked: 1, inserted: 0 });
    expect(databaseState.rows()[0]).toMatchObject({
      registeredUserId: linkedUserId,
      registeredAt: linkedAt,
    });
  });

  it("preserves an exact inactive fixture without reactivation", async () => {
    const databaseState = createDatabase([
      fixtureRow(0, { status: StudentRegistryStatus.INACTIVE }),
      fixtureRow(1),
      fixtureRow(2),
    ]);

    await expect(
      reconcileStudentRegistryDemo(databaseState.database, "development"),
    ).resolves.toMatchObject({ preservedInactive: 1, inserted: 0 });
    expect(databaseState.rows()[0]?.status).toBe(
      StudentRegistryStatus.INACTIVE,
    );
  });

  it.each([
    ["same ID", fixtureRow(0, { fullName: "Conflicting Demo Name" })],
    [
      "same Student Number",
      fixtureRow(0, {
        id: "a0000000-0000-4000-8000-000000000002",
        email: "conflicting.student@example.test",
      }),
    ],
    [
      "same email",
      fixtureRow(0, {
        id: "a0000000-0000-4000-8000-000000000003",
        studentNumber: "SIST-DEMO-CONFLICT",
      }),
    ],
    [
      "OFFICIAL_IMPORT collision",
      fixtureRow(0, { source: StudentRegistrySource.OFFICIAL_IMPORT }),
    ],
  ])("rejects a sanitized %s conflict", async (_label, conflictingRow) => {
    const { database, rows } = createDatabase([conflictingRow]);

    let thrown: unknown;
    try {
      await reconcileStudentRegistryDemo(database, "test");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe(
      "STUDENT_REGISTRY_DEMO_IDENTIFIER_CONFLICT",
    );
    for (const fixture of studentRegistryDemoFixtures) {
      expect((thrown as Error).message).not.toContain(fixture.id);
      expect((thrown as Error).message).not.toContain(fixture.studentNumber);
      expect((thrown as Error).message).not.toContain(fixture.email);
      expect((thrown as Error).message).not.toContain(fixture.fullName);
    }
    expect(rows()).toStrictEqual([conflictingRow]);
  });

  it("rejects multiple rows matching different fixture keys", async () => {
    const { database } = createDatabase([
      fixtureRow(0, {
        studentNumber: "SIST-DEMO-CONFLICT-A",
        email: "conflicting.a@example.test",
      }),
      fixtureRow(0, {
        id: "a0000000-0000-4000-8000-000000000004",
        email: "conflicting.b@example.test",
      }),
    ]);

    await expect(
      reconcileStudentRegistryDemo(database, "development"),
    ).rejects.toThrow("STUDENT_REGISTRY_DEMO_IDENTIFIER_CONFLICT");
  });

  it("rolls back new inserts when final validation conflicts", async () => {
    const databaseState = createDatabase([], {
      afterCreate(rows) {
        rows[0]!.fullName = "Conflicting Final Name";
      },
    });

    await expect(
      reconcileStudentRegistryDemo(databaseState.database, "test"),
    ).rejects.toThrow("STUDENT_REGISTRY_DEMO_FINAL_CONFLICT");
    expect(databaseState.rows()).toStrictEqual([]);
  });

  it("never calls a registry mutation other than createMany", async () => {
    const { database, forbidden } = createDatabase();

    await reconcileStudentRegistryDemo(database, "development");

    expect(forbidden.update).not.toHaveBeenCalled();
    expect(forbidden.updateMany).not.toHaveBeenCalled();
    expect(forbidden.upsert).not.toHaveBeenCalled();
    expect(forbidden.delete).not.toHaveBeenCalled();
    expect(forbidden.deleteMany).not.toHaveBeenCalled();
  });

  it("returns counts only", async () => {
    const { database } = createDatabase();

    const summary = await reconcileStudentRegistryDemo(database, "test");

    expect(Object.keys(summary).sort()).toStrictEqual([
      "existing",
      "inserted",
      "preservedInactive",
      "preservedLinked",
    ]);
    expect(
      Object.values(summary).every((value) => typeof value === "number"),
    ).toBe(true);
  });
});

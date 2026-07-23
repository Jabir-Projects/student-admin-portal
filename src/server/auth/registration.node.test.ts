// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { Prisma } from "@/generated/prisma/client";
import { ACADEMIC_YEARS, PROGRAMS } from "@/features/auth/constants";

const serviceMocks = vi.hoisted(() => ({
  claimStudentRegistryEntry: vi.fn(),
  findAvailableStudentRegistryEntry: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock("@/server/auth/password.node", () => ({
  hashPassword: serviceMocks.hashPassword,
}));

vi.mock("@/server/auth/verification", () => ({
  claimStudentRegistryEntry: serviceMocks.claimStudentRegistryEntry,
  findAvailableStudentRegistryEntry:
    serviceMocks.findAvailableStudentRegistryEntry,
}));

import { registerStudentWithDatabase } from "@/server/auth/registration.node";

const genericFailure = {
  ok: false,
  message:
    "The registration could not be submitted. Check the information or contact administration.",
};

const validRegistration = {
  fullName: "  Student   Applicant ",
  email: " Student.Applicant@Example.COM ",
  password: "a secure password",
  confirmPassword: "a secure password",
  studentNumber: " sist/123 ",
  program: PROGRAMS[0],
  academicYear: ACADEMIC_YEARS[0].value,
};

const normalizedStudent = {
  fullName: "Student Applicant",
  email: "student.applicant@example.com",
  studentNumber: "SIST/123",
  program: PROGRAMS[0],
  academicYear: ACADEMIC_YEARS[0].value,
};

const rawRegistryIdentity = { ...normalizedStudent };

const manualOptions = {
  verificationMode: "MANUAL_APPROVAL",
  runtime: "test",
} as const;

const internalOptions = {
  verificationMode: "INTERNAL_REGISTRY",
  runtime: "test",
} as const;

function createDatabase(events: string[] = []) {
  const findFirst = vi.fn(async () => ({ id: "registry-id" }));
  const updateMany = vi.fn(async () => ({ count: 1 }));
  const userCreate = vi.fn(async () => {
    events.push("user");
    return { id: "created-user-id" };
  });
  const auditCreate = vi.fn(async () => {
    events.push("audit");
    return { id: "audit-id" };
  });
  const transaction = {
    user: { create: userCreate },
    studentRegistry: { updateMany },
    auditLog: { create: auditCreate },
  };
  const transactionRunner = vi.fn(
    async (callback: (client: typeof transaction) => Promise<unknown>) => {
      events.push("transaction");
      return callback(transaction);
    },
  );
  const database = {
    studentRegistry: { findFirst },
    $transaction: transactionRunner,
  } as unknown as Parameters<typeof registerStudentWithDatabase>[1];

  return {
    auditCreate,
    database,
    findFirst,
    transaction,
    transactionRunner,
    updateMany,
    userCreate,
  };
}

function knownPrismaError(code: "P2002" | "P2034") {
  return new Prisma.PrismaClientKnownRequestError("private database failure", {
    code,
    clientVersion: "7.8.0",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  serviceMocks.hashPassword.mockResolvedValue("argon2id-test-hash");
  serviceMocks.findAvailableStudentRegistryEntry.mockResolvedValue({
    id: "registry-id",
  });
  serviceMocks.claimStudentRegistryEntry.mockResolvedValue(1);
});

describe("MANUAL_APPROVAL registration", () => {
  it("preserves the existing User, StudentProfile, and AuditLog transaction", async () => {
    const { auditCreate, database, transactionRunner, userCreate } =
      createDatabase();

    await expect(
      registerStudentWithDatabase(validRegistration, database, manualOptions),
    ).resolves.toEqual({ ok: true });
    expect(
      serviceMocks.findAvailableStudentRegistryEntry,
    ).not.toHaveBeenCalled();
    expect(serviceMocks.claimStudentRegistryEntry).not.toHaveBeenCalled();
    expect(serviceMocks.hashPassword).toHaveBeenCalledExactlyOnceWith(
      validRegistration.password,
    );
    expect(transactionRunner).toHaveBeenCalledTimes(1);
    expect(userCreate).toHaveBeenCalledExactlyOnceWith({
      data: {
        email: normalizedStudent.email,
        fullName: normalizedStudent.fullName,
        passwordHash: "argon2id-test-hash",
        role: "STUDENT",
        status: "PENDING_APPROVAL",
        studentProfile: {
          create: {
            studentNumber: normalizedStudent.studentNumber,
            program: normalizedStudent.program,
            academicYear: normalizedStudent.academicYear,
          },
        },
      },
      select: { id: true },
    });
    expect(auditCreate).toHaveBeenCalledExactlyOnceWith({
      data: {
        action: "STUDENT_REGISTRATION_SUBMITTED",
        entityType: "User",
        entityId: "created-user-id",
        metadata: { source: "public_registration" },
      },
    });
  });

  it("maps P2002 to the generic registration result", async () => {
    const { database, transactionRunner } = createDatabase();
    transactionRunner.mockRejectedValue(knownPrismaError("P2002"));

    await expect(
      registerStudentWithDatabase(validRegistration, database, manualOptions),
    ).resolves.toEqual(genericFailure);
  });
});

describe("INTERNAL_REGISTRY pre-check", () => {
  it("pre-checks the raw five-field identity before hashing", async () => {
    const events: string[] = [];
    const { database } = createDatabase(events);
    serviceMocks.findAvailableStudentRegistryEntry.mockImplementation(
      async () => {
        events.push("precheck");
        return { id: "registry-id" };
      },
    );
    serviceMocks.hashPassword.mockImplementation(async () => {
      events.push("hash");
      return "argon2id-test-hash";
    });

    await expect(
      registerStudentWithDatabase(validRegistration, database, internalOptions),
    ).resolves.toEqual({ ok: true });
    expect(serviceMocks.findAvailableStudentRegistryEntry).toHaveBeenCalledWith(
      database,
      rawRegistryIdentity,
      "test",
    );
    expect(
      serviceMocks.findAvailableStudentRegistryEntry.mock.calls[0]?.[1],
    ).not.toHaveProperty("normalizedFullName");
    expect(events.indexOf("precheck")).toBeLessThan(events.indexOf("hash"));
    expect(events.indexOf("hash")).toBeLessThan(events.indexOf("transaction"));
  });

  it("passes raw identity through the real strict lookup and claim boundaries", async () => {
    const actualVerification = await vi.importActual<
      typeof import("@/server/auth/verification")
    >("@/server/auth/verification");
    const { database, findFirst, transactionRunner, updateMany } =
      createDatabase();
    serviceMocks.findAvailableStudentRegistryEntry.mockImplementation(
      actualVerification.findAvailableStudentRegistryEntry,
    );
    serviceMocks.claimStudentRegistryEntry.mockImplementation(
      actualVerification.claimStudentRegistryEntry,
    );

    await expect(
      registerStudentWithDatabase(validRegistration, database, internalOptions),
    ).resolves.toEqual({ ok: true });

    const canonicalPredicate = {
      studentNumber: "SIST/123",
      status: "ACTIVE",
      source: { in: ["DEVELOPMENT_DEMO", "OFFICIAL_IMPORT"] },
      email: "student.applicant@example.com",
      normalizedFullName: "student applicant",
      program: PROGRAMS[0],
      academicYear: ACADEMIC_YEARS[0].value,
      registeredUserId: null,
      registeredAt: null,
    };
    expect(findFirst).toHaveBeenCalledExactlyOnceWith({
      where: canonicalPredicate,
      select: { id: true },
    });
    expect(updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { id: "registry-id", ...canonicalPredicate },
      data: {
        registeredUserId: "created-user-id",
        registeredAt: expect.any(Date),
      },
    });
    expect(serviceMocks.hashPassword).toHaveBeenCalledExactlyOnceWith(
      validRegistration.password,
    );
    expect(transactionRunner).toHaveBeenCalledTimes(1);
  });

  it("maps strict registry identity rejection to the generic result", async () => {
    const actualVerification = await vi.importActual<
      typeof import("@/server/auth/verification")
    >("@/server/auth/verification");
    const { auditCreate, database, findFirst, transactionRunner, userCreate } =
      createDatabase();
    serviceMocks.findAvailableStudentRegistryEntry.mockImplementation(
      actualVerification.findAvailableStudentRegistryEntry,
    );

    const result = await registerStudentWithDatabase(
      { ...validRegistration, studentNumber: "SIST!123" },
      database,
      internalOptions,
    );

    expect(result).toStrictEqual(genericFailure);
    expect(Object.keys(result)).toStrictEqual(["ok", "message"]);
    expect(findFirst).not.toHaveBeenCalled();
    expect(serviceMocks.hashPassword).not.toHaveBeenCalled();
    expect(transactionRunner).not.toHaveBeenCalled();
    expect(userCreate).not.toHaveBeenCalled();
    expect(serviceMocks.claimStudentRegistryEntry).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("propagates an unexpected registry pre-check error", async () => {
    const unexpectedError = new Error("Unexpected registry pre-check failure.");
    const { auditCreate, database, transactionRunner, userCreate } =
      createDatabase();
    serviceMocks.findAvailableStudentRegistryEntry.mockRejectedValue(
      unexpectedError,
    );

    await expect(
      registerStudentWithDatabase(validRegistration, database, internalOptions),
    ).rejects.toBe(unexpectedError);
    expect(serviceMocks.hashPassword).not.toHaveBeenCalled();
    expect(transactionRunner).not.toHaveBeenCalled();
    expect(userCreate).not.toHaveBeenCalled();
    expect(serviceMocks.claimStudentRegistryEntry).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("returns generically without hashing or starting a transaction when no match exists", async () => {
    const { auditCreate, database, transactionRunner, userCreate } =
      createDatabase();
    serviceMocks.findAvailableStudentRegistryEntry.mockResolvedValue(null);

    await expect(
      registerStudentWithDatabase(validRegistration, database, internalOptions),
    ).resolves.toEqual(genericFailure);
    expect(serviceMocks.hashPassword).not.toHaveBeenCalled();
    expect(transactionRunner).not.toHaveBeenCalled();
    expect(userCreate).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
    expect(serviceMocks.claimStudentRegistryEntry).not.toHaveBeenCalled();
  });

  it("passes production runtime to the existing source-policy service", async () => {
    const { database } = createDatabase();

    await registerStudentWithDatabase(validRegistration, database, {
      verificationMode: "INTERNAL_REGISTRY",
      runtime: "production",
    });

    expect(serviceMocks.findAvailableStudentRegistryEntry).toHaveBeenCalledWith(
      database,
      rawRegistryIdentity,
      "production",
    );
  });

  it("fails closed with a sanitized error for an invalid runtime", async () => {
    const rejectedRuntime = "unsafe-preview-runtime";
    const { database, transactionRunner } = createDatabase();
    let thrown: unknown;

    try {
      await registerStudentWithDatabase(validRegistration, database, {
        verificationMode: "INTERNAL_REGISTRY",
        runtime: rejectedRuntime,
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe(
      "Invalid registration runtime configuration",
    );
    expect((thrown as Error).message).not.toContain(rejectedRuntime);
    expect(
      serviceMocks.findAvailableStudentRegistryEntry,
    ).not.toHaveBeenCalled();
    expect(serviceMocks.hashPassword).not.toHaveBeenCalled();
    expect(transactionRunner).not.toHaveBeenCalled();
  });
});

describe("INTERNAL_REGISTRY transaction", () => {
  it("creates the User, claims with the transaction client, then audits", async () => {
    const events: string[] = [];
    const { database, transaction } = createDatabase(events);
    serviceMocks.hashPassword.mockImplementation(async () => {
      events.push("hash");
      return "argon2id-test-hash";
    });
    serviceMocks.claimStudentRegistryEntry.mockImplementation(async () => {
      events.push("claim");
      return 1;
    });

    const result = await registerStudentWithDatabase(
      validRegistration,
      database,
      internalOptions,
    );

    expect(result).toEqual({ ok: true });
    expect(serviceMocks.claimStudentRegistryEntry).toHaveBeenCalledTimes(1);
    const [claimClient, claimInput] =
      serviceMocks.claimStudentRegistryEntry.mock.calls[0]!;
    expect(claimClient).toBe(transaction);
    expect(claimInput).toMatchObject({
      registryId: "registry-id",
      identity: rawRegistryIdentity,
      runtime: "test",
      userId: "created-user-id",
      claimedAt: expect.any(Date),
    });
    expect(Object.keys(claimInput)).toStrictEqual([
      "registryId",
      "identity",
      "runtime",
      "userId",
      "claimedAt",
    ]);
    expect(events).toStrictEqual([
      "hash",
      "transaction",
      "user",
      "claim",
      "audit",
    ]);
    expect(JSON.stringify(result)).not.toContain("registry-id");
  });

  it("maps claim loss generically and prevents the AuditLog write", async () => {
    const { auditCreate, database, userCreate } = createDatabase();
    serviceMocks.claimStudentRegistryEntry.mockResolvedValue(0);

    await expect(
      registerStudentWithDatabase(validRegistration, database, internalOptions),
    ).resolves.toEqual(genericFailure);
    expect(userCreate).toHaveBeenCalledTimes(1);
    expect(serviceMocks.claimStudentRegistryEntry).toHaveBeenCalledTimes(1);
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("maps P2034 to the generic result without retrying", async () => {
    const { database, transactionRunner } = createDatabase();
    transactionRunner.mockRejectedValue(knownPrismaError("P2034"));

    await expect(
      registerStudentWithDatabase(validRegistration, database, internalOptions),
    ).resolves.toEqual(genericFailure);
    expect(transactionRunner).toHaveBeenCalledTimes(1);
  });

  it("maps P2002 to the generic result", async () => {
    const { database, transactionRunner } = createDatabase();
    transactionRunner.mockRejectedValue(knownPrismaError("P2002"));

    await expect(
      registerStudentWithDatabase(validRegistration, database, internalOptions),
    ).resolves.toEqual(genericFailure);
    expect(transactionRunner).toHaveBeenCalledTimes(1);
  });
});

describe("strict public registration payload", () => {
  it.each([
    ["role", "ADMIN"],
    ["accountStatus", "ACTIVE"],
    ["preferredLanguage", "FRENCH"],
    ["source", "OFFICIAL_IMPORT"],
    ["status", "ACTIVE"],
    ["registeredUserId", "user-id"],
    ["registeredAt", new Date()],
    ["normalizedFullName", "attacker controlled"],
    ["unexpected", "value"],
  ])(
    "rejects %s before password, registry, or transaction work",
    async (field, value) => {
      const { database, transactionRunner } = createDatabase();

      await expect(
        registerStudentWithDatabase(
          { ...validRegistration, [field]: value },
          database,
          internalOptions,
        ),
      ).resolves.toEqual(genericFailure);
      expect(
        serviceMocks.findAvailableStudentRegistryEntry,
      ).not.toHaveBeenCalled();
      expect(serviceMocks.hashPassword).not.toHaveBeenCalled();
      expect(transactionRunner).not.toHaveBeenCalled();
    },
  );
});

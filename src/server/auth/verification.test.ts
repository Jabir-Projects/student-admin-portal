// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { ACADEMIC_YEARS, PROGRAMS } from "@/features/auth/constants";
import {
  claimStudentRegistryEntry,
  findAvailableStudentRegistryEntry,
  getAllowedStudentRegistrySources,
} from "@/server/auth/verification";

const rawIdentity = {
  studentNumber: " sist/123 ",
  fullName: "  \u00c9LODIE\u00a0MARTIN ",
  email: " Student.Registry@Example.COM ",
  program: PROGRAMS[0],
  academicYear: ACADEMIC_YEARS[0].value,
};

const exactMatchPredicate = {
  studentNumber: "SIST/123",
  status: "ACTIVE",
  source: { in: ["DEVELOPMENT_DEMO", "OFFICIAL_IMPORT"] },
  email: "student.registry@example.com",
  normalizedFullName: "\u00e9lodie martin",
  program: PROGRAMS[0],
  academicYear: ACADEMIC_YEARS[0].value,
  registeredUserId: null,
  registeredAt: null,
};

function lookupDatabase(findFirst: ReturnType<typeof vi.fn>) {
  return {
    studentRegistry: { findFirst },
  } as unknown as Parameters<typeof findAvailableStudentRegistryEntry>[0];
}

function claimTransaction(updateMany: ReturnType<typeof vi.fn>) {
  return {
    studentRegistry: { updateMany },
  } as unknown as Parameters<typeof claimStudentRegistryEntry>[0];
}

describe("Student Registry runtime source policy", () => {
  it.each(["development", "test"])(
    "%s accepts development and official sources",
    (runtime) => {
      expect(getAllowedStudentRegistrySources(runtime)).toStrictEqual([
        "DEVELOPMENT_DEMO",
        "OFFICIAL_IMPORT",
      ]);
    },
  );

  it("production accepts only official imports", () => {
    const sources = getAllowedStudentRegistrySources("production");

    expect(sources).toStrictEqual(["OFFICIAL_IMPORT"]);
    expect(sources).not.toContain("DEVELOPMENT_DEMO");
  });

  it("fails closed without exposing an unknown runtime", () => {
    const rejectedRuntime = "preview-unsafe-runtime";

    expect(() => getAllowedStudentRegistrySources(rejectedRuntime)).toThrow(
      "Invalid Student Registry runtime configuration",
    );
    try {
      getAllowedStudentRegistrySources(rejectedRuntime);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(rejectedRuntime);
    }
  });
});

describe("Student Registry minimal pre-check", () => {
  it("uses the exact normalized predicate and selects only the ID", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "registry-id",
      email: "must-not-be-returned@example.invalid",
      source: "DEVELOPMENT_DEMO",
    });

    await expect(
      findAvailableStudentRegistryEntry(
        lookupDatabase(findFirst),
        rawIdentity,
        "test",
      ),
    ).resolves.toStrictEqual({ id: "registry-id" });
    expect(findFirst).toHaveBeenCalledExactlyOnceWith({
      where: exactMatchPredicate,
      select: { id: true },
    });
  });

  it("returns null when no complete match exists", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);

    await expect(
      findAvailableStudentRegistryEntry(
        lookupDatabase(findFirst),
        rawIdentity,
        "development",
      ),
    ).resolves.toBeNull();
  });

  it("never permits a development demo source in production", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);

    await findAvailableStudentRegistryEntry(
      lookupDatabase(findFirst),
      rawIdentity,
      "production",
    );

    expect(findFirst).toHaveBeenCalledExactlyOnceWith({
      where: {
        ...exactMatchPredicate,
        source: { in: ["OFFICIAL_IMPORT"] },
      },
      select: { id: true },
    });
  });

  it.each([
    ["role", "ADMIN"],
    ["accountStatus", "ACTIVE"],
    ["preferredLanguage", "FRENCH"],
    ["source", "OFFICIAL_IMPORT"],
    ["status", "ACTIVE"],
    ["registeredUserId", "user-id"],
    ["registeredAt", new Date()],
    ["unexpected", "value"],
  ])("rejects the protected or unknown field %s", async (field, value) => {
    const findFirst = vi.fn();

    await expect(
      findAvailableStudentRegistryEntry(
        lookupDatabase(findFirst),
        { ...rawIdentity, [field]: value },
        "test",
      ),
    ).rejects.toBeDefined();
    expect(findFirst).not.toHaveBeenCalled();
  });
});

describe("Student Registry conditional claim", () => {
  it("revalidates and claims one exact registry row", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const createUser = vi.fn();
    const createProfile = vi.fn();
    const createAuditLog = vi.fn();
    const claimedAt = new Date("2026-07-22T15:00:00.000Z");
    const transaction = {
      studentRegistry: { updateMany },
      user: { create: createUser },
      studentProfile: { create: createProfile },
      auditLog: { create: createAuditLog },
    } as unknown as Parameters<typeof claimStudentRegistryEntry>[0];

    await expect(
      claimStudentRegistryEntry(transaction, {
        registryId: "registry-id",
        identity: rawIdentity,
        runtime: "test",
        userId: "user-id",
        claimedAt,
      }),
    ).resolves.toBe(1);
    expect(updateMany).toHaveBeenCalledExactlyOnceWith({
      where: { id: "registry-id", ...exactMatchPredicate },
      data: {
        registeredUserId: "user-id",
        registeredAt: claimedAt,
      },
    });
    expect(createUser).not.toHaveBeenCalled();
    expect(createProfile).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it("preserves a zero count for the later transaction orchestrator", async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });

    await expect(
      claimStudentRegistryEntry(claimTransaction(updateMany), {
        registryId: "registry-id",
        identity: rawIdentity,
        runtime: "production",
        userId: "user-id",
        claimedAt: new Date("2026-07-22T15:00:00.000Z"),
      }),
    ).resolves.toBe(0);
  });
});

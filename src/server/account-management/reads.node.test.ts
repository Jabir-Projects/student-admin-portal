// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  readDisabledStudentAccounts,
  readManagedStudentAccounts,
  readStaffCapabilityAssignments,
  readStaffInventory,
} from "@/server/account-management/reads.node";

const findUnique = vi.fn();
const count = vi.fn();
const findMany = vi.fn();
const database = {
  user: { findUnique, count, findMany },
} as unknown as PrismaClient;
const secret = "test-only-account-reference-secret".repeat(2);
const claims = { actorId: "actor-id", claimedSessionVersion: 7 };

function actor(capabilities: string[], role: "STAFF" | "ADMIN" = "STAFF") {
  return {
    id: "actor-id",
    fullName: "Package D Manager",
    role,
    status: "ACTIVE",
    sessionVersion: 7,
    capabilityAssignments: capabilities.map((capability) => ({ capability })),
  };
}

function student(
  id: string,
  status: "PENDING_APPROVAL" | "ACTIVE" | "DISABLED",
) {
  return {
    id,
    email: "must-not-return@example.test",
    passwordHash: "must-not-return",
    sessionVersion: 99,
    fullName: "Student One",
    status,
    createdAt: new Date("2026-07-01T08:00:00Z"),
    approvedAt: status === "ACTIVE" ? new Date("2026-07-02T08:00:00Z") : null,
    disabledAt: status === "DISABLED" ? new Date("2026-07-03T08:00:00Z") : null,
    studentProfile: {
      studentNumber: "SIST-001",
      program: "BAC+3 Software Engineering",
      academicYear: "YEAR_2",
    },
  };
}

function staff(id: string) {
  return {
    id,
    email: "must-not-return@example.test",
    passwordHash: "must-not-return",
    sessionVersion: 99,
    fullName: "Staff One",
    role: "STAFF",
    status: "ACTIVE",
    createdAt: new Date("2026-07-01T08:00:00Z"),
    disabledAt: null,
    capabilityAssignments: [
      { capability: "MANAGE_STUDENT_ACCOUNTS", grantedById: "forbidden" },
    ],
  };
}

function expectOpaqueReference(
  reference: string | undefined,
  accountId: string,
): void {
  expect(reference).toEqual(expect.any(String));
  if (!reference) throw new Error("Missing account reference.");
  expect(reference).not.toContain(accountId);
  expect(Buffer.from(reference, "base64url").toString("utf8")).not.toContain(
    accountId,
  );
  for (const component of reference.split(".")) {
    expect(Buffer.from(component, "base64url").toString("utf8")).not.toContain(
      accountId,
    );
  }
}

beforeEach(() => {
  findUnique.mockReset();
  count.mockReset();
  findMany.mockReset();
  count.mockResolvedValue(1);
});

describe("student account read contracts", () => {
  it("loads pending and active students only with the exact capability", async () => {
    const id = "40000000-0000-4000-8000-000000000001";
    findUnique.mockResolvedValue(actor(["MANAGE_STUDENT_ACCOUNTS"]));
    findMany.mockResolvedValue([student(id, "PENDING_APPROVAL")]);

    const result = await readManagedStudentAccounts(
      claims,
      { search: "  Student   One " },
      database,
      secret,
    );

    expect(result).toMatchObject({
      ok: true,
      status: "success",
      data: { page: 1, pageSize: 25, totalCount: 1 },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 25,
        orderBy: [{ status: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          fullName: true,
          status: true,
          createdAt: true,
          approvedAt: true,
          disabledAt: true,
          studentProfile: {
            select: {
              studentNumber: true,
              program: true,
              academicYear: true,
            },
          },
        },
      }),
    );
    const query = findMany.mock.calls[0]?.[0];
    expect(query.where).toMatchObject({
      role: "STUDENT",
      status: { in: ["PENDING_APPROVAL", "ACTIVE"] },
      OR: [
        { fullName: { contains: "Student One", mode: "insensitive" } },
        {
          studentProfile: {
            is: {
              studentNumber: {
                contains: "Student One",
                mode: "insensitive",
              },
            },
          },
        },
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(
      new RegExp(
        `${id}|must-not-return|sessionVersion|email|passwordHash`,
        "iu",
      ),
    );
    expectOpaqueReference(
      result.ok ? result.data.records[0]?.accountReference : undefined,
      id,
    );
  });

  it("keeps pending/active and disabled capability sections isolated", async () => {
    findUnique.mockResolvedValueOnce(actor(["REACTIVATE_STUDENT_ACCOUNTS"]));
    await expect(
      readManagedStudentAccounts(claims, {}, database, secret),
    ).resolves.toEqual({
      ok: false,
      status: "denied",
      reason: "MISSING_CAPABILITY",
    });

    findUnique.mockResolvedValueOnce(actor(["MANAGE_STUDENT_ACCOUNTS"]));
    await expect(
      readDisabledStudentAccounts(claims, {}, database, secret),
    ).resolves.toEqual({
      ok: false,
      status: "denied",
      reason: "MISSING_CAPABILITY",
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("loads disabled students with the reactivation capability and stable ordering", async () => {
    const id = "40000000-0000-4000-8000-000000000002";
    findUnique.mockResolvedValue(actor(["REACTIVATE_STUDENT_ACCOUNTS"]));
    findMany.mockResolvedValue([student(id, "DISABLED")]);

    const result = await readDisabledStudentAccounts(
      claims,
      { pageSize: 50 },
      database,
      secret,
    );

    expect(result).toMatchObject({
      ok: true,
      data: { pageSize: 50 },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: "STUDENT",
          status: "DISABLED",
        }),
        orderBy: [{ fullName: "asc" }, { id: "asc" }],
        take: 50,
      }),
    );
    expectOpaqueReference(
      result.ok ? result.data.records[0]?.accountReference : undefined,
      id,
    );
  });

  it("returns typed invalid, empty, and unavailable outcomes", async () => {
    await expect(
      readManagedStudentAccounts(claims, { pageSize: 51 }, database, secret),
    ).resolves.toEqual({
      ok: false,
      status: "invalid",
      reason: "INVALID_INPUT",
    });
    expect(findUnique).not.toHaveBeenCalled();

    findUnique.mockResolvedValueOnce(actor(["MANAGE_STUDENT_ACCOUNTS"]));
    count.mockResolvedValueOnce(0);
    findMany.mockResolvedValueOnce([]);
    await expect(
      readManagedStudentAccounts(claims, {}, database, secret),
    ).resolves.toMatchObject({
      ok: true,
      status: "empty",
      data: { totalCount: 0, records: [] },
    });

    findUnique.mockRejectedValueOnce(new Error("private Prisma failure"));
    await expect(
      readManagedStudentAccounts(claims, {}, database, secret),
    ).resolves.toEqual({
      ok: false,
      status: "unavailable",
      reason: "READ_FAILED",
    });
  });
});

describe("STAFF inventory and capability-assignment reads", () => {
  it("returns minimized STAFF inventory only with MANAGE_STAFF_ACCOUNTS", async () => {
    const id = "40000000-0000-4000-8000-000000000003";
    findUnique.mockResolvedValue(actor(["MANAGE_STAFF_ACCOUNTS"]));
    findMany.mockResolvedValue([staff(id)]);

    const result = await readStaffInventory(
      claims,
      { status: "ACTIVE" },
      database,
      secret,
    );

    expect(result).toMatchObject({
      ok: true,
      status: "success",
      data: {
        records: [
          {
            fullName: "Staff One",
            role: "STAFF",
            status: "ACTIVE",
          },
        ],
      },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ fullName: "asc" }, { id: "asc" }],
        select: {
          id: true,
          fullName: true,
          role: true,
          status: true,
          createdAt: true,
          disabledAt: true,
        },
      }),
    );
    expect(JSON.stringify(result)).not.toMatch(
      new RegExp(`${id}|must-not-return|sessionVersion|passwordHash`, "iu"),
    );
    expectOpaqueReference(
      result.ok ? result.data.records[0]?.accountReference : undefined,
      id,
    );
  });

  it("does not disclose assignments to a STAFF account manager", async () => {
    findUnique.mockResolvedValue(actor(["MANAGE_STAFF_ACCOUNTS"]));
    await expect(
      readStaffCapabilityAssignments(claims, {}, database, secret),
    ).resolves.toEqual({
      ok: false,
      status: "denied",
      reason: "MISSING_CAPABILITY",
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("returns minimized assignments to a capability manager", async () => {
    const id = "40000000-0000-4000-8000-000000000004";
    findUnique.mockResolvedValue(actor(["MANAGE_STAFF_CAPABILITIES"]));
    findMany.mockResolvedValue([staff(id)]);

    const result = await readStaffCapabilityAssignments(
      claims,
      {},
      database,
      secret,
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        records: [
          {
            fullName: "Staff One",
            status: "ACTIVE",
            capabilities: ["MANAGE_STUDENT_ACCOUNTS"],
          },
        ],
      },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: {
          id: true,
          fullName: true,
          status: true,
          capabilityAssignments: {
            orderBy: { capability: "asc" },
            select: { capability: true },
          },
        },
      }),
    );
    expect(JSON.stringify(result)).not.toMatch(
      new RegExp(`${id}|grantedById|sessionVersion|must-not-return`, "iu"),
    );
    expectOpaqueReference(
      result.ok ? result.data.records[0]?.accountReference : undefined,
      id,
    );
  });

  it("gives legacy ADMIN no read bypass", async () => {
    findUnique.mockResolvedValue(actor(["MANAGE_STAFF_CAPABILITIES"], "ADMIN"));
    await expect(
      readStaffCapabilityAssignments(claims, {}, database, secret),
    ).resolves.toEqual({
      ok: false,
      status: "denied",
      reason: "WRONG_ROLE",
    });
    expect(findMany).not.toHaveBeenCalled();
  });
});

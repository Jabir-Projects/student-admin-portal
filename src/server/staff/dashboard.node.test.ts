// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { getStaffDashboardDataByClaims } from "@/server/staff/dashboard.node";

const findUnique = vi.fn();
const count = vi.fn();
const findMany = vi.fn();
const database = {
  user: { findUnique, count, findMany },
} as unknown as PrismaClient;

function staffUser(
  overrides: Partial<{
    role: "STUDENT" | "STAFF" | "ADMIN";
    status: "PENDING_APPROVAL" | "ACTIVE" | "DISABLED";
    sessionVersion: number;
    fullName: string;
    capabilities: string[];
  }> = {},
) {
  return {
    id: "staff-id",
    fullName: overrides.fullName ?? "Sara Ali",
    role: overrides.role ?? "STAFF",
    status: overrides.status ?? "ACTIVE",
    sessionVersion: overrides.sessionVersion ?? 7,
    capabilityAssignments: (overrides.capabilities ?? []).map((capability) => ({
      capability,
    })),
  };
}

function pendingStudent(
  index: number,
  createdAt = new Date("2026-07-01T08:00:00Z"),
) {
  return {
    id: `forbidden-id-${index}`,
    email: `forbidden-${index}@example.test`,
    passwordHash: "forbidden-password-hash",
    fullName: `Student ${index}`,
    createdAt,
    studentProfile: {
      studentNumber: `SIST-${index}`,
      program: "BAC+3 Software Engineering",
      academicYear: "YEAR_2",
    },
  };
}

beforeEach(() => {
  findUnique.mockReset();
  count.mockReset();
  findMany.mockReset();
});

describe("STAFF dashboard data contract", () => {
  it("requires an exact active STAFF actor with the current session version", async () => {
    findUnique.mockResolvedValue(staffUser({ role: "ADMIN" }));

    await expect(
      getStaffDashboardDataByClaims(
        { actorId: "staff-id", claimedSessionVersion: 7 },
        database,
      ),
    ).resolves.toEqual({ ok: false, reason: "WRONG_ROLE" });
    expect(count).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();

    findUnique.mockResolvedValueOnce(staffUser({ status: "DISABLED" }));
    await expect(
      getStaffDashboardDataByClaims(
        { actorId: "staff-id", claimedSessionVersion: 7 },
        database,
      ),
    ).resolves.toEqual({ ok: false, reason: "DISABLED_ACCOUNT" });

    findUnique.mockResolvedValueOnce(staffUser({ sessionVersion: 8 }));
    await expect(
      getStaffDashboardDataByClaims(
        { actorId: "staff-id", claimedSessionVersion: 7 },
        database,
      ),
    ).resolves.toEqual({ ok: false, reason: "STALE_SESSION" });
  });

  it("uses only current database capability assignments", async () => {
    findUnique.mockResolvedValue(staffUser());

    const result = await getStaffDashboardDataByClaims(
      {
        actorId: "staff-id",
        claimedSessionVersion: 7,
        capabilities: ["MANAGE_STUDENT_ACCOUNTS"],
      } as never,
      database,
    );

    expect(result).toEqual({
      ok: true,
      data: {
        fullName: "Sara Ali",
        capabilitySummary: { status: "available", assignedCount: 0 },
        pendingStudents: { status: "hidden" },
      },
    });
    expect(count).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });

  it("loads the pending section only with MANAGE_STUDENT_ACCOUNTS", async () => {
    findUnique.mockResolvedValue(
      staffUser({
        capabilities: ["MANAGE_STUDENT_ACCOUNTS", "PROCESS_REQUESTS"],
      }),
    );
    count.mockResolvedValue(2);
    findMany.mockResolvedValue([pendingStudent(1), pendingStudent(2)]);

    const result = await getStaffDashboardDataByClaims(
      { actorId: "staff-id", claimedSessionVersion: 7 },
      database,
    );

    expect(result).toMatchObject({
      ok: true,
      data: {
        capabilitySummary: { status: "available", assignedCount: 2 },
        pendingStudents: { status: "available", totalCount: 2 },
      },
    });
    expect(count).toHaveBeenCalledWith({
      where: { role: "STUDENT", status: "PENDING_APPROVAL" },
    });
  });

  it("returns a bounded, deterministically ordered, minimized queue", async () => {
    findUnique.mockResolvedValue(
      staffUser({ capabilities: ["MANAGE_STUDENT_ACCOUNTS"] }),
    );
    count.mockResolvedValue(6);
    findMany.mockResolvedValue(
      Array.from({ length: 6 }, (_, index) => pendingStudent(index + 1)),
    );

    const result = await getStaffDashboardDataByClaims(
      { actorId: "staff-id", claimedSessionVersion: 7 },
      database,
    );

    expect(findMany).toHaveBeenCalledWith({
      where: { role: "STUDENT", status: "PENDING_APPROVAL" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 5,
      select: {
        fullName: true,
        createdAt: true,
        studentProfile: {
          select: {
            studentNumber: true,
            program: true,
            academicYear: true,
          },
        },
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok || result.data.pendingStudents.status !== "available") {
      throw new Error("Expected an available pending-student section.");
    }
    expect(result.data.pendingStudents.records).toHaveLength(5);
    expect(result.data.pendingStudents.records[0]).toEqual({
      fullName: "Student 1",
      studentNumber: "SIST-1",
      program: "BAC+3 Software Engineering",
      academicYear: "YEAR_2",
      submittedAt: new Date("2026-07-01T08:00:00Z"),
    });
    expect(JSON.stringify(result.data)).not.toMatch(
      /forbidden-id|forbidden-|passwordHash|email|sessionVersion/u,
    );
  });

  it("returns the explicit empty section for an authorized empty queue", async () => {
    findUnique.mockResolvedValue(
      staffUser({ capabilities: ["MANAGE_STUDENT_ACCOUNTS"] }),
    );
    count.mockResolvedValue(0);
    findMany.mockResolvedValue([]);

    await expect(
      getStaffDashboardDataByClaims(
        { actorId: "staff-id", claimedSessionVersion: 7 },
        database,
      ),
    ).resolves.toEqual({
      ok: true,
      data: {
        fullName: "Sara Ali",
        capabilitySummary: { status: "available", assignedCount: 1 },
        pendingStudents: { status: "empty", totalCount: 0, records: [] },
      },
    });
  });
});

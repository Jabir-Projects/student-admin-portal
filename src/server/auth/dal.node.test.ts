// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { getStaffShellUserByClaims } from "@/server/auth/dal.node";

const findUnique = vi.fn();
const database = {
  user: { findUnique },
} as unknown as PrismaClient;

function staffUser(
  overrides: Partial<{
    role: "STUDENT" | "STAFF" | "ADMIN";
    status: "PENDING_APPROVAL" | "ACTIVE" | "DISABLED";
    sessionVersion: number;
    capabilities: Array<
      "MANAGE_STUDENT_ACCOUNTS" | "PROCESS_REQUESTS" | "VIEW_AUDIT_LOG"
    >;
  }> = {},
) {
  return {
    id: "staff-id",
    fullName: "Staff Member",
    role: overrides.role ?? "STAFF",
    status: overrides.status ?? "ACTIVE",
    sessionVersion: overrides.sessionVersion ?? 4,
    capabilityAssignments: (overrides.capabilities ?? []).map((capability) => ({
      capability,
    })),
  };
}

beforeEach(() => {
  findUnique.mockReset();
});

describe("database-authoritative staff shell actor", () => {
  it("rejects missing identity without querying the database", async () => {
    await expect(
      getStaffShellUserByClaims(
        { actorId: undefined, claimedSessionVersion: 4 },
        database,
      ),
    ).resolves.toEqual({ ok: false, reason: "UNAUTHENTICATED" });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("allows active STAFF with zero capabilities into the safe shell", async () => {
    findUnique.mockResolvedValue(staffUser());
    await expect(
      getStaffShellUserByClaims(
        { actorId: "staff-id", claimedSessionVersion: 4 },
        database,
      ),
    ).resolves.toEqual({
      ok: true,
      user: {
        id: "staff-id",
        fullName: "Staff Member",
        role: "STAFF",
        status: "ACTIVE",
        sessionVersion: 4,
        capabilities: [],
      },
    });
  });

  it("returns only current database capability assignments", async () => {
    findUnique.mockResolvedValue(
      staffUser({
        capabilities: ["PROCESS_REQUESTS", "VIEW_AUDIT_LOG"],
      }),
    );
    const result = await getStaffShellUserByClaims(
      { actorId: "staff-id", claimedSessionVersion: 4 },
      database,
    );
    expect(result).toMatchObject({
      ok: true,
      user: { capabilities: ["PROCESS_REQUESTS", "VIEW_AUDIT_LOG"] },
    });
  });

  it("does not give legacy ADMIN access to the STAFF shell", async () => {
    findUnique.mockResolvedValue(staffUser({ role: "ADMIN" }));
    await expect(
      getStaffShellUserByClaims(
        { actorId: "staff-id", claimedSessionVersion: 4 },
        database,
      ),
    ).resolves.toEqual({ ok: false, reason: "WRONG_ROLE" });
  });

  it.each([
    ["disabled", staffUser({ status: "DISABLED" }), 4, "DISABLED_ACCOUNT"],
    ["stale", staffUser({ sessionVersion: 5 }), 4, "STALE_SESSION"],
  ] as const)(
    "rejects a %s account state",
    async (_case, user, version, reason) => {
      findUnique.mockResolvedValue(user);
      await expect(
        getStaffShellUserByClaims(
          { actorId: "staff-id", claimedSessionVersion: version },
          database,
        ),
      ).resolves.toEqual({ ok: false, reason });
    },
  );
});

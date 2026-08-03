// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  authorizePackageDPageEntry,
  authorizePackageDRead,
} from "@/server/account-management/authorization.node";

const findUnique = vi.fn();
const database = { user: { findUnique } } as unknown as PrismaClient;

function actor(
  capabilities: string[] = [],
  overrides: Partial<{
    role: "STUDENT" | "STAFF" | "ADMIN";
    status: "PENDING_APPROVAL" | "ACTIVE" | "DISABLED";
    sessionVersion: number;
  }> = {},
) {
  return {
    id: "actor-id",
    fullName: "Authorized Staff",
    role: overrides.role ?? "STAFF",
    status: overrides.status ?? "ACTIVE",
    sessionVersion: overrides.sessionVersion ?? 4,
    capabilityAssignments: capabilities.map((capability) => ({ capability })),
  };
}

beforeEach(() => {
  findUnique.mockReset();
});

describe("Package D authorization composition", () => {
  it.each([
    ["student-accounts", "MANAGE_STUDENT_ACCOUNTS"],
    ["student-accounts", "REACTIVATE_STUDENT_ACCOUNTS"],
    ["student-accounts", "EXPORT_STUDENT_DATA"],
    ["staff-management", "MANAGE_STAFF_ACCOUNTS"],
    ["staff-management", "MANAGE_STAFF_CAPABILITIES"],
  ] as const)("allows %s entry with %s", async (page, capability) => {
    findUnique.mockResolvedValue(actor([capability]));
    const result = await authorizePackageDPageEntry(
      { actorId: "actor-id", claimedSessionVersion: 4 },
      page,
      database,
    );
    expect(result.ok).toBe(true);
  });

  it("denies zero-capability STAFF", async () => {
    findUnique.mockResolvedValue(actor([]));
    await expect(
      authorizePackageDPageEntry(
        { actorId: "actor-id", claimedSessionVersion: 4 },
        "student-accounts",
        database,
      ),
    ).resolves.toEqual({ ok: false, reason: "MISSING_CAPABILITY" });
  });

  it.each([
    [actor([], { role: "ADMIN" }), 4, "WRONG_ROLE"],
    [actor([], { role: "STUDENT" }), 4, "WRONG_ROLE"],
    [actor([], { status: "DISABLED" }), 4, "DISABLED_ACCOUNT"],
    [actor([], { sessionVersion: 5 }), 4, "STALE_SESSION"],
  ] as const)(
    "requires exact active current STAFF",
    async (reloadedActor, claimedSessionVersion, reason) => {
      findUnique.mockResolvedValue(reloadedActor);
      await expect(
        authorizePackageDPageEntry(
          { actorId: "actor-id", claimedSessionVersion },
          "staff-management",
          database,
        ),
      ).resolves.toEqual({ ok: false, reason });
    },
  );

  it("uses only database capability assignments", async () => {
    findUnique.mockResolvedValue(actor([]));
    await expect(
      authorizePackageDRead(
        {
          actorId: "actor-id",
          claimedSessionVersion: 4,
          capabilities: ["MANAGE_STAFF_ACCOUNTS"],
        } as never,
        "MANAGE_STAFF_ACCOUNTS",
        database,
      ),
    ).resolves.toEqual({ ok: false, reason: "MISSING_CAPABILITY" });
  });

  it("keeps page entry separate from exact section authorization", async () => {
    findUnique.mockResolvedValue(actor(["MANAGE_STAFF_ACCOUNTS"]));
    await expect(
      authorizePackageDRead(
        { actorId: "actor-id", claimedSessionVersion: 4 },
        "MANAGE_STAFF_CAPABILITIES",
        database,
      ),
    ).resolves.toEqual({ ok: false, reason: "MISSING_CAPABILITY" });
  });
});

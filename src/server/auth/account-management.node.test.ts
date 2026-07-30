// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import type { ActorSessionClaims } from "@/server/auth/capabilities";
import {
  approvePendingStudentAsActor,
  disableStudentAsActor,
  reactivateDisabledStudentAsActor,
} from "@/server/auth/account-management.node";

const claims = {
  actorId: "10000000-0000-4000-8000-000000000001",
  claimedSessionVersion: 4,
} satisfies ActorSessionClaims;

const targetId = "20000000-0000-4000-8000-000000000001";

function lockedUser(
  overrides: Partial<{
    id: string;
    role: "STUDENT" | "STAFF" | "ADMIN";
    status: "PENDING_APPROVAL" | "ACTIVE" | "DISABLED";
    sessionVersion: number;
  }> = {},
) {
  return {
    id: overrides.id ?? targetId,
    role: overrides.role ?? "STUDENT",
    status: overrides.status ?? "PENDING_APPROVAL",
    sessionVersion: overrides.sessionVersion ?? 2,
  };
}

function mutationDatabase(options: {
  actorVersion?: number;
  actorRole?: "STUDENT" | "STAFF" | "ADMIN";
  actorStatus?: "PENDING_APPROVAL" | "ACTIVE" | "DISABLED";
  capabilities?: string[];
  target?: ReturnType<typeof lockedUser> | null;
  updateCount?: number;
  auditError?: Error;
}) {
  const actor = lockedUser({
    id: claims.actorId,
    role: options.actorRole ?? "STAFF",
    status: options.actorStatus ?? "ACTIVE",
    sessionVersion: options.actorVersion ?? 4,
  });
  const queryRaw = vi
    .fn()
    .mockResolvedValueOnce([actor])
    .mockResolvedValueOnce(
      options.target === null ? [] : [options.target ?? lockedUser()],
    );
  const findMany = vi
    .fn()
    .mockResolvedValue(
      (options.capabilities ?? ["MANAGE_STUDENT_ACCOUNTS"]).map(
        (capability) => ({ capability }),
      ),
    );
  const updateMany = vi
    .fn()
    .mockResolvedValue({ count: options.updateCount ?? 1 });
  const createAudit = options.auditError
    ? vi.fn().mockRejectedValue(options.auditError)
    : vi.fn().mockResolvedValue({ id: "audit-id" });
  const transaction = {
    $queryRaw: queryRaw,
    userCapabilityAssignment: { findMany },
    user: { updateMany },
    auditLog: { create: createAudit },
  };
  const runTransaction = vi.fn(
    async (callback: (value: typeof transaction) => Promise<unknown>) =>
      callback(transaction),
  );
  return {
    database: {
      $transaction: runTransaction,
    } as unknown as PrismaClient,
    transaction,
    runTransaction,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("transactional actor revalidation", () => {
  it("reloads and locks the actor before locking and changing the target", async () => {
    const fixture = mutationDatabase({});

    await expect(
      approvePendingStudentAsActor(claims, targetId, fixture.database),
    ).resolves.toEqual({ ok: true });

    expect(fixture.transaction.$queryRaw).toHaveBeenCalledTimes(2);
    expect(
      fixture.transaction.userCapabilityAssignment.findMany,
    ).toHaveBeenCalledWith({
      where: { userId: claims.actorId },
      select: { capability: true },
    });
    expect(
      fixture.transaction.user.updateMany.mock.invocationCallOrder[0],
    ).toBeGreaterThan(
      fixture.transaction.$queryRaw.mock.invocationCallOrder[1]!,
    );
    expect(
      fixture.transaction.auditLog.create.mock.invocationCallOrder[0],
    ).toBeGreaterThan(
      fixture.transaction.user.updateMany.mock.invocationCallOrder[0]!,
    );
  });

  it("rejects a stale actor inside the transaction before loading the target", async () => {
    const fixture = mutationDatabase({ actorVersion: 5 });

    await expect(
      disableStudentAsActor(claims, targetId, fixture.database),
    ).resolves.toEqual({
      ok: false,
      message: "The account transition could not be completed.",
    });

    expect(fixture.runTransaction).toHaveBeenCalledTimes(1);
    expect(fixture.transaction.$queryRaw).toHaveBeenCalledTimes(1);
    expect(fixture.transaction.user.updateMany).not.toHaveBeenCalled();
    expect(fixture.transaction.auditLog.create).not.toHaveBeenCalled();
  });

  it("rejects an ADMIN without an explicit assignment", async () => {
    const fixture = mutationDatabase({
      actorRole: "ADMIN",
      capabilities: [],
    });
    await expect(
      approvePendingStudentAsActor(claims, targetId, fixture.database),
    ).resolves.toEqual({
      ok: false,
      message: "The account transition could not be completed.",
    });
    expect(fixture.transaction.$queryRaw).toHaveBeenCalledTimes(1);
    expect(fixture.transaction.user.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a capability-bearing ADMIN when exact STAFF mode is required", async () => {
    const fixture = mutationDatabase({
      actorRole: "ADMIN",
      capabilities: ["MANAGE_STUDENT_ACCOUNTS"],
    });
    await expect(
      approvePendingStudentAsActor(
        claims,
        targetId,
        fixture.database,
        "STAFF_ONLY",
      ),
    ).resolves.toEqual({
      ok: false,
      message: "The account transition could not be completed.",
    });
    expect(fixture.transaction.$queryRaw).toHaveBeenCalledTimes(1);
    expect(fixture.transaction.user.updateMany).not.toHaveBeenCalled();
  });

  it("allows only a capability-bearing exact ADMIN in legacy compatibility mode", async () => {
    const adminFixture = mutationDatabase({
      actorRole: "ADMIN",
      capabilities: ["MANAGE_STUDENT_ACCOUNTS"],
    });
    await expect(
      approvePendingStudentAsActor(
        claims,
        targetId,
        adminFixture.database,
        "ADMIN_ONLY",
      ),
    ).resolves.toEqual({ ok: true });
    expect(adminFixture.transaction.user.updateMany).toHaveBeenCalledTimes(1);

    const staffFixture = mutationDatabase({
      actorRole: "STAFF",
      capabilities: ["MANAGE_STUDENT_ACCOUNTS"],
    });
    await expect(
      approvePendingStudentAsActor(
        claims,
        targetId,
        staffFixture.database,
        "ADMIN_ONLY",
      ),
    ).resolves.toEqual({
      ok: false,
      message: "The account transition could not be completed.",
    });
    expect(staffFixture.transaction.$queryRaw).toHaveBeenCalledTimes(1);
    expect(staffFixture.transaction.user.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a malformed target identifier without sending it to PostgreSQL", async () => {
    const fixture = mutationDatabase({});
    await expect(
      approvePendingStudentAsActor(
        claims,
        "not-a-user-identifier",
        fixture.database,
      ),
    ).resolves.toEqual({
      ok: false,
      message: "The account transition could not be completed.",
    });
    expect(fixture.transaction.$queryRaw).toHaveBeenCalledTimes(1);
    expect(fixture.transaction.user.updateMany).not.toHaveBeenCalled();
  });
});

describe("student lifecycle mutations", () => {
  it("approves atomically and increments the target sessionVersion", async () => {
    const fixture = mutationDatabase({});
    await expect(
      approvePendingStudentAsActor(claims, targetId, fixture.database),
    ).resolves.toEqual({ ok: true });
    expect(fixture.transaction.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: targetId,
        role: "STUDENT",
        status: "PENDING_APPROVAL",
        sessionVersion: 2,
      },
      data: expect.objectContaining({
        status: "ACTIVE",
        approvedById: claims.actorId,
        sessionVersion: { increment: 1 },
      }),
    });
    expect(fixture.transaction.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: claims.actorId,
        action: "ACCOUNT_APPROVED",
        entityType: "User",
        entityId: targetId,
        metadata: {
          previousStatus: "PENDING_APPROVAL",
          newStatus: "ACTIVE",
        },
      },
    });
  });

  it("disables atomically and invalidates the target session", async () => {
    const fixture = mutationDatabase({
      target: lockedUser({ status: "ACTIVE", sessionVersion: 8 }),
    });
    await expect(
      disableStudentAsActor(claims, targetId, fixture.database),
    ).resolves.toEqual({ ok: true });
    expect(fixture.transaction.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: targetId,
        role: "STUDENT",
        status: "ACTIVE",
        sessionVersion: 8,
      },
      data: expect.objectContaining({
        status: "DISABLED",
        disabledById: claims.actorId,
        sessionVersion: { increment: 1 },
      }),
    });
  });

  it("reactivates only DISABLED students, clears current disable fields, and increments the version", async () => {
    const fixture = mutationDatabase({
      capabilities: ["REACTIVATE_STUDENT_ACCOUNTS"],
      target: lockedUser({ status: "DISABLED", sessionVersion: 9 }),
    });
    await expect(
      reactivateDisabledStudentAsActor(claims, targetId, fixture.database),
    ).resolves.toEqual({ ok: true });
    expect(fixture.transaction.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: targetId,
        role: "STUDENT",
        status: "DISABLED",
        sessionVersion: 9,
      },
      data: {
        status: "ACTIVE",
        disabledAt: null,
        disabledById: null,
        sessionVersion: { increment: 1 },
      },
    });
    expect(fixture.transaction.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: claims.actorId,
        action: "ACCOUNT_REACTIVATED",
        entityType: "User",
        entityId: targetId,
        metadata: {
          previousStatus: "DISABLED",
          newStatus: "ACTIVE",
        },
      },
    });
  });

  it.each([
    ["approval", "PENDING_APPROVAL", "MANAGE_STUDENT_ACCOUNTS"],
    ["disable", "ACTIVE", "MANAGE_STUDENT_ACCOUNTS"],
    ["reactivation", "DISABLED", "REACTIVATE_STUDENT_ACCOUNTS"],
  ] as const)(
    "propagates an audit failure from %s so the authoritative transaction rolls back",
    async (operation, status, capability) => {
      const privateFailure = new Error("private audit failure");
      const fixture = mutationDatabase({
        capabilities: [capability],
        target: lockedUser({ status }),
        auditError: privateFailure,
      });
      const promise =
        operation === "approval"
          ? approvePendingStudentAsActor(claims, targetId, fixture.database)
          : operation === "disable"
            ? disableStudentAsActor(claims, targetId, fixture.database)
            : reactivateDisabledStudentAsActor(
                claims,
                targetId,
                fixture.database,
              );
      await expect(promise).rejects.toBe(privateFailure);
      expect(fixture.transaction.user.updateMany).toHaveBeenCalledTimes(1);
      expect(fixture.transaction.auditLog.create).toHaveBeenCalledTimes(1);
    },
  );
});

// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  accountStatusAuditEvent,
  capabilityAuditEvent,
  staffRoleAuditEvent,
} from "@/server/auth/audit-events";
import {
  changeStaffRoleAsActor,
  disableStaffAccountAsActor,
  grantCapabilityAsActor,
  loadCapabilityActor,
  revokeCapabilityAsActor,
} from "@/server/auth/capabilities.node";
import { getSessionUserByClaims } from "@/server/auth/dal.node";

const findUnique = vi.fn();
const database = {
  user: { findUnique },
} as unknown as PrismaClient;

function actor(
  overrides: Partial<{
    role: "STUDENT" | "STAFF" | "ADMIN";
    status: "PENDING_APPROVAL" | "ACTIVE" | "DISABLED";
    sessionVersion: number;
    capabilities: Array<
      | "MANAGE_STUDENT_ACCOUNTS"
      | "REACTIVATE_STUDENT_ACCOUNTS"
      | "MANAGE_STAFF_CAPABILITIES"
    >;
  }> = {},
) {
  return {
    id: "actor-id",
    fullName: "Authorized Actor",
    role: overrides.role ?? "STAFF",
    status: overrides.status ?? "ACTIVE",
    sessionVersion: overrides.sessionVersion ?? 7,
    capabilityAssignments: (
      overrides.capabilities ?? ["MANAGE_STUDENT_ACCOUNTS"]
    ).map((capability) => ({ capability })),
  };
}

beforeEach(() => {
  findUnique.mockReset();
});

describe("database-authoritative capability authorization", () => {
  it("rejects a missing identity without querying the database", async () => {
    await expect(
      loadCapabilityActor(
        { actorId: undefined, claimedSessionVersion: 7 },
        "MANAGE_STUDENT_ACCOUNTS",
        database,
      ),
    ).resolves.toEqual({ ok: false, reason: "UNAUTHENTICATED" });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it.each([undefined, -1, 1.5, 6, 8])(
    "rejects missing or stale sessionVersion %s",
    async (claimedSessionVersion) => {
      findUnique.mockResolvedValue(actor());
      await expect(
        loadCapabilityActor(
          { actorId: "actor-id", claimedSessionVersion },
          "MANAGE_STUDENT_ACCOUNTS",
          database,
        ),
      ).resolves.toEqual({ ok: false, reason: "STALE_SESSION" });
    },
  );

  it.each(["STAFF", "ADMIN"] as const)(
    "allows an active %s only with the explicit database assignment",
    async (role) => {
      findUnique.mockResolvedValue(actor({ role }));
      const result = await loadCapabilityActor(
        { actorId: "actor-id", claimedSessionVersion: 7 },
        "MANAGE_STUDENT_ACCOUNTS",
        database,
      );
      expect(result).toMatchObject({
        ok: true,
        actor: { id: "actor-id", role, sessionVersion: 7 },
      });
    },
  );

  it("does not give ADMIN an authorization bypass", async () => {
    findUnique.mockResolvedValue(actor({ role: "ADMIN", capabilities: [] }));
    await expect(
      loadCapabilityActor(
        { actorId: "actor-id", claimedSessionVersion: 7 },
        "MANAGE_STUDENT_ACCOUNTS",
        database,
      ),
    ).resolves.toEqual({ ok: false, reason: "MISSING_CAPABILITY" });
  });

  it("rejects an active student even if an invalid assignment exists", async () => {
    findUnique.mockResolvedValue(actor({ role: "STUDENT" }));
    await expect(
      loadCapabilityActor(
        { actorId: "actor-id", claimedSessionVersion: 7 },
        "MANAGE_STUDENT_ACCOUNTS",
        database,
      ),
    ).resolves.toEqual({ ok: false, reason: "WRONG_ROLE" });
  });

  it.each(["PENDING_APPROVAL", "DISABLED"] as const)(
    "rejects a %s staff account",
    async (status) => {
      findUnique.mockResolvedValue(actor({ status }));
      await expect(
        loadCapabilityActor(
          { actorId: "actor-id", claimedSessionVersion: 7 },
          "MANAGE_STUDENT_ACCOUNTS",
          database,
        ),
      ).resolves.toEqual({ ok: false, reason: "INACTIVE_ACCOUNT" });
    },
  );
});

describe("database-authoritative session users", () => {
  it("returns the current database role and version, not browser claims", async () => {
    findUnique.mockResolvedValue(actor({ role: "ADMIN" }));
    await expect(
      getSessionUserByClaims(
        { actorId: "actor-id", claimedSessionVersion: 7 },
        database,
      ),
    ).resolves.toMatchObject({
      ok: true,
      user: { role: "ADMIN", status: "ACTIVE", sessionVersion: 7 },
    });
  });

  it("rejects a stale general session", async () => {
    findUnique.mockResolvedValue(actor({ sessionVersion: 9 }));
    await expect(
      getSessionUserByClaims(
        { actorId: "actor-id", claimedSessionVersion: 7 },
        database,
      ),
    ).resolves.toEqual({ ok: false, reason: "STALE_SESSION" });
  });
});

describe("typed redacted authorization audit events", () => {
  it("uses allowlisted account lifecycle metadata", () => {
    const event = accountStatusAuditEvent({
      actorId: "actor-id",
      targetUserId: "target-id",
      action: "ACCOUNT_REACTIVATED",
      previousStatus: "DISABLED",
      newStatus: "ACTIVE",
    });
    expect(event).toStrictEqual({
      actorId: "actor-id",
      action: "ACCOUNT_REACTIVATED",
      entityType: "User",
      entityId: "target-id",
      metadata: { previousStatus: "DISABLED", newStatus: "ACTIVE" },
    });
  });

  it("contains no email, password, token, or session data", () => {
    const events = [
      capabilityAuditEvent({
        actorId: "actor-id",
        targetUserId: "target-id",
        action: "CAPABILITY_GRANTED",
        capability: "MANAGE_STAFF_CAPABILITIES",
      }),
      staffRoleAuditEvent({
        actorId: "actor-id",
        targetUserId: "target-id",
        previousRole: "STAFF",
        newRole: "ADMIN",
        removedCapabilityCount: 0,
      }),
    ];
    const serialized = JSON.stringify(events);
    for (const forbidden of ["email", "password", "token", "sessionVersion"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});

type LockedUser = {
  id: string;
  role: "STUDENT" | "STAFF" | "ADMIN";
  status: "PENDING_APPROVAL" | "ACTIVE" | "DISABLED";
  sessionVersion: number;
};

const managerClaims = {
  actorId: "30000000-0000-4000-8000-000000000001",
  claimedSessionVersion: 0,
} as const;
const managedUserId = "30000000-0000-4000-8000-000000000002";

function managementDatabase(options: {
  actorCapabilities?: string[];
  target?: LockedUser;
  queryPrefix?: unknown[][];
  assignment?: { userId: string } | null;
}) {
  const actor: LockedUser = {
    id: managerClaims.actorId,
    role: "STAFF",
    status: "ACTIVE",
    sessionVersion: 0,
  };
  const target: LockedUser = options.target ?? {
    id: managedUserId,
    role: "STAFF",
    status: "ACTIVE",
    sessionVersion: 0,
  };
  const queryRaw = vi.fn();
  for (const result of options.queryPrefix ?? [[actor], [target]]) {
    queryRaw.mockResolvedValueOnce(result);
  }
  const transaction = {
    $queryRaw: queryRaw,
    userCapabilityAssignment: {
      findMany: vi
        .fn()
        .mockResolvedValue(
          (
            options.actorCapabilities ?? [
              "MANAGE_STAFF_CAPABILITIES",
              "MANAGE_STAFF_ACCOUNTS",
            ]
          ).map((capability) => ({ capability })),
        ),
      findUnique: vi.fn().mockResolvedValue(options.assignment ?? null),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    user: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const database = {
    $transaction: vi.fn(
      async (callback: (value: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
    ),
  } as unknown as PrismaClient;
  return { database, transaction };
}

describe("runtime capability management invariants", () => {
  it("rejects a self-grant before loading or changing the target", async () => {
    const fixture = managementDatabase({});
    await expect(
      grantCapabilityAsActor(
        managerClaims,
        managerClaims.actorId,
        "VIEW_AUDIT_LOG",
        fixture.database,
      ),
    ).resolves.toEqual({ ok: false, reason: "SELF_GRANT" });
    expect(fixture.transaction.$queryRaw).toHaveBeenCalledTimes(1);
    expect(
      fixture.transaction.userCapabilityAssignment.create,
    ).not.toHaveBeenCalled();
  });

  it.each([[{ role: "STUDENT" as const }], [{ status: "DISABLED" as const }]])(
    "rejects an ineligible grant target",
    async (overrides) => {
      const fixture = managementDatabase({
        target: {
          id: managedUserId,
          role: "STAFF",
          status: "ACTIVE",
          sessionVersion: 0,
          ...overrides,
        },
      });
      await expect(
        grantCapabilityAsActor(
          managerClaims,
          managedUserId,
          "VIEW_AUDIT_LOG",
          fixture.database,
        ),
      ).resolves.toEqual({
        ok: false,
        reason: "TARGET_NOT_ELIGIBLE",
      });
      expect(
        fixture.transaction.userCapabilityAssignment.create,
      ).not.toHaveBeenCalled();
    },
  );

  it("records the real authorized actor as grantor and writes a typed audit", async () => {
    const fixture = managementDatabase({});
    await expect(
      grantCapabilityAsActor(
        managerClaims,
        managedUserId,
        "VIEW_AUDIT_LOG",
        fixture.database,
      ),
    ).resolves.toEqual({ ok: true });
    expect(
      fixture.transaction.userCapabilityAssignment.create,
    ).toHaveBeenCalledWith({
      data: {
        userId: managedUserId,
        capability: "VIEW_AUDIT_LOG",
        grantedById: managerClaims.actorId,
      },
    });
    expect(fixture.transaction.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: managerClaims.actorId,
        action: "CAPABILITY_GRANTED",
        entityType: "UserCapabilityAssignment",
        entityId: `${managedUserId}:VIEW_AUDIT_LOG`,
        metadata: { capability: "VIEW_AUDIT_LOG" },
      },
    });
  });

  it("enforces active assignment uniqueness without overwriting", async () => {
    const fixture = managementDatabase({
      assignment: { userId: managedUserId },
    });
    await expect(
      grantCapabilityAsActor(
        managerClaims,
        managedUserId,
        "VIEW_AUDIT_LOG",
        fixture.database,
      ),
    ).resolves.toEqual({ ok: false, reason: "ASSIGNMENT_EXISTS" });
    expect(
      fixture.transaction.userCapabilityAssignment.create,
    ).not.toHaveBeenCalled();
  });

  it("requires explicit audited revocation before changing a capability holder to STUDENT", async () => {
    const fixture = managementDatabase({
      actorCapabilities: ["MANAGE_STAFF_ACCOUNTS"],
      queryPrefix: [
        [],
        [
          {
            id: managerClaims.actorId,
            role: "STAFF",
            status: "ACTIVE",
            sessionVersion: 0,
          },
        ],
        [
          {
            id: managedUserId,
            role: "STAFF",
            status: "ACTIVE",
            sessionVersion: 0,
          },
        ],
      ],
    });
    await expect(
      changeStaffRoleAsActor(
        managerClaims,
        managedUserId,
        "STUDENT",
        fixture.database,
      ),
    ).resolves.toEqual({
      ok: false,
      reason: "TARGET_HAS_CAPABILITIES",
    });
    expect(
      fixture.transaction.userCapabilityAssignment.count,
    ).toHaveBeenCalledWith({ where: { userId: managedUserId } });
    expect(fixture.transaction.user.updateMany).not.toHaveBeenCalled();
  });

  it("revokes an assignment transactionally with a typed audit", async () => {
    const fixture = managementDatabase({
      queryPrefix: [
        [],
        [
          {
            id: managerClaims.actorId,
            role: "STAFF",
            status: "ACTIVE",
            sessionVersion: 0,
          },
        ],
        [
          {
            id: managedUserId,
            role: "STAFF",
            status: "ACTIVE",
            sessionVersion: 0,
          },
        ],
      ],
    });
    await expect(
      revokeCapabilityAsActor(
        managerClaims,
        managedUserId,
        "VIEW_AUDIT_LOG",
        fixture.database,
      ),
    ).resolves.toEqual({ ok: true });
    expect(
      fixture.transaction.userCapabilityAssignment.deleteMany,
    ).toHaveBeenCalledWith({
      where: { userId: managedUserId, capability: "VIEW_AUDIT_LOG" },
    });
    expect(fixture.transaction.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: managerClaims.actorId,
        action: "CAPABILITY_REVOKED",
        entityType: "UserCapabilityAssignment",
        entityId: `${managedUserId}:VIEW_AUDIT_LOG`,
        metadata: { capability: "VIEW_AUDIT_LOG" },
      },
    });
  });

  it("invalidates a disabled staff target session and audits the status change", async () => {
    const fixture = managementDatabase({
      actorCapabilities: ["MANAGE_STAFF_ACCOUNTS"],
      queryPrefix: [
        [],
        [
          {
            id: managerClaims.actorId,
            role: "STAFF",
            status: "ACTIVE",
            sessionVersion: 0,
          },
        ],
        [
          {
            id: managedUserId,
            role: "STAFF",
            status: "ACTIVE",
            sessionVersion: 3,
          },
        ],
      ],
    });
    await expect(
      disableStaffAccountAsActor(
        managerClaims,
        managedUserId,
        fixture.database,
      ),
    ).resolves.toEqual({ ok: true });
    expect(fixture.transaction.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: managedUserId,
        role: "STAFF",
        status: "ACTIVE",
        sessionVersion: 3,
      },
      data: expect.objectContaining({
        status: "DISABLED",
        disabledById: managerClaims.actorId,
        sessionVersion: { increment: 1 },
      }),
    });
    expect(fixture.transaction.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: managerClaims.actorId,
        action: "ACCOUNT_DISABLED",
        entityType: "User",
        entityId: managedUserId,
        metadata: {
          previousStatus: "ACTIVE",
          newStatus: "DISABLED",
        },
      },
    });
  });

  it("invalidates the target session after a compatible STAFF to ADMIN role change", async () => {
    const fixture = managementDatabase({
      actorCapabilities: ["MANAGE_STAFF_ACCOUNTS"],
      queryPrefix: [
        [],
        [
          {
            id: managerClaims.actorId,
            role: "STAFF",
            status: "ACTIVE",
            sessionVersion: 0,
          },
        ],
        [
          {
            id: managedUserId,
            role: "STAFF",
            status: "ACTIVE",
            sessionVersion: 5,
          },
        ],
      ],
    });
    await expect(
      changeStaffRoleAsActor(
        managerClaims,
        managedUserId,
        "ADMIN",
        fixture.database,
      ),
    ).resolves.toEqual({ ok: true });
    expect(fixture.transaction.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: managedUserId,
        role: "STAFF",
        status: "ACTIVE",
        sessionVersion: 5,
      },
      data: { role: "ADMIN", sessionVersion: { increment: 1 } },
    });
  });
});

describe("final capability-manager protection", () => {
  function finalManagerFixture(actorCapability: string) {
    return managementDatabase({
      actorCapabilities: [actorCapability],
      queryPrefix: [
        [],
        [
          {
            id: managerClaims.actorId,
            role: "STAFF",
            status: "ACTIVE",
            sessionVersion: 0,
          },
        ],
        [
          {
            id: managedUserId,
            role: "STAFF",
            status: "ACTIVE",
            sessionVersion: 0,
          },
        ],
        [{ count: BigInt(1) }],
      ],
      assignment: { userId: managedUserId },
    });
  }

  it.each([
    [
      "revoke",
      (fixture: ReturnType<typeof finalManagerFixture>) =>
        revokeCapabilityAsActor(
          managerClaims,
          managedUserId,
          "MANAGE_STAFF_CAPABILITIES",
          fixture.database,
        ),
      "MANAGE_STAFF_CAPABILITIES",
    ],
    [
      "disable",
      (fixture: ReturnType<typeof finalManagerFixture>) =>
        disableStaffAccountAsActor(
          managerClaims,
          managedUserId,
          fixture.database,
        ),
      "MANAGE_STAFF_ACCOUNTS",
    ],
    [
      "role change",
      (fixture: ReturnType<typeof finalManagerFixture>) =>
        changeStaffRoleAsActor(
          managerClaims,
          managedUserId,
          "STUDENT",
          fixture.database,
        ),
      "MANAGE_STAFF_ACCOUNTS",
    ],
  ] as const)(
    "prevents final-manager removal through %s",
    async (_operation, execute, actorCapability) => {
      const fixture = finalManagerFixture(actorCapability);
      await expect(execute(fixture)).resolves.toEqual({
        ok: false,
        reason: "LAST_CAPABILITY_MANAGER",
      });
      const firstSql = fixture.transaction.$queryRaw.mock.calls[0]?.[0] as {
        strings?: readonly string[];
      };
      expect(firstSql.strings?.join(" ")).toContain("pg_advisory_xact_lock");
      expect(
        fixture.transaction.userCapabilityAssignment.deleteMany,
      ).not.toHaveBeenCalled();
      expect(fixture.transaction.user.updateMany).not.toHaveBeenCalled();
      expect(fixture.transaction.auditLog.create).not.toHaveBeenCalled();
    },
  );

  it("serializes concurrent attempts so exactly one active manager remains", async () => {
    const firstId = "40000000-0000-4000-8000-000000000001";
    const secondId = "40000000-0000-4000-8000-000000000002";
    const managers = new Set([firstId, secondId]);
    let lockTail = Promise.resolve();

    const database = {
      $transaction: async (
        callback: (transaction: Record<string, unknown>) => Promise<unknown>,
      ) => {
        let releaseLock: (() => void) | undefined;
        const transaction = {
          $queryRaw: async (sql: {
            strings?: readonly string[];
            values?: readonly unknown[];
          }) => {
            const text = sql.strings?.join(" ") ?? "";
            if (text.includes("pg_advisory_xact_lock")) {
              const previous = lockTail;
              lockTail = new Promise<void>((resolve) => {
                releaseLock = resolve;
              });
              await previous;
              return [];
            }
            if (text.includes('FROM "User"')) {
              const id = String(sql.values?.[0]);
              return [
                {
                  id,
                  role: "STAFF",
                  status: "ACTIVE",
                  sessionVersion: 0,
                },
              ];
            }
            if (text.includes("count(*)")) {
              return [{ count: BigInt(managers.size) }];
            }
            return [];
          },
          userCapabilityAssignment: {
            findMany: async ({ where }: { where: { userId: string } }) =>
              managers.has(where.userId)
                ? [{ capability: "MANAGE_STAFF_CAPABILITIES" }]
                : [],
            findUnique: async ({
              where,
            }: {
              where: {
                userId_capability: {
                  userId: string;
                  capability: string;
                };
              };
            }) =>
              managers.has(where.userId_capability.userId)
                ? { userId: where.userId_capability.userId }
                : null,
            deleteMany: async ({
              where,
            }: {
              where: { userId: string; capability: string };
            }) => {
              const removed = managers.delete(where.userId);
              return { count: removed ? 1 : 0 };
            },
          },
          auditLog: { create: vi.fn().mockResolvedValue({}) },
        };
        try {
          return await callback(transaction);
        } finally {
          releaseLock?.();
        }
      },
    } as unknown as PrismaClient;

    const results = await Promise.all([
      revokeCapabilityAsActor(
        { actorId: firstId, claimedSessionVersion: 0 },
        secondId,
        "MANAGE_STAFF_CAPABILITIES",
        database,
      ),
      revokeCapabilityAsActor(
        { actorId: secondId, claimedSessionVersion: 0 },
        firstId,
        "MANAGE_STAFF_CAPABILITIES",
        database,
      ),
    ]);

    expect(results.filter(({ ok }) => ok)).toHaveLength(1);
    expect(results.filter(({ ok }) => !ok)).toHaveLength(1);
    expect(managers.size).toBe(1);
  });
});

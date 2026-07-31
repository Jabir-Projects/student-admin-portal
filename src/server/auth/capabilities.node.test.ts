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
  createStaffAccountAsActor,
  disableStaffAccountAsActor,
  grantCapabilityAsActor,
  loadCapabilityActor,
  reactivateStaffAccountAsActor,
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

  it("allows an active STAFF only with the explicit database assignment", async () => {
    findUnique.mockResolvedValue(actor({ role: "STAFF" }));
    const result = await loadCapabilityActor(
      { actorId: "actor-id", claimedSessionVersion: 7 },
      "MANAGE_STUDENT_ACCOUNTS",
      database,
    );
    expect(result).toMatchObject({
      ok: true,
      actor: { id: "actor-id", role: "STAFF", sessionVersion: 7 },
    });
  });

  it("rejects a retired ADMIN value even with a capability assignment", async () => {
    findUnique.mockResolvedValue(actor({ role: "ADMIN", capabilities: [] }));
    await expect(
      loadCapabilityActor(
        { actorId: "actor-id", claimedSessionVersion: 7 },
        "MANAGE_STUDENT_ACCOUNTS",
        database,
      ),
    ).resolves.toEqual({ ok: false, reason: "WRONG_ROLE" });
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

  it.each([
    ["PENDING_APPROVAL", "INACTIVE_ACCOUNT"],
    ["DISABLED", "DISABLED_ACCOUNT"],
  ] as const)("rejects a %s staff account", async (status, reason) => {
    findUnique.mockResolvedValue(actor({ status }));
    await expect(
      loadCapabilityActor(
        { actorId: "actor-id", claimedSessionVersion: 7 },
        "MANAGE_STUDENT_ACCOUNTS",
        database,
      ),
    ).resolves.toEqual({ ok: false, reason });
  });
});

describe("database-authoritative session users", () => {
  it("returns the current database role and version, not browser claims", async () => {
    findUnique.mockResolvedValue(actor({ role: "STAFF" }));
    await expect(
      getSessionUserByClaims(
        { actorId: "actor-id", claimedSessionVersion: 7 },
        database,
      ),
    ).resolves.toMatchObject({
      ok: true,
      user: { role: "STAFF", status: "ACTIVE", sessionVersion: 7 },
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
        newRole: "STUDENT",
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
  assignedCapabilityCount?: number;
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
      count: vi.fn().mockResolvedValue(options.assignedCapabilityCount ?? 1),
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      create: vi.fn().mockResolvedValue({ id: managedUserId }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
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
  it("creates an active STAFF account with initial capabilities and redacted audits in one transaction", async () => {
    const actorRow = {
      id: managerClaims.actorId,
      role: "STAFF",
      status: "ACTIVE",
      sessionVersion: 0,
    };
    const fixture = managementDatabase({
      queryPrefix: [[actorRow], [actorRow]],
    });
    await expect(
      createStaffAccountAsActor(
        managerClaims,
        {
          email: "sara@example.com",
          fullName: "Sara Amrani",
          passwordHash: "argon2id-test-hash",
          capabilities: ["VIEW_AUDIT_LOG"],
        },
        fixture.database,
      ),
    ).resolves.toEqual({ ok: true });

    expect(fixture.transaction.user.create).toHaveBeenCalledWith({
      data: {
        email: "sara@example.com",
        fullName: "Sara Amrani",
        passwordHash: "argon2id-test-hash",
        role: "STAFF",
        status: "ACTIVE",
        approvedAt: expect.any(Date),
        approvedById: managerClaims.actorId,
        capabilityAssignments: {
          create: [
            {
              capability: "VIEW_AUDIT_LOG",
              grantedById: managerClaims.actorId,
            },
          ],
        },
      },
      select: { id: true },
    });
    const auditPayload = JSON.stringify(
      fixture.transaction.auditLog.create.mock.calls,
    );
    expect(auditPayload).toContain("STAFF_ACCOUNT_CREATED");
    expect(auditPayload).toContain("CAPABILITY_GRANTED");
    expect(auditPayload).not.toContain("sara@example.com");
    expect(auditPayload).not.toContain("argon2id-test-hash");
  });

  it("rejects initial capability assignment when the actor lacks capability-management authority", async () => {
    const actorRow = {
      id: managerClaims.actorId,
      role: "STAFF",
      status: "ACTIVE",
      sessionVersion: 0,
    };
    const fixture = managementDatabase({
      actorCapabilities: ["MANAGE_STAFF_ACCOUNTS"],
      queryPrefix: [[actorRow], [actorRow]],
    });
    await expect(
      createStaffAccountAsActor(
        managerClaims,
        {
          email: "sara@example.com",
          fullName: "Sara Amrani",
          passwordHash: "argon2id-test-hash",
          capabilities: ["VIEW_AUDIT_LOG"],
        },
        fixture.database,
      ),
    ).resolves.toEqual({ ok: false, reason: "MISSING_CAPABILITY" });
    expect(fixture.transaction.user.create).not.toHaveBeenCalled();
  });

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

  it("prevents self-revocation before changing assignments", async () => {
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
      ],
    });
    await expect(
      revokeCapabilityAsActor(
        managerClaims,
        managerClaims.actorId,
        "VIEW_AUDIT_LOG",
        fixture.database,
      ),
    ).resolves.toEqual({ ok: false, reason: "SELF_ACTION" });
    expect(
      fixture.transaction.userCapabilityAssignment.deleteMany,
    ).not.toHaveBeenCalled();
    expect(fixture.transaction.auditLog.create).not.toHaveBeenCalled();
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

  it.each(["ADMIN", "STUDENT"] as const)(
    "rejects disable for an exact %s target without mutating account state",
    async (role) => {
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
              role,
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
      ).resolves.toEqual({
        ok: false,
        reason: "TARGET_NOT_ELIGIBLE",
      });
      expect(fixture.transaction.user.updateMany).not.toHaveBeenCalled();
      expect(fixture.transaction.auditLog.create).not.toHaveBeenCalled();
    },
  );

  it("reactivates only an exact disabled STAFF target with session invalidation and audit", async () => {
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
            status: "DISABLED",
            sessionVersion: 3,
          },
        ],
      ],
    });
    await expect(
      reactivateStaffAccountAsActor(
        managerClaims,
        managedUserId,
        fixture.database,
      ),
    ).resolves.toEqual({ ok: true });
    expect(fixture.transaction.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: managedUserId,
        role: "STAFF",
        status: "DISABLED",
        sessionVersion: 3,
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
        actorId: managerClaims.actorId,
        action: "ACCOUNT_REACTIVATED",
        entityType: "User",
        entityId: managedUserId,
        metadata: {
          previousStatus: "DISABLED",
          newStatus: "ACTIVE",
        },
      },
    });
  });

  it.each([
    ["ACTIVE", "STAFF"],
    ["DISABLED", "ADMIN"],
    ["DISABLED", "STUDENT"],
  ] as const)(
    "rejects reactivation for a %s %s target",
    async (status, role) => {
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
          [{ id: managedUserId, role, status, sessionVersion: 3 }],
        ],
      });
      await expect(
        reactivateStaffAccountAsActor(
          managerClaims,
          managedUserId,
          fixture.database,
        ),
      ).resolves.toEqual({
        ok: false,
        reason: "TARGET_NOT_ELIGIBLE",
      });
      expect(fixture.transaction.user.updateMany).not.toHaveBeenCalled();
      expect(fixture.transaction.auditLog.create).not.toHaveBeenCalled();
    },
  );

  it("rejects legacy ADMIN actors transactionally on STAFF lifecycle actions", async () => {
    for (const action of [
      disableStaffAccountAsActor,
      reactivateStaffAccountAsActor,
    ]) {
      const fixture = managementDatabase({
        actorCapabilities: ["MANAGE_STAFF_ACCOUNTS"],
        queryPrefix: [
          [],
          [
            {
              id: managerClaims.actorId,
              role: "ADMIN",
              status: "ACTIVE",
              sessionVersion: 0,
            },
          ],
        ],
      });
      await expect(
        action(managerClaims, managedUserId, fixture.database),
      ).resolves.toEqual({ ok: false, reason: "WRONG_ROLE" });
      expect(fixture.transaction.user.updateMany).not.toHaveBeenCalled();
    }
  });

  it.each([
    [
      "revoked capability",
      ["MANAGE_STUDENT_ACCOUNTS"],
      "ACTIVE",
      0,
      "MISSING_CAPABILITY",
    ],
    [
      "disabled actor",
      ["MANAGE_STAFF_ACCOUNTS"],
      "DISABLED",
      0,
      "DISABLED_ACCOUNT",
    ],
    [
      "stale actor session",
      ["MANAGE_STAFF_ACCOUNTS"],
      "ACTIVE",
      2,
      "STALE_SESSION",
    ],
  ] as const)(
    "transactionally rejects a %s",
    async (_label, actorCapabilities, status, sessionVersion, reason) => {
      for (const action of [
        disableStaffAccountAsActor,
        reactivateStaffAccountAsActor,
      ]) {
        const fixture = managementDatabase({
          actorCapabilities: [...actorCapabilities],
          queryPrefix: [
            [],
            [
              {
                id: managerClaims.actorId,
                role: "STAFF",
                status,
                sessionVersion,
              },
            ],
          ],
        });
        await expect(
          action(managerClaims, managedUserId, fixture.database),
        ).resolves.toEqual({ ok: false, reason });
        expect(fixture.transaction.user.updateMany).not.toHaveBeenCalled();
        expect(fixture.transaction.auditLog.create).not.toHaveBeenCalled();
      }
    },
  );

  it("prevents an exact STAFF actor from disabling their own account", async () => {
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
      ],
    });
    await expect(
      disableStaffAccountAsActor(
        managerClaims,
        managerClaims.actorId,
        fixture.database,
      ),
    ).resolves.toEqual({ ok: false, reason: "SELF_ACTION" });
    expect(fixture.transaction.user.updateMany).not.toHaveBeenCalled();
  });

  it("returns a stale-target failure without persisting a disable or audit", async () => {
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
    fixture.transaction.user.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      disableStaffAccountAsActor(
        managerClaims,
        managedUserId,
        fixture.database,
      ),
    ).resolves.toEqual({ ok: false, reason: "STALE_TARGET" });
    expect(fixture.transaction.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: managedUserId,
        role: "STAFF",
        status: "ACTIVE",
        sessionVersion: 3,
      },
      data: expect.objectContaining({
        status: "DISABLED",
        sessionVersion: { increment: 1 },
      }),
    });
    expect(fixture.transaction.auditLog.create).not.toHaveBeenCalled();
  });

  it("rolls back disable status and sessionVersion when the audit write fails", async () => {
    const persistedTarget: {
      id: string;
      role: "STAFF";
      status: "ACTIVE" | "DISABLED";
      sessionVersion: number;
      disabledAt: Date | null;
      disabledById: string | null;
    } = {
      id: managedUserId,
      role: "STAFF",
      status: "ACTIVE",
      sessionVersion: 3,
      disabledAt: null,
      disabledById: null,
    };
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: managerClaims.actorId,
          role: "STAFF",
          status: "ACTIVE",
          sessionVersion: 0,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: persistedTarget.id,
          role: persistedTarget.role,
          status: persistedTarget.status,
          sessionVersion: persistedTarget.sessionVersion,
        },
      ]);
    const updateMany = vi.fn();
    const auditCreate = vi
      .fn()
      .mockRejectedValue(new Error("audit unavailable"));
    const transaction = vi.fn(
      async (
        callback: (value: {
          $queryRaw: typeof queryRaw;
          userCapabilityAssignment: {
            findMany: ReturnType<typeof vi.fn>;
            findUnique: ReturnType<typeof vi.fn>;
          };
          user: { updateMany: typeof updateMany };
          auditLog: { create: typeof auditCreate };
        }) => Promise<unknown>,
      ) => {
        const pendingTarget = { ...persistedTarget };
        updateMany.mockImplementationOnce(async () => {
          pendingTarget.status = "DISABLED";
          pendingTarget.disabledAt = new Date();
          pendingTarget.disabledById = managerClaims.actorId;
          pendingTarget.sessionVersion += 1;
          return { count: 1 };
        });
        const result = await callback({
          $queryRaw: queryRaw,
          userCapabilityAssignment: {
            findMany: vi
              .fn()
              .mockResolvedValue([{ capability: "MANAGE_STAFF_ACCOUNTS" }]),
            findUnique: vi.fn().mockResolvedValue(null),
          },
          user: { updateMany },
          auditLog: { create: auditCreate },
        });
        Object.assign(persistedTarget, pendingTarget);
        return result;
      },
    );
    const rollbackDatabase = {
      $transaction: transaction,
    } as unknown as PrismaClient;

    await expect(
      disableStaffAccountAsActor(
        managerClaims,
        managedUserId,
        rollbackDatabase,
      ),
    ).rejects.toThrow("audit unavailable");
    expect(updateMany).toHaveBeenCalledOnce();
    expect(auditCreate).toHaveBeenCalledOnce();
    expect(persistedTarget).toEqual({
      id: managedUserId,
      role: "STAFF",
      status: "ACTIVE",
      sessionVersion: 3,
      disabledAt: null,
      disabledById: null,
    });
  });

  it("returns a stale-target failure without writing a reactivation audit", async () => {
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
            status: "DISABLED",
            sessionVersion: 3,
          },
        ],
      ],
    });
    fixture.transaction.user.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      reactivateStaffAccountAsActor(
        managerClaims,
        managedUserId,
        fixture.database,
      ),
    ).resolves.toEqual({ ok: false, reason: "STALE_TARGET" });
    expect(fixture.transaction.auditLog.create).not.toHaveBeenCalled();
  });

  it("propagates audit failure so the reactivation transaction can roll back", async () => {
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
            status: "DISABLED",
            sessionVersion: 3,
          },
        ],
      ],
    });
    fixture.transaction.auditLog.create.mockRejectedValueOnce(
      new Error("audit unavailable"),
    );
    await expect(
      reactivateStaffAccountAsActor(
        managerClaims,
        managedUserId,
        fixture.database,
      ),
    ).rejects.toThrow("audit unavailable");
  });

  it("invalidates the target session after a STAFF to STUDENT role change", async () => {
    const fixture = managementDatabase({
      actorCapabilities: ["MANAGE_STAFF_ACCOUNTS"],
      assignedCapabilityCount: 0,
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
        "STUDENT",
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
      data: { role: "STUDENT", sessionVersion: { increment: 1 } },
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

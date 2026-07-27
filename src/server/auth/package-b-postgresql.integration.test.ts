// @vitest-environment node

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  type TestContext,
} from "vitest";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  approvePendingStudentAsActor,
  disableStudentAsActor,
  reactivateDisabledStudentAsActor,
} from "@/server/auth/account-management.node";
import {
  changeStaffRoleAsActor,
  disableStaffAccountAsActor,
  grantCapabilityAsActor,
  loadCapabilityActor,
  revokeCapabilityAsActor,
} from "@/server/auth/capabilities.node";
import {
  hasPackageBTestDatabaseConfiguration,
  tryOpenPackageBTestDatabase,
  type VerifiedPackageBTestDatabase,
  type VerifiedPackageBTestDatabaseClient,
} from "@/test/package-b-test-database.node";

const managerAId = "97000000-0000-4000-8000-000000000001";
const managerBId = "97000000-0000-4000-8000-000000000002";
const bootstrapAdminId = "10000000-0000-4000-8000-000000000001";
const bootstrapAdminEmail = "admin.dev@example.invalid";
const bootstrapCapabilities = [
  "MANAGE_STUDENT_ACCOUNTS",
  "REACTIVATE_STUDENT_ACCOUNTS",
  "MANAGE_STAFF_ACCOUNTS",
  "MANAGE_STAFF_CAPABILITIES",
] as const;
const canonicalDisabledAt = new Date("2000-01-01T00:00:00.000Z");
const targetIds = [
  "97100000-0000-4000-8000-000000000001",
  "97100000-0000-4000-8000-000000000002",
  "97100000-0000-4000-8000-000000000003",
  "97100000-0000-4000-8000-000000000004",
] as const;
const allFixtureIds = [managerAId, managerBId, ...targetIds] as const;
const managerAClaims = {
  actorId: managerAId,
  claimedSessionVersion: 0,
} as const;
const managerBClaims = {
  actorId: managerBId,
  claimedSessionVersion: 0,
} as const;

type InteractiveTransactionOptions = {
  maxWait?: number;
  timeout?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
};

let verifiedDatabase: VerifiedPackageBTestDatabase | undefined;
let isolatedDb: VerifiedPackageBTestDatabaseClient | undefined;
let unrelatedStateSnapshot:
  Awaited<ReturnType<typeof readUnrelatedState>> | undefined;
let bootstrapManagerAssignmentSnapshot:
  | {
      userId: string;
      capability: "MANAGE_STAFF_CAPABILITIES";
      grantedById: string | null;
      createdAt: Date;
    }
  | undefined;

function databaseOrSkip(
  context: TestContext,
): VerifiedPackageBTestDatabaseClient | undefined {
  if (isolatedDb) return isolatedDb;
  context.skip(
    "PostgreSQL integration not run: isolated TEST_DATABASE_URL was not approved and verified.",
  );
  return undefined;
}

async function upsertManager(
  database: VerifiedPackageBTestDatabaseClient,
  id: string,
  email: string,
  active: boolean,
): Promise<void> {
  await database.user.upsert({
    where: { id },
    create: {
      id,
      email,
      fullName: "SIST Package B PostgreSQL Manager",
      passwordHash: "integration-test-non-authenticating-value",
      role: "STAFF",
      status: active ? "ACTIVE" : "DISABLED",
      sessionVersion: 0,
      disabledAt: active ? null : canonicalDisabledAt,
      disabledById: active ? null : id,
    },
    update: {
      email,
      fullName: "SIST Package B PostgreSQL Manager",
      role: "STAFF",
      status: active ? "ACTIVE" : "DISABLED",
      sessionVersion: 0,
      disabledAt: active ? null : canonicalDisabledAt,
      disabledById: active ? null : id,
    },
  });
}

async function readBootstrapAdminManagerAssignment(
  database: VerifiedPackageBTestDatabaseClient,
) {
  const admin = await database.user.findUnique({
    where: { id: bootstrapAdminId },
    select: {
      email: true,
      role: true,
      status: true,
      sessionVersion: true,
      capabilityAssignments: {
        orderBy: { capability: "asc" },
        select: {
          userId: true,
          capability: true,
          grantedById: true,
          createdAt: true,
        },
      },
    },
  });
  const expectedCapabilities = [...bootstrapCapabilities].sort();
  const actualCapabilities =
    admin?.capabilityAssignments.map(({ capability }) => capability).sort() ??
    [];
  if (
    !admin ||
    admin.email !== bootstrapAdminEmail ||
    admin.role !== "ADMIN" ||
    admin.status !== "ACTIVE" ||
    admin.sessionVersion !== 0 ||
    actualCapabilities.length !== expectedCapabilities.length ||
    actualCapabilities.some(
      (capability, index) => capability !== expectedCapabilities[index],
    ) ||
    admin.capabilityAssignments.some(({ grantedById }) => grantedById !== null)
  ) {
    throw new Error(
      "Package B bootstrap Test ADMIN baseline verification failed.",
    );
  }
  const managerAssignment = admin.capabilityAssignments.find(
    ({ capability }) => capability === "MANAGE_STAFF_CAPABILITIES",
  );
  if (!managerAssignment) {
    throw new Error(
      "Package B bootstrap Test ADMIN baseline verification failed.",
    );
  }
  return {
    ...managerAssignment,
    capability: "MANAGE_STAFF_CAPABILITIES" as const,
  };
}

async function restoreBootstrapAdminManagerAssignment(
  database: VerifiedPackageBTestDatabaseClient,
): Promise<void> {
  if (!bootstrapManagerAssignmentSnapshot) {
    throw new Error(
      "Package B bootstrap Test ADMIN snapshot is not available.",
    );
  }
  await database.userCapabilityAssignment.upsert({
    where: {
      userId_capability: {
        userId: bootstrapAdminId,
        capability: "MANAGE_STAFF_CAPABILITIES",
      },
    },
    create: bootstrapManagerAssignmentSnapshot,
    update: {
      grantedById: bootstrapManagerAssignmentSnapshot.grantedById,
      createdAt: bootstrapManagerAssignmentSnapshot.createdAt,
    },
  });
  await readBootstrapAdminManagerAssignment(database);
}

async function normalizeManagers(
  database: VerifiedPackageBTestDatabaseClient,
  active: boolean,
): Promise<void> {
  await upsertManager(
    database,
    managerAId,
    "sist-package-b-manager-a@example.test",
    active,
  );
  await upsertManager(
    database,
    managerBId,
    "sist-package-b-manager-b@example.test",
    active,
  );
}

async function readUnrelatedState(
  database: VerifiedPackageBTestDatabaseClient,
) {
  const excludedUserIds = [bootstrapAdminId, ...allFixtureIds];
  const [users, capabilityAssignments] = await Promise.all([
    database.user.findMany({
      where: { id: { notIn: excludedUserIds } },
      orderBy: { id: "asc" },
      select: {
        id: true,
        role: true,
        status: true,
        sessionVersion: true,
        updatedAt: true,
      },
    }),
    database.userCapabilityAssignment.findMany({
      where: { userId: { notIn: excludedUserIds } },
      orderBy: [{ userId: "asc" }, { capability: "asc" }],
      select: {
        userId: true,
        capability: true,
        grantedById: true,
        createdAt: true,
      },
    }),
  ]);
  return { users, capabilityAssignments };
}

async function verifyCanonicalFixtureState(): Promise<void> {
  if (!isolatedDb || !unrelatedStateSnapshot) {
    throw new Error(
      "Package B PostgreSQL final fixture verification is unavailable.",
    );
  }
  await readBootstrapAdminManagerAssignment(isolatedDb);
  const [managers, scenarioAssignmentCount, targetCount, unrelatedState] =
    await Promise.all([
      isolatedDb.user.findMany({
        where: { id: { in: [managerAId, managerBId] } },
        orderBy: { id: "asc" },
        select: {
          id: true,
          role: true,
          status: true,
          sessionVersion: true,
          disabledAt: true,
          disabledById: true,
        },
      }),
      isolatedDb.userCapabilityAssignment.count({
        where: { userId: { in: [...allFixtureIds] } },
      }),
      isolatedDb.user.count({ where: { id: { in: [...targetIds] } } }),
      readUnrelatedState(isolatedDb),
    ]);
  expect(managers).toEqual(
    [managerAId, managerBId].map((id) => ({
      id,
      role: "STAFF",
      status: "DISABLED",
      sessionVersion: 0,
      disabledAt: canonicalDisabledAt,
      disabledById: id,
    })),
  );
  expect(scenarioAssignmentCount).toBe(0);
  expect(targetCount).toBe(0);
  expect(unrelatedState).toEqual(unrelatedStateSnapshot);
}

async function cleanupFixtures(): Promise<void> {
  if (!isolatedDb) return;
  let cleanupStep = "scenario assignment cleanup";
  try {
    await isolatedDb.userCapabilityAssignment.deleteMany({
      where: { userId: { in: [...allFixtureIds] } },
    });
    cleanupStep = "scenario target cleanup";
    await isolatedDb.user.deleteMany({
      where: { id: { in: [...targetIds] } },
    });
    cleanupStep = "scenario manager normalization";
    await normalizeManagers(isolatedDb, false);
    cleanupStep = "bootstrap Test ADMIN restoration";
    await restoreBootstrapAdminManagerAssignment(isolatedDb);
  } catch {
    throw new Error(
      `Package B PostgreSQL fixture cleanup failed during ${cleanupStep}.`,
    );
  }
}

async function resetFixtures(): Promise<void> {
  if (!isolatedDb) return;
  await cleanupFixtures();
  await normalizeManagers(isolatedDb, true);
}

async function assignCapability(
  database: VerifiedPackageBTestDatabaseClient,
  userId: string,
  capability:
    | "MANAGE_STUDENT_ACCOUNTS"
    | "REACTIVATE_STUDENT_ACCOUNTS"
    | "MANAGE_STAFF_ACCOUNTS"
    | "MANAGE_STAFF_CAPABILITIES",
): Promise<void> {
  await database.userCapabilityAssignment.create({
    data: {
      userId,
      capability,
      grantedById: userId === managerAId ? managerBId : managerAId,
    },
  });
}

async function createTarget(
  database: VerifiedPackageBTestDatabaseClient,
  input: {
    id: string;
    role: "STUDENT" | "STAFF";
    status: "PENDING_APPROVAL" | "ACTIVE" | "DISABLED";
    sessionVersion?: number;
  },
): Promise<void> {
  await database.user.create({
    data: {
      id: input.id,
      email: `${input.id}@example.test`,
      fullName: "SIST Package B PostgreSQL Target",
      passwordHash: "integration-test-non-authenticating-value",
      role: input.role,
      status: input.status,
      sessionVersion: input.sessionVersion ?? 0,
      disabledAt: input.status === "DISABLED" ? new Date() : null,
      disabledById: input.status === "DISABLED" ? managerBId : null,
    },
  });
}

async function auditCount(
  database: VerifiedPackageBTestDatabaseClient,
  action: string,
  entityId: string,
): Promise<number> {
  return database.auditLog.count({ where: { action, entityId } });
}

function transactionWithForcedAuditFailure(
  transaction: Prisma.TransactionClient,
): Prisma.TransactionClient {
  const auditLog = new Proxy(transaction.auditLog, {
    get(target, property, receiver) {
      if (property !== "create") return Reflect.get(target, property, receiver);
      return () => Promise.reject(new Error("Forced audit write failure."));
    },
  });
  return new Proxy(transaction, {
    get(target, property, receiver) {
      if (property === "auditLog") return auditLog;
      return Reflect.get(target, property, receiver);
    },
  }) as Prisma.TransactionClient;
}

function databaseWithForcedAuditFailure(database: PrismaClient): PrismaClient {
  const transactionRunner = <Result>(
    callback: (transaction: Prisma.TransactionClient) => Promise<Result>,
    options?: InteractiveTransactionOptions,
  ) =>
    database.$transaction(
      (transaction) => callback(transactionWithForcedAuditFailure(transaction)),
      options,
    );
  return new Proxy(database, {
    get(target, property, receiver) {
      if (property === "$transaction") return transactionRunner;
      return Reflect.get(target, property, receiver);
    },
  });
}

async function activeCapabilityManagerCount(
  database: VerifiedPackageBTestDatabaseClient,
): Promise<number> {
  return database.userCapabilityAssignment.count({
    where: {
      capability: "MANAGE_STAFF_CAPABILITIES",
      user: {
        status: "ACTIVE",
        role: { in: ["STAFF", "ADMIN"] },
      },
    },
  });
}

async function withTrueFinalManagerState<Result>(
  context: TestContext,
  run: (database: VerifiedPackageBTestDatabase) => Promise<Result>,
): Promise<Result | undefined> {
  if (!databaseOrSkip(context)) return undefined;
  const readiness = await tryOpenPackageBTestDatabase(process.env);
  if (!readiness.ready) {
    throw new Error(
      "Package B final-manager database isolation verification failed.",
    );
  }

  const scenarioDatabase = readiness.verified.database;
  let bootstrapAssignmentRemoved = false;
  try {
    const currentSnapshot =
      await readBootstrapAdminManagerAssignment(scenarioDatabase);
    if (
      !bootstrapManagerAssignmentSnapshot ||
      currentSnapshot.createdAt.getTime() !==
        bootstrapManagerAssignmentSnapshot.createdAt.getTime() ||
      currentSnapshot.grantedById !==
        bootstrapManagerAssignmentSnapshot.grantedById
    ) {
      throw new Error(
        "Package B bootstrap Test ADMIN snapshot verification failed.",
      );
    }
    await scenarioDatabase.userCapabilityAssignment.delete({
      where: {
        userId_capability: {
          userId: bootstrapAdminId,
          capability: "MANAGE_STAFF_CAPABILITIES",
        },
      },
    });
    bootstrapAssignmentRemoved = true;
    if ((await activeCapabilityManagerCount(scenarioDatabase)) !== 0) {
      throw new Error(
        "Package B final-manager fixture isolation verification failed.",
      );
    }
    return await run(readiness.verified);
  } finally {
    try {
      await scenarioDatabase.userCapabilityAssignment.deleteMany({
        where: {
          userId: { in: [managerAId, managerBId] },
          capability: "MANAGE_STAFF_CAPABILITIES",
        },
      });
      if (bootstrapAssignmentRemoved) {
        await restoreBootstrapAdminManagerAssignment(scenarioDatabase);
      }
    } finally {
      await readiness.verified.close();
    }
  }
}

async function verifyLifecycleAuditRollback(
  context: TestContext,
  operation: "approval" | "disable" | "reactivation",
  status: "PENDING_APPROVAL" | "ACTIVE" | "DISABLED",
  action: "ACCOUNT_APPROVED" | "ACCOUNT_DISABLED" | "ACCOUNT_REACTIVATED",
): Promise<void> {
  const database = databaseOrSkip(context);
  if (!database) return;
  const targetId = targetIds[0];
  await assignCapability(
    database,
    managerAId,
    operation === "reactivation"
      ? "REACTIVATE_STUDENT_ACCOUNTS"
      : "MANAGE_STUDENT_ACCOUNTS",
  );
  await createTarget(database, {
    id: targetId,
    role: "STUDENT",
    status,
    sessionVersion: 11,
  });
  const before = await database.user.findUniqueOrThrow({
    where: { id: targetId },
    select: {
      status: true,
      sessionVersion: true,
      approvedAt: true,
      approvedById: true,
      disabledAt: true,
      disabledById: true,
    },
  });
  const auditBaseline = await auditCount(database, action, targetId);
  const failingDatabase = databaseWithForcedAuditFailure(database);

  const mutation =
    operation === "approval"
      ? approvePendingStudentAsActor(managerAClaims, targetId, failingDatabase)
      : operation === "disable"
        ? disableStudentAsActor(managerAClaims, targetId, failingDatabase)
        : reactivateDisabledStudentAsActor(
            managerAClaims,
            targetId,
            failingDatabase,
          );
  await expect(mutation).rejects.toThrow("Forced audit write failure.");

  await expect(
    database.user.findUniqueOrThrow({
      where: { id: targetId },
      select: {
        status: true,
        sessionVersion: true,
        approvedAt: true,
        approvedById: true,
        disabledAt: true,
        disabledById: true,
      },
    }),
  ).resolves.toEqual(before);
  await expect(auditCount(database, action, targetId)).resolves.toBe(
    auditBaseline,
  );
}

async function verifyFinalManagerProtection(
  context: TestContext,
  operation: "revoke" | "disable" | "role-change",
): Promise<void> {
  await withTrueFinalManagerState(context, async ({ database }) => {
    await assignCapability(database, managerAId, "MANAGE_STAFF_CAPABILITIES");
    if (operation !== "revoke") {
      await assignCapability(database, managerBId, "MANAGE_STAFF_ACCOUNTS");
    }
    await expect(activeCapabilityManagerCount(database)).resolves.toBe(1);

    const result =
      operation === "revoke"
        ? await revokeCapabilityAsActor(
            managerAClaims,
            managerAId,
            "MANAGE_STAFF_CAPABILITIES",
            database,
          )
        : operation === "disable"
          ? await disableStaffAccountAsActor(
              managerBClaims,
              managerAId,
              database,
            )
          : await changeStaffRoleAsActor(
              managerBClaims,
              managerAId,
              "STUDENT",
              database,
            );
    expect(result).toEqual({
      ok: false,
      reason: "LAST_CAPABILITY_MANAGER",
    });
    await expect(activeCapabilityManagerCount(database)).resolves.toBe(1);
    await expect(
      database.user.findUniqueOrThrow({
        where: { id: managerAId },
        select: {
          role: true,
          status: true,
          sessionVersion: true,
        },
      }),
    ).resolves.toEqual({
      role: "STAFF",
      status: "ACTIVE",
      sessionVersion: 0,
    });
  });
}

describe.sequential(
  "Package B PostgreSQL authorization (explicit isolated TEST_DATABASE_URL opt-in)",
  () => {
    beforeAll(async () => {
      if (!hasPackageBTestDatabaseConfiguration(process.env)) return;
      const readiness = await tryOpenPackageBTestDatabase(process.env);
      if (!readiness.ready) return;
      verifiedDatabase = readiness.verified;
      isolatedDb = readiness.verified.database;
      bootstrapManagerAssignmentSnapshot =
        await readBootstrapAdminManagerAssignment(isolatedDb);
      unrelatedStateSnapshot = await readUnrelatedState(isolatedDb);
      await cleanupFixtures();
    });

    beforeEach(resetFixtures);
    afterEach(cleanupFixtures);

    afterAll(async () => {
      try {
        if (isolatedDb) {
          await cleanupFixtures();
          await verifyCanonicalFixtureState();
        }
      } finally {
        await verifiedDatabase?.close();
        verifiedDatabase = undefined;
        isolatedDb = undefined;
        bootstrapManagerAssignmentSnapshot = undefined;
        unrelatedStateSnapshot = undefined;
      }
    });

    it("allows and denies from database assignments only", async (context) => {
      const database = databaseOrSkip(context);
      if (!database) return;
      await assignCapability(database, managerAId, "MANAGE_STUDENT_ACCOUNTS");

      await expect(
        loadCapabilityActor(
          managerAClaims,
          "MANAGE_STUDENT_ACCOUNTS",
          database,
        ),
      ).resolves.toMatchObject({ ok: true, actor: { id: managerAId } });
      await expect(
        loadCapabilityActor(
          managerAClaims,
          "MANAGE_STAFF_CAPABILITIES",
          database,
        ),
      ).resolves.toEqual({ ok: false, reason: "MISSING_CAPABILITY" });
    });

    it("rejects a genuinely stale database session before read or mutation", async (context) => {
      const database = databaseOrSkip(context);
      if (!database) return;
      const targetId = targetIds[0];
      await assignCapability(database, managerAId, "MANAGE_STUDENT_ACCOUNTS");
      await createTarget(database, {
        id: targetId,
        role: "STUDENT",
        status: "PENDING_APPROVAL",
      });
      const current = await database.user.findUniqueOrThrow({
        where: { id: managerAId },
        select: { sessionVersion: true },
      });
      const oldClaims = {
        actorId: managerAId,
        claimedSessionVersion: current.sessionVersion,
      };
      const auditBaseline = await auditCount(
        database,
        "ACCOUNT_APPROVED",
        targetId,
      );

      await database.user.update({
        where: { id: managerAId },
        data: { sessionVersion: { increment: 1 } },
      });

      await expect(
        loadCapabilityActor(oldClaims, "MANAGE_STUDENT_ACCOUNTS", database),
      ).resolves.toEqual({ ok: false, reason: "STALE_SESSION" });
      await expect(
        approvePendingStudentAsActor(oldClaims, targetId, database),
      ).resolves.toEqual({
        ok: false,
        message: "The account transition could not be completed.",
      });
      await expect(
        database.user.findUniqueOrThrow({
          where: { id: targetId },
          select: { status: true, sessionVersion: true },
        }),
      ).resolves.toEqual({
        status: "PENDING_APPROVAL",
        sessionVersion: 0,
      });
      await expect(
        auditCount(database, "ACCOUNT_APPROVED", targetId),
      ).resolves.toBe(auditBaseline);
    });

    it("commits approval, disable, and reactivation with audits and version invalidation", async (context) => {
      const database = databaseOrSkip(context);
      if (!database) return;
      const targetId = targetIds[0];
      await assignCapability(database, managerAId, "MANAGE_STUDENT_ACCOUNTS");
      await assignCapability(
        database,
        managerAId,
        "REACTIVATE_STUDENT_ACCOUNTS",
      );
      await createTarget(database, {
        id: targetId,
        role: "STUDENT",
        status: "PENDING_APPROVAL",
      });
      const lifecycleActions = [
        "ACCOUNT_APPROVED",
        "ACCOUNT_DISABLED",
        "ACCOUNT_REACTIVATED",
      ] as const;
      const auditBaseline = await Promise.all(
        lifecycleActions.map((action) =>
          auditCount(database, action, targetId),
        ),
      );

      await expect(
        approvePendingStudentAsActor(managerAClaims, targetId, database),
      ).resolves.toEqual({ ok: true });
      await expect(
        disableStudentAsActor(managerAClaims, targetId, database),
      ).resolves.toEqual({ ok: true });
      const disabled = await database.user.findUniqueOrThrow({
        where: { id: targetId },
        select: {
          status: true,
          sessionVersion: true,
          disabledAt: true,
          disabledById: true,
        },
      });
      expect(disabled.status).toBe("DISABLED");
      expect(disabled.sessionVersion).toBe(2);
      expect(disabled.disabledAt).not.toBeNull();
      expect(disabled.disabledById).toBe(managerAId);

      await expect(
        reactivateDisabledStudentAsActor(managerAClaims, targetId, database),
      ).resolves.toEqual({ ok: true });
      await expect(
        database.user.findUniqueOrThrow({
          where: { id: targetId },
          select: {
            status: true,
            sessionVersion: true,
            disabledAt: true,
            disabledById: true,
          },
        }),
      ).resolves.toEqual({
        status: "ACTIVE",
        sessionVersion: 3,
        disabledAt: null,
        disabledById: null,
      });
      await expect(
        Promise.all(
          lifecycleActions.map((action) =>
            auditCount(database, action, targetId),
          ),
        ),
      ).resolves.toEqual(auditBaseline.map((count) => count + 1));
    });

    it("rolls back approval after a forced audit failure", async (context) => {
      await verifyLifecycleAuditRollback(
        context,
        "approval",
        "PENDING_APPROVAL",
        "ACCOUNT_APPROVED",
      );
    });

    it("rolls back disable after a forced audit failure", async (context) => {
      await verifyLifecycleAuditRollback(
        context,
        "disable",
        "ACTIVE",
        "ACCOUNT_DISABLED",
      );
    });

    it("rolls back reactivation after a forced audit failure", async (context) => {
      await verifyLifecycleAuditRollback(
        context,
        "reactivation",
        "DISABLED",
        "ACCOUNT_REACTIVATED",
      );
    });

    it("rolls back a capability grant when its audit write fails", async (context) => {
      const database = databaseOrSkip(context);
      if (!database) return;
      const targetId = targetIds[0];
      await assignCapability(database, managerAId, "MANAGE_STAFF_CAPABILITIES");
      await createTarget(database, {
        id: targetId,
        role: "STAFF",
        status: "ACTIVE",
      });
      const auditBaseline = await auditCount(
        database,
        "CAPABILITY_GRANTED",
        `${targetId}:MANAGE_STUDENT_ACCOUNTS`,
      );

      await expect(
        grantCapabilityAsActor(
          managerAClaims,
          targetId,
          "MANAGE_STUDENT_ACCOUNTS",
          databaseWithForcedAuditFailure(database),
        ),
      ).rejects.toThrow("Forced audit write failure.");

      await expect(
        database.userCapabilityAssignment.findUnique({
          where: {
            userId_capability: {
              userId: targetId,
              capability: "MANAGE_STUDENT_ACCOUNTS",
            },
          },
        }),
      ).resolves.toBeNull();
      await expect(
        auditCount(
          database,
          "CAPABILITY_GRANTED",
          `${targetId}:MANAGE_STUDENT_ACCOUNTS`,
        ),
      ).resolves.toBe(auditBaseline);
    });

    it("rejects self-grants plus STUDENT and inactive capability targets", async (context) => {
      const database = databaseOrSkip(context);
      if (!database) return;
      const studentId = targetIds[0];
      const inactiveStaffId = targetIds[1];
      await assignCapability(database, managerAId, "MANAGE_STAFF_CAPABILITIES");
      await createTarget(database, {
        id: studentId,
        role: "STUDENT",
        status: "ACTIVE",
      });
      await createTarget(database, {
        id: inactiveStaffId,
        role: "STAFF",
        status: "DISABLED",
      });

      await expect(
        grantCapabilityAsActor(
          managerAClaims,
          managerAId,
          "VIEW_AUDIT_LOG",
          database,
        ),
      ).resolves.toEqual({ ok: false, reason: "SELF_GRANT" });
      for (const targetId of [studentId, inactiveStaffId]) {
        await expect(
          grantCapabilityAsActor(
            managerAClaims,
            targetId,
            "VIEW_AUDIT_LOG",
            database,
          ),
        ).resolves.toEqual({
          ok: false,
          reason: "TARGET_NOT_ELIGIBLE",
        });
      }
      await expect(
        database.userCapabilityAssignment.count({
          where: {
            userId: { in: [studentId, inactiveStaffId] },
          },
        }),
      ).resolves.toBe(0);
    });

    it("protects the final capability manager from revoke", async (context) => {
      await verifyFinalManagerProtection(context, "revoke");
    });

    it("protects the final capability manager from account disable", async (context) => {
      await verifyFinalManagerProtection(context, "disable");
    });

    it("protects the final capability manager from role change", async (context) => {
      await verifyFinalManagerProtection(context, "role-change");
    });

    it("serializes concurrent final-manager removals on independent PostgreSQL connections", async (context) => {
      await withTrueFinalManagerState(context, async (scenario) => {
        const { database } = scenario;
        await assignCapability(
          database,
          managerAId,
          "MANAGE_STAFF_CAPABILITIES",
        );
        await assignCapability(
          database,
          managerBId,
          "MANAGE_STAFF_CAPABILITIES",
        );
        await expect(activeCapabilityManagerCount(database)).resolves.toBe(2);
        const firstConnection = await scenario.openIndependentConnection();
        const secondConnection = await scenario.openIndependentConnection();
        try {
          const firstAttempt = revokeCapabilityAsActor(
            managerAClaims,
            managerBId,
            "MANAGE_STAFF_CAPABILITIES",
            firstConnection,
          );
          const secondAttempt = revokeCapabilityAsActor(
            managerBClaims,
            managerAId,
            "MANAGE_STAFF_CAPABILITIES",
            secondConnection,
          );
          await Promise.race([firstAttempt, secondAttempt]);
          expect(
            await activeCapabilityManagerCount(database),
          ).toBeGreaterThanOrEqual(1);
          const results = await Promise.all([firstAttempt, secondAttempt]);

          expect(results.filter(({ ok }) => ok)).toHaveLength(1);
          expect(results.filter(({ ok }) => !ok)).toHaveLength(1);
          await expect(activeCapabilityManagerCount(database)).resolves.toBe(1);
        } finally {
          await scenario.closeIndependentConnection(firstConnection);
          await scenario.closeIndependentConnection(secondConnection);
        }
      });
    });
  },
);

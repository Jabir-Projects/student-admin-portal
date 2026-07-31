import "server-only";

import {
  Prisma,
  type PrismaClient,
  type UserRole,
} from "@/generated/prisma/client";
import type { CapabilityValue } from "@/features/auth/constants";
import {
  accountStatusAuditEvent,
  capabilityAuditEvent,
  staffAccountCreatedAuditEvent,
  staffRoleAuditEvent,
} from "@/server/auth/audit-events";
import type {
  ActorSessionClaims,
  AuthorizationFailure,
  CapabilityActor,
  CapabilityAuthorizationResult,
} from "@/server/auth/capabilities";

const staffCapabilityManagerLock = "v2-3:staff-capability-manager";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

type LockedUser = {
  id: string;
  role: UserRole;
  status: "PENDING_APPROVAL" | "ACTIVE" | "DISABLED";
  sessionVersion: number;
};

export type CapabilityMutationFailure =
  | AuthorizationFailure
  | "TARGET_NOT_ELIGIBLE"
  | "SELF_GRANT"
  | "SELF_ACTION"
  | "ASSIGNMENT_EXISTS"
  | "ASSIGNMENT_NOT_FOUND"
  | "LAST_CAPABILITY_MANAGER"
  | "TARGET_HAS_CAPABILITIES"
  | "STALE_TARGET";

export type CapabilityMutationResult =
  { ok: true } | { ok: false; reason: CapabilityMutationFailure };

export type CreateStaffAccountResult =
  { ok: true } | { ok: false; reason: AuthorizationFailure | "EMAIL_IN_USE" };

function validClaimedVersion(value: number | undefined): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isStaffRole(role: UserRole): role is Extract<UserRole, "STAFF"> {
  return role === "STAFF";
}

function authorizeReloadedActor(
  actor: LockedUser | null,
  claims: ActorSessionClaims,
  capabilities: readonly CapabilityValue[],
  requiredCapability: CapabilityValue,
): CapabilityAuthorizationResult {
  if (!actor) return { ok: false, reason: "UNAUTHENTICATED" };
  if (actor.status === "DISABLED")
    return { ok: false, reason: "DISABLED_ACCOUNT" };
  if (actor.status !== "ACTIVE")
    return { ok: false, reason: "INACTIVE_ACCOUNT" };
  if (!isStaffRole(actor.role)) return { ok: false, reason: "WRONG_ROLE" };
  if (
    !validClaimedVersion(claims.claimedSessionVersion) ||
    actor.sessionVersion !== claims.claimedSessionVersion
  ) {
    return { ok: false, reason: "STALE_SESSION" };
  }
  if (!capabilities.includes(requiredCapability))
    return { ok: false, reason: "MISSING_CAPABILITY" };

  return {
    ok: true,
    actor: {
      id: actor.id,
      role: actor.role,
      status: "ACTIVE",
      sessionVersion: actor.sessionVersion,
      capabilities,
    },
  };
}

export async function loadCapabilityActor(
  claims: ActorSessionClaims,
  requiredCapability: CapabilityValue,
  database: PrismaClient,
): Promise<CapabilityAuthorizationResult> {
  if (!claims.actorId) return { ok: false, reason: "UNAUTHENTICATED" };
  const actor = await database.user.findUnique({
    where: { id: claims.actorId },
    select: {
      id: true,
      role: true,
      status: true,
      sessionVersion: true,
      capabilityAssignments: { select: { capability: true } },
    },
  });
  return authorizeReloadedActor(
    actor,
    claims,
    actor?.capabilityAssignments.map(({ capability }) => capability) ?? [],
    requiredCapability,
  );
}

export async function lockUserForUpdate(
  transaction: Prisma.TransactionClient,
  userId: string,
): Promise<LockedUser | null> {
  if (!uuidPattern.test(userId)) return null;
  const rows = await transaction.$queryRaw<LockedUser[]>(Prisma.sql`
    SELECT
      "id"::text AS "id",
      "role",
      "status",
      "sessionVersion"
    FROM "User"
    WHERE "id" = CAST(${userId} AS UUID)
    FOR UPDATE
  `);
  return rows[0] ?? null;
}

export async function revalidateCapabilityActorInTransaction(
  transaction: Prisma.TransactionClient,
  claims: ActorSessionClaims,
  requiredCapability: CapabilityValue,
): Promise<CapabilityAuthorizationResult> {
  if (!claims.actorId) return { ok: false, reason: "UNAUTHENTICATED" };
  const actor = await lockUserForUpdate(transaction, claims.actorId);
  const capabilities = actor
    ? (
        await transaction.userCapabilityAssignment.findMany({
          where: { userId: actor.id },
          select: { capability: true },
        })
      ).map(({ capability }) => capability)
    : [];
  return authorizeReloadedActor(
    actor,
    claims,
    capabilities,
    requiredCapability,
  );
}

async function lockStaffCapabilityManagerInvariant(
  transaction: Prisma.TransactionClient,
): Promise<void> {
  await transaction.$queryRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${staffCapabilityManagerLock}, 0::bigint)
    )::text AS "lock"
  `);
}

async function targetIsFinalActiveCapabilityManager(
  transaction: Prisma.TransactionClient,
  targetUserId: string,
): Promise<boolean> {
  const assignment = await transaction.userCapabilityAssignment.findUnique({
    where: {
      userId_capability: {
        userId: targetUserId,
        capability: "MANAGE_STAFF_CAPABILITIES",
      },
    },
    select: { userId: true },
  });
  if (!assignment) return false;

  const rows = await transaction.$queryRaw<Array<{ count: bigint }>>(
    Prisma.sql`
      SELECT count(*)::bigint AS "count"
      FROM "UserCapabilityAssignment" assignment
      JOIN "User" subject ON subject."id" = assignment."userId"
      WHERE assignment."capability" = 'MANAGE_STAFF_CAPABILITIES'
        AND subject."status" = 'ACTIVE'
        AND subject."role" = 'STAFF'
    `,
  );
  return (rows[0]?.count ?? BigInt(0)) <= BigInt(1);
}

async function lockEligibleCapabilityTarget(
  transaction: Prisma.TransactionClient,
  targetUserId: string,
): Promise<LockedUser | null> {
  const target = await lockUserForUpdate(transaction, targetUserId);
  if (!target || target.status !== "ACTIVE" || !isStaffRole(target.role)) {
    return null;
  }
  return target;
}

export async function grantCapabilityAsActor(
  claims: ActorSessionClaims,
  targetUserId: string,
  capability: CapabilityValue,
  database: PrismaClient,
): Promise<CapabilityMutationResult> {
  try {
    return await database.$transaction(async (transaction) => {
      const authorization = await revalidateCapabilityActorInTransaction(
        transaction,
        claims,
        "MANAGE_STAFF_CAPABILITIES",
      );
      if (!authorization.ok) return authorization;
      if (authorization.actor.id === targetUserId)
        return { ok: false, reason: "SELF_GRANT" };

      const target = await lockEligibleCapabilityTarget(
        transaction,
        targetUserId,
      );
      if (!target) return { ok: false, reason: "TARGET_NOT_ELIGIBLE" };

      const existing = await transaction.userCapabilityAssignment.findUnique({
        where: {
          userId_capability: { userId: target.id, capability },
        },
        select: { userId: true },
      });
      if (existing) return { ok: false, reason: "ASSIGNMENT_EXISTS" };

      await transaction.userCapabilityAssignment.create({
        data: {
          userId: target.id,
          capability,
          grantedById: authorization.actor.id,
        },
      });
      await transaction.auditLog.create({
        data: capabilityAuditEvent({
          actorId: authorization.actor.id,
          targetUserId: target.id,
          action: "CAPABILITY_GRANTED",
          capability,
        }),
      });
      return { ok: true };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, reason: "ASSIGNMENT_EXISTS" };
    }
    throw error;
  }
}

export async function revokeCapabilityAsActor(
  claims: ActorSessionClaims,
  targetUserId: string,
  capability: CapabilityValue,
  database: PrismaClient,
): Promise<CapabilityMutationResult> {
  return database.$transaction(async (transaction) => {
    await lockStaffCapabilityManagerInvariant(transaction);
    const authorization = await revalidateCapabilityActorInTransaction(
      transaction,
      claims,
      "MANAGE_STAFF_CAPABILITIES",
    );
    if (!authorization.ok) return authorization;
    if (authorization.actor.id === targetUserId)
      return { ok: false, reason: "SELF_ACTION" };

    const target = await lockEligibleCapabilityTarget(
      transaction,
      targetUserId,
    );
    if (!target) return { ok: false, reason: "TARGET_NOT_ELIGIBLE" };
    if (
      capability === "MANAGE_STAFF_CAPABILITIES" &&
      (await targetIsFinalActiveCapabilityManager(transaction, target.id))
    ) {
      return { ok: false, reason: "LAST_CAPABILITY_MANAGER" };
    }

    const removed = await transaction.userCapabilityAssignment.deleteMany({
      where: { userId: target.id, capability },
    });
    if (removed.count !== 1)
      return { ok: false, reason: "ASSIGNMENT_NOT_FOUND" };

    await transaction.auditLog.create({
      data: capabilityAuditEvent({
        actorId: authorization.actor.id,
        targetUserId: target.id,
        action: "CAPABILITY_REVOKED",
        capability,
      }),
    });
    return { ok: true };
  });
}

export async function disableStaffAccountAsActor(
  claims: ActorSessionClaims,
  targetUserId: string,
  database: PrismaClient,
): Promise<CapabilityMutationResult> {
  return database.$transaction(async (transaction) => {
    await lockStaffCapabilityManagerInvariant(transaction);
    const authorization = await revalidateCapabilityActorInTransaction(
      transaction,
      claims,
      "MANAGE_STAFF_ACCOUNTS",
    );
    if (!authorization.ok) return authorization;
    if (authorization.actor.role !== "STAFF")
      return { ok: false, reason: "WRONG_ROLE" };
    if (authorization.actor.id === targetUserId)
      return { ok: false, reason: "SELF_ACTION" };

    const target = await lockEligibleCapabilityTarget(
      transaction,
      targetUserId,
    );
    if (!target || target.role !== "STAFF")
      return { ok: false, reason: "TARGET_NOT_ELIGIBLE" };
    if (await targetIsFinalActiveCapabilityManager(transaction, target.id))
      return { ok: false, reason: "LAST_CAPABILITY_MANAGER" };

    const changed = await transaction.user.updateMany({
      where: {
        id: target.id,
        role: target.role,
        status: "ACTIVE",
        sessionVersion: target.sessionVersion,
      },
      data: {
        status: "DISABLED",
        disabledAt: new Date(),
        disabledById: authorization.actor.id,
        sessionVersion: { increment: 1 },
      },
    });
    if (changed.count !== 1) return { ok: false, reason: "STALE_TARGET" };

    await transaction.auditLog.create({
      data: accountStatusAuditEvent({
        actorId: authorization.actor.id,
        action: "ACCOUNT_DISABLED",
        targetUserId: target.id,
        previousStatus: "ACTIVE",
        newStatus: "DISABLED",
      }),
    });
    return { ok: true };
  });
}

export async function reactivateStaffAccountAsActor(
  claims: ActorSessionClaims,
  targetUserId: string,
  database: PrismaClient,
): Promise<CapabilityMutationResult> {
  return database.$transaction(async (transaction) => {
    await lockStaffCapabilityManagerInvariant(transaction);
    const authorization = await revalidateCapabilityActorInTransaction(
      transaction,
      claims,
      "MANAGE_STAFF_ACCOUNTS",
    );
    if (!authorization.ok) return authorization;
    if (authorization.actor.role !== "STAFF")
      return { ok: false, reason: "WRONG_ROLE" };

    const target = await lockUserForUpdate(transaction, targetUserId);
    if (!target || target.role !== "STAFF" || target.status !== "DISABLED") {
      return { ok: false, reason: "TARGET_NOT_ELIGIBLE" };
    }

    const changed = await transaction.user.updateMany({
      where: {
        id: target.id,
        role: "STAFF",
        status: "DISABLED",
        sessionVersion: target.sessionVersion,
      },
      data: {
        status: "ACTIVE",
        disabledAt: null,
        disabledById: null,
        sessionVersion: { increment: 1 },
      },
    });
    if (changed.count !== 1) return { ok: false, reason: "STALE_TARGET" };

    await transaction.auditLog.create({
      data: accountStatusAuditEvent({
        actorId: authorization.actor.id,
        action: "ACCOUNT_REACTIVATED",
        targetUserId: target.id,
        previousStatus: "DISABLED",
        newStatus: "ACTIVE",
      }),
    });
    return { ok: true };
  });
}

export async function createStaffAccountAsActor(
  claims: ActorSessionClaims,
  input: {
    email: string;
    fullName: string;
    passwordHash: string;
    capabilities: readonly CapabilityValue[];
  },
  database: PrismaClient,
): Promise<CreateStaffAccountResult> {
  try {
    return await database.$transaction(async (transaction) => {
      const authorization = await revalidateCapabilityActorInTransaction(
        transaction,
        claims,
        "MANAGE_STAFF_ACCOUNTS",
      );
      if (!authorization.ok) return authorization;
      if (authorization.actor.role !== "STAFF")
        return { ok: false, reason: "WRONG_ROLE" };

      if (input.capabilities.length > 0) {
        const capabilityAuthorization =
          await revalidateCapabilityActorInTransaction(
            transaction,
            claims,
            "MANAGE_STAFF_CAPABILITIES",
          );
        if (!capabilityAuthorization.ok) return capabilityAuthorization;
      }

      const target = await transaction.user.create({
        data: {
          email: input.email,
          fullName: input.fullName,
          passwordHash: input.passwordHash,
          role: "STAFF",
          status: "ACTIVE",
          approvedAt: new Date(),
          approvedById: authorization.actor.id,
          capabilityAssignments:
            input.capabilities.length === 0
              ? undefined
              : {
                  create: input.capabilities.map((capability) => ({
                    capability,
                    grantedById: authorization.actor.id,
                  })),
                },
        },
        select: { id: true },
      });

      await transaction.auditLog.create({
        data: staffAccountCreatedAuditEvent({
          actorId: authorization.actor.id,
          targetUserId: target.id,
          initialCapabilityCount: input.capabilities.length,
        }),
      });
      for (const capability of input.capabilities) {
        await transaction.auditLog.create({
          data: capabilityAuditEvent({
            actorId: authorization.actor.id,
            targetUserId: target.id,
            action: "CAPABILITY_GRANTED",
            capability,
          }),
        });
      }
      return { ok: true };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, reason: "EMAIL_IN_USE" };
    }
    throw error;
  }
}

export async function changeStaffRoleAsActor(
  claims: ActorSessionClaims,
  targetUserId: string,
  newRole: UserRole,
  database: PrismaClient,
): Promise<CapabilityMutationResult> {
  return database.$transaction(async (transaction) => {
    await lockStaffCapabilityManagerInvariant(transaction);
    const authorization = await revalidateCapabilityActorInTransaction(
      transaction,
      claims,
      "MANAGE_STAFF_ACCOUNTS",
    );
    if (!authorization.ok) return authorization;
    if (authorization.actor.id === targetUserId)
      return { ok: false, reason: "SELF_ACTION" };

    const target = await lockEligibleCapabilityTarget(
      transaction,
      targetUserId,
    );
    if (!target || target.role === newRole)
      return { ok: false, reason: "TARGET_NOT_ELIGIBLE" };

    const leavesStaffAuthorization = newRole !== "STAFF";
    if (
      leavesStaffAuthorization &&
      (await targetIsFinalActiveCapabilityManager(transaction, target.id))
    ) {
      return { ok: false, reason: "LAST_CAPABILITY_MANAGER" };
    }

    if (leavesStaffAuthorization) {
      const assignedCapabilityCount =
        await transaction.userCapabilityAssignment.count({
          where: { userId: target.id },
        });
      if (assignedCapabilityCount !== 0)
        return { ok: false, reason: "TARGET_HAS_CAPABILITIES" };
    }
    const changed = await transaction.user.updateMany({
      where: {
        id: target.id,
        role: target.role,
        status: "ACTIVE",
        sessionVersion: target.sessionVersion,
      },
      data: {
        role: newRole,
        sessionVersion: { increment: 1 },
      },
    });
    if (changed.count !== 1) return { ok: false, reason: "STALE_TARGET" };

    await transaction.auditLog.create({
      data: staffRoleAuditEvent({
        actorId: authorization.actor.id,
        targetUserId: target.id,
        previousRole: target.role,
        newRole,
        removedCapabilityCount: 0,
      }),
    });
    return { ok: true };
  });
}

export type { CapabilityActor };

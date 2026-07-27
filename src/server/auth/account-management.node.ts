import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  accountStatusAuditEvent,
  type AuthorizationAuditAction,
} from "@/server/auth/audit-events";
import type { ActorSessionClaims } from "@/server/auth/capabilities";
import {
  lockUserForUpdate,
  revalidateCapabilityActorInTransaction,
} from "@/server/auth/capabilities.node";

export type AccountTransitionResult =
  { ok: true } | { ok: false; message: string };

type StudentStatus = "PENDING_APPROVAL" | "ACTIVE" | "DISABLED";

const genericTransitionFailure = {
  ok: false,
  message: "The account transition could not be completed.",
} as const;

function transitionFailure(message: string): AccountTransitionResult {
  return { ok: false, message };
}

async function writeStatusAudit(
  transaction: Prisma.TransactionClient,
  input: {
    actorId: string;
    targetUserId: string;
    action: Extract<
      AuthorizationAuditAction,
      "ACCOUNT_APPROVED" | "ACCOUNT_DISABLED" | "ACCOUNT_REACTIVATED"
    >;
    previousStatus: StudentStatus;
    newStatus: StudentStatus;
  },
): Promise<void> {
  await transaction.auditLog.create({
    data: accountStatusAuditEvent(input),
  });
}

export async function approvePendingStudentAsActor(
  claims: ActorSessionClaims,
  targetUserId: string,
  database: PrismaClient,
): Promise<AccountTransitionResult> {
  return database.$transaction(async (transaction) => {
    const authorization = await revalidateCapabilityActorInTransaction(
      transaction,
      claims,
      "MANAGE_STUDENT_ACCOUNTS",
    );
    if (!authorization.ok) return genericTransitionFailure;

    const target = await lockUserForUpdate(transaction, targetUserId);
    if (!target || target.role !== "STUDENT") return genericTransitionFailure;
    if (target.status !== "PENDING_APPROVAL")
      return transitionFailure("The account is no longer pending approval.");

    const changed = await transaction.user.updateMany({
      where: {
        id: target.id,
        role: "STUDENT",
        status: "PENDING_APPROVAL",
        sessionVersion: target.sessionVersion,
      },
      data: {
        status: "ACTIVE",
        approvedAt: new Date(),
        approvedById: authorization.actor.id,
        sessionVersion: { increment: 1 },
      },
    });
    if (changed.count !== 1)
      return transitionFailure(
        "The account status changed. Refresh and retry.",
      );

    await writeStatusAudit(transaction, {
      actorId: authorization.actor.id,
      targetUserId: target.id,
      action: "ACCOUNT_APPROVED",
      previousStatus: "PENDING_APPROVAL",
      newStatus: "ACTIVE",
    });
    return { ok: true };
  });
}

async function disableAuthorizedStudentInTransaction(
  transaction: Prisma.TransactionClient,
  actorId: string,
  targetUserId: string,
): Promise<AccountTransitionResult> {
  const target = await lockUserForUpdate(transaction, targetUserId);
  if (
    !target ||
    target.role !== "STUDENT" ||
    (target.status !== "PENDING_APPROVAL" && target.status !== "ACTIVE")
  ) {
    return transitionFailure("The account cannot be disabled.");
  }

  const changed = await transaction.user.updateMany({
    where: {
      id: target.id,
      role: "STUDENT",
      status: target.status,
      sessionVersion: target.sessionVersion,
    },
    data: {
      status: "DISABLED",
      disabledAt: new Date(),
      disabledById: actorId,
      sessionVersion: { increment: 1 },
    },
  });
  if (changed.count !== 1)
    return transitionFailure("The account status changed. Refresh and retry.");

  await writeStatusAudit(transaction, {
    actorId,
    targetUserId: target.id,
    action: "ACCOUNT_DISABLED",
    previousStatus: target.status,
    newStatus: "DISABLED",
  });
  return { ok: true };
}

export async function disableStudentAsActor(
  claims: ActorSessionClaims,
  targetUserId: string,
  database: PrismaClient,
): Promise<AccountTransitionResult> {
  return database.$transaction(async (transaction) => {
    const authorization = await revalidateCapabilityActorInTransaction(
      transaction,
      claims,
      "MANAGE_STUDENT_ACCOUNTS",
    );
    if (!authorization.ok) return genericTransitionFailure;
    return disableAuthorizedStudentInTransaction(
      transaction,
      authorization.actor.id,
      targetUserId,
    );
  });
}

export async function disableStudentByEmailAsActor(
  claims: ActorSessionClaims,
  normalizedEmail: string,
  database: PrismaClient,
): Promise<AccountTransitionResult> {
  return database.$transaction(async (transaction) => {
    const authorization = await revalidateCapabilityActorInTransaction(
      transaction,
      claims,
      "MANAGE_STUDENT_ACCOUNTS",
    );
    if (!authorization.ok) return genericTransitionFailure;
    const target = await transaction.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (!target) return transitionFailure("The account cannot be disabled.");
    return disableAuthorizedStudentInTransaction(
      transaction,
      authorization.actor.id,
      target.id,
    );
  });
}

export async function reactivateDisabledStudentAsActor(
  claims: ActorSessionClaims,
  targetUserId: string,
  database: PrismaClient,
): Promise<AccountTransitionResult> {
  return database.$transaction(async (transaction) => {
    const authorization = await revalidateCapabilityActorInTransaction(
      transaction,
      claims,
      "REACTIVATE_STUDENT_ACCOUNTS",
    );
    if (!authorization.ok) return genericTransitionFailure;

    const target = await lockUserForUpdate(transaction, targetUserId);
    if (!target || target.role !== "STUDENT" || target.status !== "DISABLED") {
      return transitionFailure("The account cannot be reactivated.");
    }

    const changed = await transaction.user.updateMany({
      where: {
        id: target.id,
        role: "STUDENT",
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
    if (changed.count !== 1)
      return transitionFailure(
        "The account status changed. Refresh and retry.",
      );

    await writeStatusAudit(transaction, {
      actorId: authorization.actor.id,
      targetUserId: target.id,
      action: "ACCOUNT_REACTIVATED",
      previousStatus: "DISABLED",
      newStatus: "ACTIVE",
    });
    return { ok: true };
  });
}

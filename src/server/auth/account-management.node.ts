import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";

export type AccountTransitionResult =
  { ok: true } | { ok: false; message: string };

export async function approvePendingStudentAsActor(
  actorId: string,
  targetUserId: string,
  database: PrismaClient,
): Promise<AccountTransitionResult> {
  return database.$transaction(async (transaction) => {
    const changed = await transaction.user.updateMany({
      where: { id: targetUserId, role: "STUDENT", status: "PENDING_APPROVAL" },
      data: { status: "ACTIVE", approvedAt: new Date(), approvedById: actorId },
    });
    if (changed.count !== 1)
      return {
        ok: false,
        message: "The account is no longer pending approval.",
      };
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "ACCOUNT_APPROVED",
        entityType: "User",
        entityId: targetUserId,
        metadata: { previousStatus: "PENDING_APPROVAL", newStatus: "ACTIVE" },
      },
    });
    return { ok: true };
  });
}

export async function disableStudentAsActor(
  actorId: string,
  targetUserId: string,
  database: PrismaClient,
): Promise<AccountTransitionResult> {
  return database.$transaction(async (transaction) => {
    const target = await transaction.user.findFirst({
      where: {
        id: targetUserId,
        role: "STUDENT",
        status: { in: ["PENDING_APPROVAL", "ACTIVE"] },
      },
      select: { status: true },
    });
    if (!target)
      return { ok: false, message: "The account cannot be disabled." };
    const changed = await transaction.user.updateMany({
      where: { id: targetUserId, role: "STUDENT", status: target.status },
      data: {
        status: "DISABLED",
        disabledAt: new Date(),
        disabledById: actorId,
      },
    });
    if (changed.count !== 1)
      return {
        ok: false,
        message: "The account status changed. Refresh and retry.",
      };
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "ACCOUNT_DISABLED",
        entityType: "User",
        entityId: targetUserId,
        metadata: { previousStatus: target.status, newStatus: "DISABLED" },
      },
    });
    return { ok: true };
  });
}

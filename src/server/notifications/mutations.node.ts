import "server-only";

import {
  Prisma,
  type PrismaClient,
  type UserRole,
} from "@/generated/prisma/client";
import { notificationReadInputSchema } from "@/features/notifications/schemas";
import type {
  ActorSessionClaims,
  AuthorizationFailure,
} from "@/server/auth/capabilities";

type MutationResult =
  | { ok: true; changed: number }
  | { ok: false; reason: AuthorizationFailure | "INVALID_INPUT" | "NOT_FOUND" };
type LockedActor = {
  id: string;
  role: UserRole;
  status: "PENDING_APPROVAL" | "ACTIVE" | "DISABLED";
  sessionVersion: number;
};

async function revalidateActor(
  transaction: Prisma.TransactionClient,
  claims: ActorSessionClaims,
  requiredRole: UserRole,
) {
  if (!claims.actorId) return { ok: false, reason: "UNAUTHENTICATED" } as const;
  const rows = await transaction.$queryRaw<LockedActor[]>(Prisma.sql`
    SELECT "id"::text AS "id", "role", "status", "sessionVersion"
    FROM "User" WHERE "id" = CAST(${claims.actorId} AS UUID) FOR UPDATE
  `);
  const actor = rows[0];
  if (!actor) return { ok: false, reason: "UNAUTHENTICATED" } as const;
  if (actor.status === "DISABLED")
    return { ok: false, reason: "DISABLED_ACCOUNT" } as const;
  if (actor.status !== "ACTIVE")
    return { ok: false, reason: "INACTIVE_ACCOUNT" } as const;
  if (actor.role !== requiredRole)
    return { ok: false, reason: "WRONG_ROLE" } as const;
  if (
    !Number.isSafeInteger(claims.claimedSessionVersion) ||
    actor.sessionVersion !== claims.claimedSessionVersion
  )
    return { ok: false, reason: "STALE_SESSION" } as const;
  return { ok: true, actor } as const;
}

export async function markOwnedNotificationRead(
  claims: ActorSessionClaims,
  role: UserRole,
  input: unknown,
  database: PrismaClient,
): Promise<MutationResult> {
  const parsed = notificationReadInputSchema.safeParse(input);
  if (!parsed.success || (role !== "STUDENT" && role !== "STAFF"))
    return { ok: false, reason: "INVALID_INPUT" };
  return database.$transaction(async (transaction) => {
    const authorization = await revalidateActor(transaction, claims, role);
    if (!authorization.ok) return authorization;
    const exists = await transaction.notification.findFirst({
      where: { id: parsed.data.notificationId, userId: authorization.actor.id },
      select: { id: true, readAt: true },
    });
    if (!exists) return { ok: false, reason: "NOT_FOUND" } as const;
    if (exists.readAt) return { ok: true, changed: 0 } as const;
    const changed = await transaction.notification.updateMany({
      where: { id: exists.id, userId: authorization.actor.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true, changed: changed.count } as const;
  });
}

export async function markAllOwnedNotificationsRead(
  claims: ActorSessionClaims,
  role: UserRole,
  database: PrismaClient,
): Promise<MutationResult> {
  if (role !== "STUDENT" && role !== "STAFF")
    return { ok: false, reason: "INVALID_INPUT" };
  return database.$transaction(async (transaction) => {
    const authorization = await revalidateActor(transaction, claims, role);
    if (!authorization.ok) return authorization;
    const changed = await transaction.notification.updateMany({
      where: { userId: authorization.actor.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true, changed: changed.count } as const;
  });
}

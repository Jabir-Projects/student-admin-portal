import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  auditListQuerySchema,
  notificationListQuerySchema,
  type AuditListQuery,
} from "@/features/notifications/schemas";
import type { ActorSessionClaims } from "@/server/auth/capabilities";
import { loadCapabilityActor } from "@/server/auth/capabilities.node";
import { getStaffShellUserByClaims } from "@/server/auth/dal.node";
import { authorizeStudentActor } from "@/server/student-portal/authorization.node";

type PortalRole = "STUDENT" | "STAFF";

async function authorizeNotificationActor(
  claims: ActorSessionClaims,
  role: PortalRole,
  database: PrismaClient,
) {
  if (role === "STUDENT") return authorizeStudentActor(claims, database);
  return getStaffShellUserByClaims(claims, database);
}

export async function listOwnedNotifications(
  claims: ActorSessionClaims,
  role: PortalRole,
  input: unknown,
  database: PrismaClient,
) {
  const parsed = notificationListQuerySchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "INVALID_INPUT" } as const;
  const authorization = await authorizeNotificationActor(
    claims,
    role,
    database,
  );
  if (!authorization.ok) return authorization;
  const actor =
    "actor" in authorization ? authorization.actor : authorization.user;
  const where = { userId: actor.id };
  const [total, unread, notifications] = await Promise.all([
    database.notification.count({ where }),
    database.notification.count({ where: { ...where, readAt: null } }),
    database.notification.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (parsed.data.page - 1) * 25,
      take: 25,
      select: {
        id: true,
        title: true,
        body: true,
        eventType: true,
        readAt: true,
        createdAt: true,
        requestId: true,
      },
    }),
  ]);
  return {
    ok: true as const,
    notifications,
    total,
    unread,
    page: parsed.data.page,
    pageCount: Math.max(1, Math.ceil(total / 25)),
  };
}

const allowedMetadata = new Set([
  "previousStatus",
  "newStatus",
  "status",
  "copyCount",
  "deliveryMethod",
  "visibility",
  "active",
  "nameChanged",
  "descriptionChanged",
  "initialCapabilityCount",
  "capability",
  "removedCapabilityCount",
  "previousRole",
  "newRole",
  "hasInternalNote",
  "hasPublicMessage",
  "exportedRows",
  "filtersApplied",
]);

export function sanitizeAuditMetadata(
  metadata: Prisma.JsonValue,
): Array<{ label: string; value: string }> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata))
    return [];
  const result: Array<{ label: string; value: string }> = [];
  for (const [key, value] of Object.entries(metadata)) {
    if (
      !allowedMetadata.has(key) ||
      !["string", "number", "boolean"].includes(typeof value)
    )
      continue;
    result.push({
      label: key.replace(/([A-Z])/gu, " $1").toLowerCase(),
      value: String(value).slice(0, 120),
    });
  }
  return result;
}

function auditWhere(query: AuditListQuery): Prisma.AuditLogWhereInput {
  const nextDay = query.dateTo
    ? new Date(`${query.dateTo}T00:00:00.000Z`)
    : undefined;
  if (nextDay) nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return {
    ...(query.action
      ? { action: { equals: query.action, mode: Prisma.QueryMode.insensitive } }
      : {}),
    ...(query.entityType
      ? {
          entityType: {
            equals: query.entityType,
            mode: Prisma.QueryMode.insensitive,
          },
        }
      : {}),
    ...(query.actor
      ? {
          actor: {
            is: {
              fullName: {
                contains: query.actor,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          },
        }
      : {}),
    ...(query.dateFrom || nextDay
      ? {
          createdAt: {
            ...(query.dateFrom
              ? { gte: new Date(`${query.dateFrom}T00:00:00.000Z`) }
              : {}),
            ...(nextDay ? { lt: nextDay } : {}),
          },
        }
      : {}),
  };
}

export async function listAuditLog(
  claims: ActorSessionClaims,
  input: unknown,
  database: PrismaClient,
) {
  const parsed = auditListQuerySchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "INVALID_INPUT" } as const;
  const authorization = await loadCapabilityActor(
    claims,
    "VIEW_AUDIT_LOG",
    database,
  );
  if (!authorization.ok) return authorization;
  const where = auditWhere(parsed.data);
  const [total, rows, actions, entityTypes] = await Promise.all([
    database.auditLog.count({ where }),
    database.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (parsed.data.page - 1) * parsed.data.pageSize,
      take: parsed.data.pageSize,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
        actor: { select: { fullName: true } },
      },
    }),
    database.auditLog.findMany({
      distinct: ["action"],
      orderBy: { action: "asc" },
      select: { action: true },
    }),
    database.auditLog.findMany({
      distinct: ["entityType"],
      orderBy: { entityType: "asc" },
      select: { entityType: true },
    }),
  ]);
  return {
    ok: true as const,
    query: parsed.data,
    total,
    page: parsed.data.page,
    pageCount: Math.max(1, Math.ceil(total / parsed.data.pageSize)),
    actions: actions.map(({ action }) => action),
    entityTypes: entityTypes.map(({ entityType }) => entityType),
    rows: rows.map(({ metadata, ...row }) => ({
      ...row,
      metadata: sanitizeAuditMetadata(metadata),
    })),
  };
}

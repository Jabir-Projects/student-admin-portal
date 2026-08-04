import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  ACTIVE_REQUEST_STATUSES,
  cancelRequestInputSchema,
  TERMINAL_REQUEST_STATUSES,
  type RequestStatusValue,
} from "@/features/student-portal/schemas";
import type { ActorSessionClaims } from "@/server/auth/capabilities";
import {
  authorizeStudentActor,
  type StudentAuthorizationResult,
} from "@/server/student-portal/authorization.node";

export type StudentReadFailure = Extract<
  StudentAuthorizationResult,
  { ok: false }
>;

export async function getStudentDashboard(
  claims: ActorSessionClaims,
  database: PrismaClient,
) {
  const authorization = await authorizeStudentActor(claims, database);
  if (!authorization.ok) return authorization;
  const [counts, recent] = await Promise.all([
    database.documentRequest.groupBy({
      by: ["status"],
      where: { studentId: authorization.actor.profileId },
      _count: { _all: true },
    }),
    database.documentRequest.findMany({
      where: { studentId: authorization.actor.profileId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5,
      select: {
        id: true,
        status: true,
        createdAt: true,
        category: { select: { name: true } },
      },
    }),
  ]);
  const countByStatus = new Map(
    counts.map((entry) => [entry.status, entry._count._all]),
  );
  const sum = (statuses: readonly RequestStatusValue[]) =>
    statuses.reduce(
      (total, status) => total + (countByStatus.get(status) ?? 0),
      0,
    );
  const total = counts.reduce((value, entry) => value + entry._count._all, 0);
  return {
    ok: true as const,
    actor: authorization.actor,
    summary: {
      total,
      active: sum(ACTIVE_REQUEST_STATUSES),
      closed: sum(TERMINAL_REQUEST_STATUSES),
    },
    recent,
  };
}

export async function getStudentProfile(
  claims: ActorSessionClaims,
  database: PrismaClient,
) {
  return authorizeStudentActor(claims, database);
}

export async function listAvailableRequestCategories(
  claims: ActorSessionClaims,
  database: PrismaClient,
) {
  const authorization = await authorizeStudentActor(claims, database);
  if (!authorization.ok) return authorization;
  return {
    ok: true as const,
    categories: await database.requestCategory.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true, description: true },
    }),
  };
}

export async function listOwnedRequests(
  claims: ActorSessionClaims,
  query: { page: number; status?: RequestStatusValue },
  database: PrismaClient,
) {
  const authorization = await authorizeStudentActor(claims, database);
  if (!authorization.ok) return authorization;
  const where = {
    studentId: authorization.actor.profileId,
    ...(query.status ? { status: query.status } : {}),
  };
  const [total, requests] = await Promise.all([
    database.documentRequest.count({ where }),
    database.documentRequest.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * 10,
      take: 10,
      select: {
        id: true,
        status: true,
        copyCount: true,
        deliveryMethod: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { name: true } },
      },
    }),
  ]);
  return {
    ok: true as const,
    requests,
    page: query.page,
    pageCount: Math.max(1, Math.ceil(total / 10)),
    total,
  };
}

export async function getOwnedRequestDetails(
  claims: ActorSessionClaims,
  requestId: string,
  database: PrismaClient,
) {
  const authorization = await authorizeStudentActor(claims, database);
  if (!authorization.ok) return authorization;
  if (!cancelRequestInputSchema.safeParse({ requestId }).success) {
    return { ok: true as const, request: null };
  }
  const request = await database.documentRequest.findFirst({
    where: { id: requestId, studentId: authorization.actor.profileId },
    select: {
      id: true,
      referenceNumber: true,
      status: true,
      copyCount: true,
      details: true,
      deliveryMethod: true,
      createdAt: true,
      updatedAt: true,
      category: { select: { name: true } },
      statusHistory: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, fromStatus: true, toStatus: true, createdAt: true },
      },
      messages: {
        where: { visibility: "PUBLIC" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, body: true, createdAt: true },
      },
      documentArtifacts: {
        where: { status: { in: ["RELEASED", "REVOKED"] } },
        orderBy: [{ version: "desc" }],
        select: { id: true, status: true, version: true },
      },
    },
  });
  if (!request) return { ok: true as const, request: null };
  const timeline = [
    ...request.statusHistory.map((event) => ({
      id: event.id,
      kind: "status" as const,
      createdAt: event.createdAt,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
    })),
    ...request.messages.map((message) => ({
      id: message.id,
      kind: "message" as const,
      createdAt: message.createdAt,
      body: message.body,
    })),
  ].sort(
    (left, right) =>
      left.createdAt.getTime() - right.createdAt.getTime() ||
      left.id.localeCompare(right.id),
  );
  return {
    ok: true as const,
    request: {
      ...request,
      statusHistory: undefined,
      messages: undefined,
      timeline,
    },
  };
}

import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  requestQueueQuerySchema,
  type RequestQueueQuery,
} from "@/features/administration/schemas";
import type {
  ActorSessionClaims,
  AuthorizationFailure,
} from "@/server/auth/capabilities";
import { loadCapabilityActor } from "@/server/auth/capabilities.node";

export type AdministrationReadFailure = {
  ok: false;
  reason: AuthorizationFailure | "INVALID_INPUT";
};

export function buildRequestWhere(
  query: Omit<RequestQueueQuery, "page">,
): Prisma.DocumentRequestWhereInput {
  return {
    ...(query.status ? { status: query.status } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.reference
      ? {
          referenceNumber: {
            contains: query.reference,
            mode: Prisma.QueryMode.insensitive,
          },
        }
      : {}),
    ...(query.student
      ? {
          student: {
            is: {
              OR: [
                {
                  studentNumber: {
                    contains: query.student,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
                {
                  user: {
                    is: {
                      fullName: {
                        contains: query.student,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                  },
                },
              ],
            },
          },
        }
      : {}),
  };
}

export async function getRequestDashboardCounts(
  claims: ActorSessionClaims,
  database: PrismaClient,
) {
  const authorization = await loadCapabilityActor(
    claims,
    "PROCESS_REQUESTS",
    database,
  );
  if (!authorization.ok) return authorization;
  const grouped = await database.documentRequest.groupBy({
    by: ["status"],
    where: {
      status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "READY"] },
    },
    _count: { _all: true },
  });
  const values = new Map(grouped.map((row) => [row.status, row._count._all]));
  const counts = {
    SUBMITTED: values.get("SUBMITTED") ?? 0,
    UNDER_REVIEW: values.get("UNDER_REVIEW") ?? 0,
    APPROVED: values.get("APPROVED") ?? 0,
    READY: values.get("READY") ?? 0,
  };
  return {
    ok: true as const,
    counts: {
      ...counts,
      totalActive: Object.values(counts).reduce((sum, count) => sum + count, 0),
    },
  };
}

export async function listStaffRequests(
  claims: ActorSessionClaims,
  input: unknown,
  database: PrismaClient,
) {
  const parsed = requestQueueQuerySchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "INVALID_INPUT" } as const;
  const authorization = await loadCapabilityActor(
    claims,
    "PROCESS_REQUESTS",
    database,
  );
  if (!authorization.ok) return authorization;
  const { page, ...filters } = parsed.data;
  const where = buildRequestWhere(filters);
  const [total, requests, categories] = await Promise.all([
    database.documentRequest.count({ where }),
    database.documentRequest.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * 25,
      take: 25,
      select: {
        id: true,
        referenceNumber: true,
        status: true,
        deliveryMethod: true,
        copyCount: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { id: true, name: true } },
        student: {
          select: { studentNumber: true, user: { select: { fullName: true } } },
        },
      },
    }),
    database.requestCategory.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: { id: true, name: true },
    }),
  ]);
  return {
    ok: true as const,
    actor: authorization.actor,
    query: parsed.data,
    requests,
    categories,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / 25)),
  };
}

export async function getStaffRequestDetails(
  claims: ActorSessionClaims,
  requestId: string,
  database: PrismaClient,
) {
  const authorization = await loadCapabilityActor(
    claims,
    "PROCESS_REQUESTS",
    database,
  );
  if (!authorization.ok) return authorization;
  if (!requestQueueQuerySchema.shape.categoryId.safeParse(requestId).success) {
    return { ok: true as const, request: null };
  }
  const request = await database.documentRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      referenceNumber: true,
      status: true,
      deliveryMethod: true,
      copyCount: true,
      details: true,
      createdAt: true,
      updatedAt: true,
      category: { select: { name: true } },
      student: {
        select: {
          studentNumber: true,
          program: true,
          academicYear: true,
          user: { select: { fullName: true } },
        },
      },
      statusHistory: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, fromStatus: true, toStatus: true, createdAt: true },
      },
      messages: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, visibility: true, body: true, createdAt: true },
      },
      documentArtifacts: {
        orderBy: [{ version: "desc" }],
        select: { id: true, status: true, version: true, generatedAt: true },
      },
    },
  });
  if (!request) return { ok: true as const, request: null };
  const timeline = [
    ...request.statusHistory.map((event) => ({
      ...event,
      kind: "status" as const,
    })),
    ...request.messages.map((message) => ({
      ...message,
      kind: "message" as const,
    })),
  ].sort(
    (left, right) =>
      left.createdAt.getTime() - right.createdAt.getTime() ||
      left.id.localeCompare(right.id),
  );
  return {
    ok: true as const,
    actor: authorization.actor,
    request: {
      ...request,
      statusHistory: undefined,
      messages: undefined,
      timeline,
    },
  };
}

export async function listRequestCategories(
  claims: ActorSessionClaims,
  database: PrismaClient,
) {
  const authorization = await loadCapabilityActor(
    claims,
    "MANAGE_REQUEST_CATEGORIES",
    database,
  );
  if (!authorization.ok) return authorization;
  return {
    ok: true as const,
    categories: await database.requestCategory.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { requests: true } },
      },
    }),
  };
}

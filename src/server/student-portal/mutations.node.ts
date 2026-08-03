import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  ACTIVE_REQUEST_STATUSES,
  cancelRequestInputSchema,
  submitRequestInputSchema,
} from "@/features/student-portal/schemas";
import type {
  ActorSessionClaims,
  AuthorizationFailure,
} from "@/server/auth/capabilities";
import { enqueueStaffRequestNotifications } from "@/server/notifications/events.node";
import { lockRequestWorkflow } from "@/server/requests/workflow-lock.node";
import {
  authorizeStudentActor,
  revalidateStudentActorInTransaction,
} from "@/server/student-portal/authorization.node";

export type SubmitRequestResult =
  | { ok: true; requestId: string }
  | {
      ok: false;
      reason:
        | AuthorizationFailure
        | "INVALID_INPUT"
        | "CATEGORY_UNAVAILABLE"
        | "DUPLICATE_OPEN_REQUEST";
    };

export type CancelRequestResult =
  | { ok: true }
  | {
      ok: false;
      reason:
        | AuthorizationFailure
        | "INVALID_INPUT"
        | "NOT_FOUND"
        | "ALREADY_CANCELLED"
        | "STATUS_CONFLICT";
    };

export async function submitRequestAsActor(
  claims: ActorSessionClaims,
  input: unknown,
  database: PrismaClient,
): Promise<SubmitRequestResult> {
  const parsed = submitRequestInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "INVALID_INPUT" };

  return database.$transaction(async (transaction) => {
    const authorization = await revalidateStudentActorInTransaction(
      transaction,
      claims,
    );
    if (!authorization.ok) return authorization;
    const { actor } = authorization;

    await transaction.$queryRaw(Prisma.sql`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`v2-5:${actor.profileId}:${parsed.data.categoryId}`}, 0::bigint)
      )::text AS "lock"
    `);

    const category = await transaction.requestCategory.findFirst({
      where: { id: parsed.data.categoryId, isActive: true },
      select: { id: true },
    });
    if (!category)
      return { ok: false, reason: "CATEGORY_UNAVAILABLE" } as const;

    const conflict = await transaction.documentRequest.findFirst({
      where: {
        studentId: actor.profileId,
        categoryId: category.id,
        status: { in: [...ACTIVE_REQUEST_STATUSES] },
      },
      select: { id: true },
    });
    if (conflict)
      return { ok: false, reason: "DUPLICATE_OPEN_REQUEST" } as const;

    const request = await transaction.documentRequest.create({
      data: {
        studentId: actor.profileId,
        categoryId: category.id,
        status: "SUBMITTED",
        copyCount: parsed.data.copyCount,
        details: parsed.data.details,
        deliveryMethod: parsed.data.deliveryMethod,
      },
      select: { id: true },
    });
    await transaction.requestStatusHistory.create({
      data: {
        requestId: request.id,
        fromStatus: null,
        toStatus: "SUBMITTED",
        changedById: actor.id,
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId: actor.id,
        action: "STUDENT_REQUEST_SUBMITTED",
        entityType: "DocumentRequest",
        entityId: request.id,
        metadata: {
          status: "SUBMITTED",
          copyCount: parsed.data.copyCount,
          deliveryMethod: parsed.data.deliveryMethod,
        },
      },
    });
    await enqueueStaffRequestNotifications(transaction, {
      requestId: request.id,
      eventType: "REQUEST_SUBMITTED",
    });
    return { ok: true, requestId: request.id } as const;
  });
}

type LockedRequest = { id: string; status: string };

export async function cancelRequestAsActor(
  claims: ActorSessionClaims,
  input: unknown,
  database: PrismaClient,
): Promise<CancelRequestResult> {
  const parsed = cancelRequestInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "INVALID_INPUT" };
  const initialAuthorization = await authorizeStudentActor(claims, database);
  if (!initialAuthorization.ok) return initialAuthorization;

  return database.$transaction(async (transaction) => {
    await lockRequestWorkflow(transaction, parsed.data.requestId);
    const authorization = await revalidateStudentActorInTransaction(
      transaction,
      claims,
    );
    if (!authorization.ok) return authorization;
    const rows = await transaction.$queryRaw<LockedRequest[]>(Prisma.sql`
      SELECT request."id"::text AS "id", request."status"::text AS "status"
      FROM "DocumentRequest" request
      WHERE request."id" = CAST(${parsed.data.requestId} AS UUID)
        AND request."studentId" = CAST(${authorization.actor.profileId} AS UUID)
      FOR UPDATE
    `);
    const request = rows[0];
    if (!request) return { ok: false, reason: "NOT_FOUND" } as const;
    if (request.status === "CANCELLED")
      return { ok: false, reason: "ALREADY_CANCELLED" } as const;
    if (request.status !== "SUBMITTED")
      return { ok: false, reason: "STATUS_CONFLICT" } as const;

    const changed = await transaction.documentRequest.updateMany({
      where: {
        id: request.id,
        studentId: authorization.actor.profileId,
        status: "SUBMITTED",
      },
      data: { status: "CANCELLED" },
    });
    if (changed.count !== 1)
      return { ok: false, reason: "STATUS_CONFLICT" } as const;
    await transaction.requestStatusHistory.create({
      data: {
        requestId: request.id,
        fromStatus: "SUBMITTED",
        toStatus: "CANCELLED",
        changedById: authorization.actor.id,
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId: authorization.actor.id,
        action: "STUDENT_REQUEST_CANCELLED",
        entityType: "DocumentRequest",
        entityId: request.id,
        metadata: { previousStatus: "SUBMITTED", newStatus: "CANCELLED" },
      },
    });
    await enqueueStaffRequestNotifications(transaction, {
      requestId: request.id,
      eventType: "REQUEST_CANCELLED",
    });
    return { ok: true } as const;
  });
}

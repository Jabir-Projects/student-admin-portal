import "server-only";

import {
  Prisma,
  type PrismaClient,
  type RequestStatus,
} from "@/generated/prisma/client";
import {
  createRequestCategoryInputSchema,
  requestMessageInputSchema,
  requestTransitionInputSchema,
  setRequestCategoryActiveInputSchema,
  updateRequestCategoryInputSchema,
} from "@/features/administration/schemas";
import type {
  ActorSessionClaims,
  AuthorizationFailure,
} from "@/server/auth/capabilities";
import {
  loadCapabilityActor,
  revalidateCapabilityActorInTransaction,
} from "@/server/auth/capabilities.node";
import { enqueueStudentRequestNotification } from "@/server/notifications/events.node";
import { lockRequestWorkflow } from "@/server/requests/workflow-lock.node";

type MutationFailure =
  | AuthorizationFailure
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "STATUS_CONFLICT"
  | "DUPLICATE_CATEGORY";
export type AdministrationMutationResult =
  { ok: true } | { ok: false; reason: MutationFailure };

const transitions: Readonly<Record<RequestStatus, readonly RequestStatus[]>> = {
  SUBMITTED: ["UNDER_REVIEW", "REJECTED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["READY"],
  READY: ["COMPLETED"],
  REJECTED: [],
  COMPLETED: [],
  CANCELLED: [],
};

type LockedRequest = {
  id: string;
  status: RequestStatus;
  studentUserId: string;
};

async function lockRequest(
  transaction: Prisma.TransactionClient,
  requestId: string,
): Promise<LockedRequest | null> {
  const rows = await transaction.$queryRaw<LockedRequest[]>(Prisma.sql`
    SELECT request."id"::text AS "id", request."status",
           student."userId"::text AS "studentUserId"
    FROM "DocumentRequest" request
    JOIN "StudentProfile" student ON student."id" = request."studentId"
    WHERE request."id" = CAST(${requestId} AS UUID)
    FOR UPDATE
  `);
  return rows[0] ?? null;
}

export async function transitionRequestAsActor(
  claims: ActorSessionClaims,
  input: unknown,
  database: PrismaClient,
): Promise<AdministrationMutationResult> {
  const parsed = requestTransitionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "INVALID_INPUT" };
  if (
    parsed.data.targetStatus === "REJECTED" &&
    (!parsed.data.rejectionReason || parsed.data.rejectionReason.length < 3)
  ) {
    return { ok: false, reason: "INVALID_INPUT" };
  }
  const initialAuthorization = await loadCapabilityActor(
    claims,
    "PROCESS_REQUESTS",
    database,
  );
  if (!initialAuthorization.ok) return initialAuthorization;
  return database.$transaction(async (transaction) => {
    await lockRequestWorkflow(transaction, parsed.data.requestId);
    const authorization = await revalidateCapabilityActorInTransaction(
      transaction,
      claims,
      "PROCESS_REQUESTS",
    );
    if (!authorization.ok) return authorization;
    const request = await lockRequest(transaction, parsed.data.requestId);
    if (!request) return { ok: false, reason: "NOT_FOUND" } as const;
    if (!transitions[request.status].includes(parsed.data.targetStatus)) {
      return { ok: false, reason: "STATUS_CONFLICT" } as const;
    }
    const changed = await transaction.documentRequest.updateMany({
      where: { id: request.id, status: request.status },
      data: { status: parsed.data.targetStatus },
    });
    if (changed.count !== 1)
      return { ok: false, reason: "STATUS_CONFLICT" } as const;
    const history = await transaction.requestStatusHistory.create({
      data: {
        requestId: request.id,
        fromStatus: request.status,
        toStatus: parsed.data.targetStatus,
        changedById: authorization.actor.id,
      },
      select: { id: true },
    });
    if (parsed.data.internalNote) {
      await transaction.requestMessage.create({
        data: {
          requestId: request.id,
          authorId: authorization.actor.id,
          visibility: "INTERNAL",
          body: parsed.data.internalNote,
        },
      });
    }
    if (parsed.data.targetStatus === "REJECTED") {
      const message = await transaction.requestMessage.create({
        data: {
          requestId: request.id,
          authorId: authorization.actor.id,
          visibility: "PUBLIC",
          body: `Request rejected: ${parsed.data.rejectionReason}`,
        },
        select: { id: true },
      });
      await enqueueStudentRequestNotification(transaction, {
        requestId: request.id,
        studentUserId: request.studentUserId,
        eventType: "REQUEST_PUBLIC_MESSAGE_ADDED",
        eventId: message.id,
      });
    }
    if (parsed.data.publicMessage) {
      const message = await transaction.requestMessage.create({
        data: {
          requestId: request.id,
          authorId: authorization.actor.id,
          visibility: "PUBLIC",
          body: parsed.data.publicMessage,
        },
        select: { id: true },
      });
      await enqueueStudentRequestNotification(transaction, {
        requestId: request.id,
        studentUserId: request.studentUserId,
        eventType: "REQUEST_PUBLIC_MESSAGE_ADDED",
        eventId: message.id,
      });
    }
    await transaction.auditLog.create({
      data: {
        actorId: authorization.actor.id,
        action: "REQUEST_STATUS_CHANGED",
        entityType: "DocumentRequest",
        entityId: request.id,
        metadata: {
          previousStatus: request.status,
          newStatus: parsed.data.targetStatus,
          hasInternalNote: Boolean(parsed.data.internalNote),
          hasPublicMessage: Boolean(
            parsed.data.publicMessage || parsed.data.rejectionReason,
          ),
        },
      },
    });
    await enqueueStudentRequestNotification(transaction, {
      requestId: request.id,
      studentUserId: request.studentUserId,
      eventType: "REQUEST_STATUS_CHANGED",
      eventId: history.id,
      status: parsed.data.targetStatus,
    });
    return { ok: true } as const;
  });
}

export async function addRequestMessageAsActor(
  claims: ActorSessionClaims,
  input: unknown,
  database: PrismaClient,
): Promise<AdministrationMutationResult> {
  const parsed = requestMessageInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "INVALID_INPUT" };
  const initialAuthorization = await loadCapabilityActor(
    claims,
    "PROCESS_REQUESTS",
    database,
  );
  if (!initialAuthorization.ok) return initialAuthorization;
  return database.$transaction(async (transaction) => {
    await lockRequestWorkflow(transaction, parsed.data.requestId);
    const authorization = await revalidateCapabilityActorInTransaction(
      transaction,
      claims,
      "PROCESS_REQUESTS",
    );
    if (!authorization.ok) return authorization;
    const request = await lockRequest(transaction, parsed.data.requestId);
    if (!request) return { ok: false, reason: "NOT_FOUND" } as const;
    const message = await transaction.requestMessage.create({
      data: {
        requestId: request.id,
        authorId: authorization.actor.id,
        visibility: parsed.data.visibility,
        body: parsed.data.body,
      },
      select: { id: true },
    });
    await transaction.auditLog.create({
      data: {
        actorId: authorization.actor.id,
        action:
          parsed.data.visibility === "INTERNAL"
            ? "REQUEST_INTERNAL_NOTE_ADDED"
            : "REQUEST_PUBLIC_MESSAGE_ADDED",
        entityType: "DocumentRequest",
        entityId: request.id,
        metadata: { visibility: parsed.data.visibility },
      },
    });
    if (parsed.data.visibility === "PUBLIC") {
      await enqueueStudentRequestNotification(transaction, {
        requestId: request.id,
        studentUserId: request.studentUserId,
        eventType: "REQUEST_PUBLIC_MESSAGE_ADDED",
        eventId: message.id,
      });
    }
    return { ok: true } as const;
  });
}

function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 120);
}

async function lockCategoryNamespace(transaction: Prisma.TransactionClient) {
  await transaction.$queryRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(
      hashtextextended('v2-6:request-categories', 0::bigint)
    )::text AS "lock"
  `);
}

async function categoryNameExists(
  transaction: Prisma.TransactionClient,
  name: string,
  excludedId?: string,
) {
  return Boolean(
    await transaction.requestCategory.findFirst({
      where: {
        name: { equals: name, mode: Prisma.QueryMode.insensitive },
        ...(excludedId ? { id: { not: excludedId } } : {}),
      },
      select: { id: true },
    }),
  );
}

export async function createRequestCategoryAsActor(
  claims: ActorSessionClaims,
  input: unknown,
  database: PrismaClient,
): Promise<AdministrationMutationResult> {
  const parsed = createRequestCategoryInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "INVALID_INPUT" };
  const slug = slugify(parsed.data.name);
  if (!slug) return { ok: false, reason: "INVALID_INPUT" };
  try {
    return await database.$transaction(async (transaction) => {
      const authorization = await revalidateCapabilityActorInTransaction(
        transaction,
        claims,
        "MANAGE_REQUEST_CATEGORIES",
      );
      if (!authorization.ok) return authorization;
      await lockCategoryNamespace(transaction);
      if (await categoryNameExists(transaction, parsed.data.name)) {
        return { ok: false, reason: "DUPLICATE_CATEGORY" } as const;
      }
      const existingSlug = await transaction.requestCategory.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (existingSlug)
        return { ok: false, reason: "DUPLICATE_CATEGORY" } as const;
      const category = await transaction.requestCategory.create({
        data: {
          name: parsed.data.name,
          description: parsed.data.description,
          slug,
        },
        select: { id: true },
      });
      await transaction.auditLog.create({
        data: {
          actorId: authorization.actor.id,
          action: "REQUEST_CATEGORY_CREATED",
          entityType: "RequestCategory",
          entityId: category.id,
          metadata: { active: true },
        },
      });
      return { ok: true } as const;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, reason: "DUPLICATE_CATEGORY" };
    }
    throw error;
  }
}

export async function updateRequestCategoryAsActor(
  claims: ActorSessionClaims,
  input: unknown,
  database: PrismaClient,
): Promise<AdministrationMutationResult> {
  const parsed = updateRequestCategoryInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "INVALID_INPUT" };
  try {
    return await database.$transaction(async (transaction) => {
      const authorization = await revalidateCapabilityActorInTransaction(
        transaction,
        claims,
        "MANAGE_REQUEST_CATEGORIES",
      );
      if (!authorization.ok) return authorization;
      await lockCategoryNamespace(transaction);
      const category = await transaction.requestCategory.findUnique({
        where: { id: parsed.data.categoryId },
        select: { id: true, name: true, description: true },
      });
      if (!category) return { ok: false, reason: "NOT_FOUND" } as const;
      if (
        await categoryNameExists(transaction, parsed.data.name, category.id)
      ) {
        return { ok: false, reason: "DUPLICATE_CATEGORY" } as const;
      }
      await transaction.requestCategory.update({
        where: { id: category.id },
        data: { name: parsed.data.name, description: parsed.data.description },
      });
      await transaction.auditLog.create({
        data: {
          actorId: authorization.actor.id,
          action: "REQUEST_CATEGORY_UPDATED",
          entityType: "RequestCategory",
          entityId: category.id,
          metadata: {
            nameChanged: category.name !== parsed.data.name,
            descriptionChanged:
              category.description !== parsed.data.description,
          },
        },
      });
      return { ok: true } as const;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, reason: "DUPLICATE_CATEGORY" };
    }
    throw error;
  }
}

export async function setRequestCategoryActiveAsActor(
  claims: ActorSessionClaims,
  input: unknown,
  database: PrismaClient,
): Promise<AdministrationMutationResult> {
  const parsed = setRequestCategoryActiveInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "INVALID_INPUT" };
  return database.$transaction(async (transaction) => {
    const authorization = await revalidateCapabilityActorInTransaction(
      transaction,
      claims,
      "MANAGE_REQUEST_CATEGORIES",
    );
    if (!authorization.ok) return authorization;
    await lockCategoryNamespace(transaction);
    const category = await transaction.requestCategory.findUnique({
      where: { id: parsed.data.categoryId },
      select: { id: true, isActive: true },
    });
    if (!category) return { ok: false, reason: "NOT_FOUND" } as const;
    if (category.isActive === parsed.data.isActive)
      return { ok: true } as const;
    await transaction.requestCategory.update({
      where: { id: category.id },
      data: { isActive: parsed.data.isActive },
    });
    await transaction.auditLog.create({
      data: {
        actorId: authorization.actor.id,
        action: parsed.data.isActive
          ? "REQUEST_CATEGORY_ACTIVATED"
          : "REQUEST_CATEGORY_DEACTIVATED",
        entityType: "RequestCategory",
        entityId: category.id,
        metadata: { active: parsed.data.isActive },
      },
    });
    return { ok: true } as const;
  });
}

export { transitions as REQUEST_TRANSITIONS };

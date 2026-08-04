import "server-only";

import { randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  artifactActionInputSchema,
  generateDocumentInputSchema,
  revokeDocumentInputSchema,
} from "@/features/documents/schemas";
import type {
  ActorSessionClaims,
  AuthorizationFailure,
} from "@/server/auth/capabilities";
import {
  loadCapabilityActor,
  revalidateCapabilityActorInTransaction,
} from "@/server/auth/capabilities.node";
import { documentAuditEvent } from "@/server/documents/audit-events";
import { generateRequestFulfilmentPdf } from "@/server/documents/generator.node";
import {
  checksumDocument,
  createDocumentStorageKey,
  type DocumentStorage,
} from "@/server/documents/storage.node";
import { enqueueStudentDocumentNotification } from "@/server/notifications/events.node";
import { lockRequestWorkflow } from "@/server/requests/workflow-lock.node";

type DocumentMutationFailure =
  | AuthorizationFailure
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "STATUS_CONFLICT"
  | "PROVIDER_FAILURE"
  | "INTEGRITY_FAILURE";

export type DocumentMutationResult =
  | { ok: true; artifactId: string }
  | { ok: false; reason: DocumentMutationFailure };

export type DocumentServiceDependencies = Readonly<{
  storage: DocumentStorage;
  now?: () => Date;
  createId?: () => string;
  generatePdf?: typeof generateRequestFulfilmentPdf;
  onFailure?: (error: unknown) => void;
}>;

const generatedArtifactSelect = {
  id: true,
  requestId: true,
  status: true,
  version: true,
  storageKey: true,
  filename: true,
  mimeType: true,
  byteSize: true,
  checksum: true,
  request: {
    select: {
      status: true,
      deliveryMethod: true,
      student: { select: { userId: true } },
    },
  },
} satisfies Prisma.DocumentArtifactSelect;

export async function generateDocumentAsActor(
  claims: ActorSessionClaims,
  input: unknown,
  database: PrismaClient,
  dependencies: DocumentServiceDependencies,
): Promise<DocumentMutationResult> {
  const parsed = generateDocumentInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "INVALID_INPUT" };
  const initial = await loadCapabilityActor(
    claims,
    "GENERATE_DOCUMENTS",
    database,
  );
  if (!initial.ok) return initial;

  const now = dependencies.now ?? (() => new Date());
  const createId = dependencies.createId ?? randomUUID;
  const generatePdf = dependencies.generatePdf ?? generateRequestFulfilmentPdf;
  let uploadedKey: string | undefined;
  let artifactId: string | undefined;

  try {
    return await database.$transaction(async (transaction) => {
      await lockRequestWorkflow(transaction, parsed.data.requestId);
      const authorization = await revalidateCapabilityActorInTransaction(
        transaction,
        claims,
        "GENERATE_DOCUMENTS",
      );
      if (!authorization.ok) return authorization;
      const request = await transaction.documentRequest.findUnique({
        where: { id: parsed.data.requestId },
        select: {
          id: true,
          status: true,
          referenceNumber: true,
          category: { select: { name: true } },
          student: {
            select: {
              studentNumber: true,
              program: true,
              academicYear: true,
              user: { select: { fullName: true } },
            },
          },
        },
      });
      if (!request) return { ok: false, reason: "NOT_FOUND" } as const;
      if (request.status !== "READY")
        return { ok: false, reason: "STATUS_CONFLICT" } as const;

      const latest = await transaction.documentArtifact.aggregate({
        where: { requestId: request.id },
        _max: { version: true },
      });
      const version = (latest._max.version ?? 0) + 1;
      artifactId = createId();
      uploadedKey = createDocumentStorageKey(artifactId, version);
      const issueDate = now();
      const generated = await generatePdf({
        id: artifactId,
        version,
        referenceNumber: request.referenceNumber,
        category: request.category.name,
        fullName: request.student.user.fullName,
        studentNumber: request.student.studentNumber,
        program: request.student.program,
        academicYear: request.student.academicYear,
        issueDate: issueDate.toISOString().slice(0, 10),
      });
      await dependencies.storage.put(uploadedKey, generated.bytes);
      const artifact = await transaction.documentArtifact.create({
        data: {
          id: artifactId,
          requestId: request.id,
          type: "REQUEST_FULFILMENT_CONFIRMATION",
          version,
          storageKey: uploadedKey,
          filename: generated.filename,
          mimeType: "application/pdf",
          byteSize: generated.bytes.byteLength,
          checksum: generated.checksum,
          generatedById: authorization.actor.id,
          generatedAt: issueDate,
        },
        select: { id: true },
      });
      await transaction.auditLog.create({
        data: documentAuditEvent({
          actorId: authorization.actor.id,
          action: "DOCUMENT_GENERATED",
          artifactId: artifact.id,
          requestId: request.id,
          version,
          status: "GENERATED",
          byteSize: generated.bytes.byteLength,
        }),
      });
      return { ok: true, artifactId: artifact.id } as const;
    });
  } catch (error) {
    dependencies.onFailure?.(error);
    if (uploadedKey) {
      try {
        await dependencies.storage.delete(uploadedKey);
      } catch {
        try {
          await database.auditLog.create({
            data: documentAuditEvent({
              actorId: initial.actor.id,
              action: "DOCUMENT_PROVIDER_COMPENSATION_FAILED",
              artifactId,
              requestId: parsed.data.requestId,
              reasonCode: "DELETE_FAILED",
            }),
          });
        } catch {
          // The original operation remains failed closed even if reporting fails.
        }
      }
    }
    return { ok: false, reason: "PROVIDER_FAILURE" };
  }
}

export async function releaseDocumentAsActor(
  claims: ActorSessionClaims,
  input: unknown,
  database: PrismaClient,
  storage: DocumentStorage,
): Promise<DocumentMutationResult> {
  const parsed = artifactActionInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "INVALID_INPUT" };
  const initial = await loadCapabilityActor(
    claims,
    "RELEASE_DOCUMENTS",
    database,
  );
  if (!initial.ok) return initial;
  return database.$transaction(async (transaction) => {
    const candidate = await transaction.documentArtifact.findUnique({
      where: { id: parsed.data.artifactId },
      select: { requestId: true },
    });
    if (!candidate) return { ok: false, reason: "NOT_FOUND" } as const;
    await lockRequestWorkflow(transaction, candidate.requestId);
    const authorization = await revalidateCapabilityActorInTransaction(
      transaction,
      claims,
      "RELEASE_DOCUMENTS",
    );
    if (!authorization.ok) return authorization;
    const artifact = await transaction.documentArtifact.findUnique({
      where: { id: parsed.data.artifactId },
      select: generatedArtifactSelect,
    });
    if (!artifact) return { ok: false, reason: "NOT_FOUND" } as const;
    if (artifact.status === "RELEASED")
      return { ok: true, artifactId: artifact.id } as const;
    if (artifact.status !== "GENERATED")
      return { ok: false, reason: "STATUS_CONFLICT" } as const;
    if (
      artifact.request.status !== "READY" &&
      !(
        artifact.request.deliveryMethod === "DIGITAL_DELIVERY" &&
        artifact.request.status === "COMPLETED"
      )
    )
      return { ok: false, reason: "STATUS_CONFLICT" } as const;
    const stored = await storage.get(artifact.storageKey);
    if (
      !stored ||
      stored.size !== artifact.byteSize ||
      checksumDocument(stored.body) !== artifact.checksum
    )
      return { ok: false, reason: "INTEGRITY_FAILURE" } as const;

    const releasedAt = new Date();
    await transaction.documentArtifact.updateMany({
      where: {
        requestId: artifact.requestId,
        status: "RELEASED",
        id: { not: artifact.id },
      },
      data: {
        status: "SUPERSEDED",
        supersededAt: releasedAt,
        supersededByArtifactId: artifact.id,
      },
    });
    const changed = await transaction.documentArtifact.updateMany({
      where: { id: artifact.id, status: "GENERATED" },
      data: {
        status: "RELEASED",
        releasedById: authorization.actor.id,
        releasedAt,
      },
    });
    if (changed.count !== 1)
      return { ok: false, reason: "STATUS_CONFLICT" } as const;
    if (
      artifact.request.deliveryMethod === "DIGITAL_DELIVERY" &&
      artifact.request.status === "READY"
    ) {
      await transaction.documentRequest.update({
        where: { id: artifact.requestId },
        data: { status: "COMPLETED" },
      });
      await transaction.requestStatusHistory.create({
        data: {
          requestId: artifact.requestId,
          fromStatus: "READY",
          toStatus: "COMPLETED",
          changedById: authorization.actor.id,
        },
      });
    }
    await transaction.auditLog.create({
      data: documentAuditEvent({
        actorId: authorization.actor.id,
        action: "DOCUMENT_RELEASED",
        artifactId: artifact.id,
        requestId: artifact.requestId,
        version: artifact.version,
        status: "RELEASED",
      }),
    });
    await enqueueStudentDocumentNotification(transaction, {
      artifactId: artifact.id,
      requestId: artifact.requestId,
      studentUserId: artifact.request.student.userId,
      eventType: "DOCUMENT_RELEASED",
    });
    return { ok: true, artifactId: artifact.id } as const;
  });
}

export async function revokeDocumentAsActor(
  claims: ActorSessionClaims,
  input: unknown,
  database: PrismaClient,
): Promise<DocumentMutationResult> {
  const parsed = revokeDocumentInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "INVALID_INPUT" };
  const initial = await loadCapabilityActor(
    claims,
    "REVOKE_DOCUMENTS",
    database,
  );
  if (!initial.ok) return initial;
  return database.$transaction(async (transaction) => {
    const candidate = await transaction.documentArtifact.findUnique({
      where: { id: parsed.data.artifactId },
      select: { requestId: true },
    });
    if (!candidate) return { ok: false, reason: "NOT_FOUND" } as const;
    await lockRequestWorkflow(transaction, candidate.requestId);
    const authorization = await revalidateCapabilityActorInTransaction(
      transaction,
      claims,
      "REVOKE_DOCUMENTS",
    );
    if (!authorization.ok) return authorization;
    const artifact = await transaction.documentArtifact.findUnique({
      where: { id: parsed.data.artifactId },
      select: generatedArtifactSelect,
    });
    if (!artifact) return { ok: false, reason: "NOT_FOUND" } as const;
    if (artifact.status === "REVOKED")
      return { ok: true, artifactId: artifact.id } as const;
    if (artifact.status !== "RELEASED")
      return { ok: false, reason: "STATUS_CONFLICT" } as const;
    const changed = await transaction.documentArtifact.updateMany({
      where: { id: artifact.id, status: "RELEASED" },
      data: {
        status: "REVOKED",
        revokedById: authorization.actor.id,
        revokedAt: new Date(),
        revocationReason: parsed.data.reason,
      },
    });
    if (changed.count !== 1)
      return { ok: false, reason: "STATUS_CONFLICT" } as const;
    await transaction.auditLog.create({
      data: documentAuditEvent({
        actorId: authorization.actor.id,
        action: "DOCUMENT_REVOKED",
        artifactId: artifact.id,
        requestId: artifact.requestId,
        version: artifact.version,
        status: "REVOKED",
      }),
    });
    await enqueueStudentDocumentNotification(transaction, {
      artifactId: artifact.id,
      requestId: artifact.requestId,
      studentUserId: artifact.request.student.userId,
      eventType: "DOCUMENT_REVOKED",
    });
    return { ok: true, artifactId: artifact.id } as const;
  });
}

export async function cleanupOrphanDocuments(
  database: PrismaClient,
  storage: DocumentStorage,
  input: { now?: Date; minimumAgeMs?: number; limit?: number } = {},
) {
  const now = input.now ?? new Date();
  const minimumAgeMs = input.minimumAgeMs ?? 60 * 60 * 1000;
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const candidates = (await storage.list("documents/"))
    .filter((item) => now.getTime() - item.uploadedAt.getTime() >= minimumAgeMs)
    .slice(0, limit);
  let deleted = 0;
  for (const candidate of candidates) {
    const referenced = await database.documentArtifact.count({
      where: { storageKey: candidate.key },
    });
    if (referenced) continue;
    await storage.delete(candidate.key);
    await database.auditLog.create({
      data: documentAuditEvent({
        actorId: null,
        action: "DOCUMENT_ORPHAN_CLEANED",
        reasonCode: "UNREFERENCED_OBJECT",
        byteSize: candidate.size,
      }),
    });
    deleted += 1;
  }
  return { inspected: candidates.length, deleted };
}

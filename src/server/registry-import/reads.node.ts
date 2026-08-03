import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  REGISTRY_IMPORT_MAX_PAGE_SIZE,
  REGISTRY_IMPORT_PAGE_SIZE,
  registryImportBatchIdSchema,
  registryImportPageSchema,
} from "@/features/registry-import/schemas";
import type { ActorSessionClaims } from "@/server/auth/capabilities";
import { loadCapabilityActor } from "@/server/auth/capabilities.node";

async function authorizeRegistryImportRead(
  claims: ActorSessionClaims,
  database: PrismaClient,
) {
  const upload = await loadCapabilityActor(
    claims,
    "REGISTRY_IMPORT_UPLOAD",
    database,
  );
  if (upload.ok) {
    return {
      ok: true as const,
      actor: upload.actor,
      canUpload: true,
      canApprove: upload.actor.capabilities.includes("REGISTRY_IMPORT_APPROVE"),
    };
  }
  if (upload.reason !== "MISSING_CAPABILITY") return upload;
  const approve = await loadCapabilityActor(
    claims,
    "REGISTRY_IMPORT_APPROVE",
    database,
  );
  if (!approve.ok) return approve;
  return {
    ok: true as const,
    actor: approve.actor,
    canUpload: approve.actor.capabilities.includes("REGISTRY_IMPORT_UPLOAD"),
    canApprove: true,
  };
}

function visibleBatchWhere(authorization: {
  actor: { id: string };
  canUpload: boolean;
  canApprove: boolean;
}): Prisma.ImportBatchWhereInput {
  const visibility: Prisma.ImportBatchWhereInput[] = [];
  if (authorization.canUpload)
    visibility.push({ uploaderId: authorization.actor.id });
  if (authorization.canApprove) {
    visibility.push({ status: "PENDING_APPROVAL" });
    visibility.push({ reviewerId: authorization.actor.id });
  }
  return { type: "REGISTRY", OR: visibility };
}

export async function listRegistryImportBatches(
  claims: ActorSessionClaims,
  input: unknown,
  database: PrismaClient,
) {
  const page = registryImportPageSchema.safeParse(input);
  if (!page.success) return { ok: false, reason: "INVALID_INPUT" } as const;
  const authorization = await authorizeRegistryImportRead(claims, database);
  if (!authorization.ok) return authorization;
  const where = visibleBatchWhere(authorization);
  const [total, batches] = await Promise.all([
    database.importBatch.count({ where }),
    database.importBatch.findMany({
      where,
      orderBy: [{ uploadedAt: "desc" }, { id: "desc" }],
      skip: (page.data - 1) * REGISTRY_IMPORT_PAGE_SIZE,
      take: REGISTRY_IMPORT_PAGE_SIZE,
      select: {
        id: true,
        status: true,
        originalFilename: true,
        originalByteSize: true,
        totalRows: true,
        validRows: true,
        invalidRows: true,
        uploadedAt: true,
        submittedAt: true,
        reviewedAt: true,
        purgedAt: true,
        uploader: { select: { id: true, fullName: true } },
        reviewer: { select: { id: true, fullName: true } },
      },
    }),
  ]);
  return {
    ...authorization,
    batches,
    total,
    page: page.data,
    pageCount: Math.max(1, Math.ceil(total / REGISTRY_IMPORT_PAGE_SIZE)),
  };
}

export async function getRegistryImportBatch(
  claims: ActorSessionClaims,
  input: { batchId: unknown; page: unknown },
  database: PrismaClient,
) {
  const batchId = registryImportBatchIdSchema.safeParse(input.batchId);
  const page = registryImportPageSchema.safeParse(input.page);
  if (!batchId.success || !page.success)
    return { ok: false, reason: "INVALID_INPUT" } as const;
  const authorization = await authorizeRegistryImportRead(claims, database);
  if (!authorization.ok) return authorization;
  const where: Prisma.ImportBatchWhereInput = {
    id: batchId.data,
    ...visibleBatchWhere(authorization),
  };
  const batch = await database.importBatch.findFirst({
    where,
    select: {
      id: true,
      status: true,
      originalFilename: true,
      originalByteSize: true,
      totalRows: true,
      validRows: true,
      invalidRows: true,
      rejectionReason: true,
      failureCode: true,
      uploadedAt: true,
      validatedAt: true,
      submittedAt: true,
      reviewedAt: true,
      appliedAt: true,
      expiresAt: true,
      purgedAt: true,
      uploader: { select: { id: true, fullName: true } },
      reviewer: { select: { id: true, fullName: true } },
      rows: {
        orderBy: { rowNumber: "asc" },
        skip: (page.data - 1) * REGISTRY_IMPORT_PAGE_SIZE,
        take: Math.min(
          REGISTRY_IMPORT_PAGE_SIZE,
          REGISTRY_IMPORT_MAX_PAGE_SIZE,
        ),
        select: {
          rowNumber: true,
          studentNumber: true,
          fullName: true,
          email: true,
          program: true,
          academicYear: true,
          status: true,
          operation: true,
          validation: true,
          errorCodes: true,
        },
      },
    },
  });
  return {
    ...authorization,
    batch,
    page: page.data,
    pageCount: Math.max(
      1,
      Math.ceil((batch?.totalRows ?? 0) / REGISTRY_IMPORT_PAGE_SIZE),
    ),
  };
}

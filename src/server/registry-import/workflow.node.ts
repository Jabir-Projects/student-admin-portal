import "server-only";

import {
  Prisma,
  type PrismaClient,
  type RegistryImportOperation,
} from "@/generated/prisma/client";
import {
  REGISTRY_IMPORT_RETENTION_DAYS,
  registryImportBatchIdSchema,
  registryImportRejectionReasonSchema,
  type RegistryImportErrorCode,
  type RegistryImportNormalizedRow,
} from "@/features/registry-import/schemas";
import type {
  ActorSessionClaims,
  AuthorizationFailure,
} from "@/server/auth/capabilities";
import {
  loadCapabilityActor,
  revalidateCapabilityActorInTransaction,
} from "@/server/auth/capabilities.node";
import { registryImportAuditEvent } from "@/server/registry-import/audit-events";
import {
  parseRegistryImport,
  RegistryImportParseError,
  type ParsedRegistryImport,
} from "@/server/registry-import/parser.node";

type UploadFailure = AuthorizationFailure | "INVALID_FILE" | "DUPLICATE_FILE";
type WorkflowFailure =
  | AuthorizationFailure
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "NOT_OWNER"
  | "SELF_REVIEW"
  | "INVALID_TRANSITION"
  | "INVALID_BATCH"
  | "REGISTRY_CONFLICT"
  | "PURGED";

export type RegistryImportUploadResult =
  | {
      ok: true;
      batchId: string;
      status: "UPLOADED" | "VALIDATED";
      totalRows: number;
      validRows: number;
      invalidRows: number;
    }
  | { ok: false; reason: UploadFailure; errorCode?: string };

export type RegistryImportWorkflowResult =
  | { ok: true; status: "PENDING_APPROVAL" | "APPROVED" | "REJECTED" }
  | { ok: false; reason: WorkflowFailure };

type StagedRow = {
  rowNumber: number;
  value: RegistryImportNormalizedRow | null;
  operation: RegistryImportOperation | null;
  errors: RegistryImportErrorCode[];
};

const registryImportTransactionOptions = {
  maxWait: 15_000,
  timeout: 30_000,
} as const;

function expiresAt(uploadedAt: Date): Date {
  const result = new Date(uploadedAt);
  result.setUTCDate(result.getUTCDate() + REGISTRY_IMPORT_RETENTION_DAYS);
  return result;
}

async function lockBatchWorkflow(
  transaction: Prisma.TransactionClient,
  batchId: string,
): Promise<void> {
  await transaction.$queryRaw(Prisma.sql`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${`registry-import:${batchId}`}, 0::bigint)
    )::text AS "lock"
  `);
  await transaction.$queryRaw(Prisma.sql`
    SELECT "id"
    FROM "ImportBatch"
    WHERE "id" = CAST(${batchId} AS UUID)
    FOR UPDATE
  `);
}

async function stageAgainstCurrentRegistry(
  parsed: ParsedRegistryImport,
  database: PrismaClient,
): Promise<StagedRow[]> {
  const validValues = parsed.rows.flatMap((row) =>
    row.value ? [row.value] : [],
  );
  const existing =
    validValues.length === 0
      ? []
      : await database.studentRegistry.findMany({
          where: {
            OR: [
              {
                studentNumber: {
                  in: validValues.map((row) => row.studentNumber),
                },
              },
              { email: { in: validValues.map((row) => row.email) } },
            ],
          },
          select: { id: true, studentNumber: true, email: true },
        });
  const byStudentNumber = new Map(
    existing.map((row) => [row.studentNumber, row]),
  );
  const byEmail = new Map(existing.map((row) => [row.email, row]));

  return parsed.rows.map((row): StagedRow => {
    if (!row.value) return { ...row, operation: null };
    const matchingStudent = byStudentNumber.get(row.value.studentNumber);
    const matchingEmail = byEmail.get(row.value.email);
    if (
      matchingEmail &&
      matchingEmail.studentNumber !== row.value.studentNumber
    ) {
      return {
        rowNumber: row.rowNumber,
        value: null,
        operation: null,
        errors: ["EMAIL_CONFLICT"],
      };
    }
    return {
      ...row,
      operation: matchingStudent ? "UPDATE" : "CREATE",
    };
  });
}

function counts(rows: readonly StagedRow[]) {
  const validRows = rows.filter((row) => row.errors.length === 0).length;
  return {
    totalRows: rows.length,
    validRows,
    invalidRows: rows.length - validRows,
  };
}

export async function uploadRegistryImportAsActor(
  claims: ActorSessionClaims,
  file: { bytes: Uint8Array; filename: string; mimeType: string },
  database: PrismaClient,
): Promise<RegistryImportUploadResult> {
  const initialAuthorization = await loadCapabilityActor(
    claims,
    "REGISTRY_IMPORT_UPLOAD",
    database,
  );
  if (!initialAuthorization.ok) return initialAuthorization;

  let parsed: ParsedRegistryImport;
  try {
    parsed = await parseRegistryImport(file);
  } catch (error) {
    return {
      ok: false,
      reason: "INVALID_FILE",
      ...(error instanceof RegistryImportParseError
        ? { errorCode: error.code }
        : {}),
    };
  }
  const stagedRows = await stageAgainstCurrentRegistry(parsed, database);
  const rowCounts = counts(stagedRows);
  const uploadedAt = new Date();
  const status = rowCounts.invalidRows === 0 ? "VALIDATED" : "UPLOADED";

  try {
    return await database.$transaction(async (transaction) => {
      const authorization = await revalidateCapabilityActorInTransaction(
        transaction,
        claims,
        "REGISTRY_IMPORT_UPLOAD",
      );
      if (!authorization.ok) return authorization;
      const batch = await transaction.importBatch.create({
        data: {
          type: "REGISTRY",
          status: "UPLOADED",
          uploaderId: authorization.actor.id,
          checksum: parsed.checksum,
          originalFilename: parsed.originalFilename,
          originalByteSize: parsed.originalByteSize,
          ...rowCounts,
          uploadedAt,
          expiresAt: expiresAt(uploadedAt),
          rows: {
            create: stagedRows.map((row) => ({
              rowNumber: row.rowNumber,
              ...(row.value
                ? {
                    studentNumber: row.value.studentNumber,
                    fullName: row.value.fullName,
                    normalizedFullName: row.value.normalizedFullName,
                    email: row.value.email,
                    program: row.value.program,
                    academicYear: row.value.academicYear,
                    status: row.value.status,
                    operation: row.operation,
                  }
                : {}),
              validation: row.errors.length === 0 ? "VALID" : "INVALID",
              errorCodes: row.errors,
            })),
          },
        },
        select: { id: true },
      });
      await transaction.auditLog.create({
        data: registryImportAuditEvent({
          actorId: authorization.actor.id,
          action: "REGISTRY_IMPORT_UPLOADED",
          batchId: batch.id,
          metadata: {
            sourceType: parsed.sourceType,
            originalByteSize: parsed.originalByteSize,
            ...rowCounts,
          },
        }),
      });
      if (status === "VALIDATED") {
        await transaction.auditLog.create({
          data: registryImportAuditEvent({
            actorId: authorization.actor.id,
            action: "REGISTRY_IMPORT_VALIDATED",
            batchId: batch.id,
            metadata: rowCounts,
          }),
        });
        await transaction.importBatch.update({
          where: { id: batch.id },
          data: {
            status: "VALIDATED",
            validatedAt: uploadedAt,
            version: { increment: 1 },
          },
        });
      }
      return { ok: true, batchId: batch.id, status, ...rowCounts };
    }, registryImportTransactionOptions);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, reason: "DUPLICATE_FILE" };
    }
    throw error;
  }
}

export async function submitRegistryImportAsActor(
  claims: ActorSessionClaims,
  batchIdInput: unknown,
  database: PrismaClient,
): Promise<RegistryImportWorkflowResult> {
  const parsed = registryImportBatchIdSchema.safeParse(batchIdInput);
  if (!parsed.success) return { ok: false, reason: "INVALID_INPUT" };
  return database.$transaction(async (transaction) => {
    const authorization = await revalidateCapabilityActorInTransaction(
      transaction,
      claims,
      "REGISTRY_IMPORT_UPLOAD",
    );
    if (!authorization.ok) return authorization;
    await lockBatchWorkflow(transaction, parsed.data);
    const batch = await transaction.importBatch.findUnique({
      where: { id: parsed.data },
    });
    if (!batch) return { ok: false, reason: "NOT_FOUND" };
    if (batch.uploaderId !== authorization.actor.id)
      return { ok: false, reason: "NOT_OWNER" };
    if (batch.purgedAt) return { ok: false, reason: "PURGED" };
    if (batch.status !== "VALIDATED")
      return { ok: false, reason: "INVALID_TRANSITION" };
    if (
      batch.invalidRows !== 0 ||
      batch.validRows !== batch.totalRows ||
      batch.totalRows === 0
    ) {
      return { ok: false, reason: "INVALID_BATCH" };
    }
    const rowCount = await transaction.registryImportRow.count({
      where: { batchId: batch.id, validation: "VALID" },
    });
    if (rowCount !== batch.totalRows)
      return { ok: false, reason: "INVALID_BATCH" };
    const submittedAt = new Date();
    await transaction.auditLog.create({
      data: registryImportAuditEvent({
        actorId: authorization.actor.id,
        action: "REGISTRY_IMPORT_SUBMITTED",
        batchId: batch.id,
        metadata: { totalRows: batch.totalRows },
      }),
    });
    await transaction.importBatch.update({
      where: { id: batch.id },
      data: {
        status: "PENDING_APPROVAL",
        submittedAt,
        version: { increment: 1 },
      },
    });
    return { ok: true, status: "PENDING_APPROVAL" };
  }, registryImportTransactionOptions);
}

async function validateApprovalRows(
  transaction: Prisma.TransactionClient,
  batchId: string,
  expectedCount: number,
) {
  const rows = await transaction.registryImportRow.findMany({
    where: { batchId },
    orderBy: { rowNumber: "asc" },
  });
  if (
    rows.length !== expectedCount ||
    rows.some(
      (row) =>
        row.validation !== "VALID" ||
        row.errorCodes.length !== 0 ||
        !row.studentNumber ||
        !row.fullName ||
        !row.normalizedFullName ||
        !row.email ||
        !row.program ||
        !row.academicYear ||
        !row.status ||
        !row.operation,
    )
  ) {
    return null;
  }
  const existing = await transaction.studentRegistry.findMany({
    where: {
      OR: [
        { studentNumber: { in: rows.map((row) => row.studentNumber!) } },
        { email: { in: rows.map((row) => row.email!) } },
      ],
    },
    select: { id: true, studentNumber: true, email: true },
  });
  const byStudent = new Map(existing.map((row) => [row.studentNumber, row]));
  const byEmail = new Map(existing.map((row) => [row.email, row]));
  for (const row of rows) {
    const student = byStudent.get(row.studentNumber!);
    const email = byEmail.get(row.email!);
    if (
      (email && email.studentNumber !== row.studentNumber) ||
      (row.operation === "UPDATE" && !student) ||
      (row.operation === "CREATE" && student)
    ) {
      return null;
    }
  }
  return { rows, byStudent };
}

export async function approveRegistryImportAsActor(
  claims: ActorSessionClaims,
  batchIdInput: unknown,
  database: PrismaClient,
): Promise<RegistryImportWorkflowResult> {
  const parsed = registryImportBatchIdSchema.safeParse(batchIdInput);
  if (!parsed.success) return { ok: false, reason: "INVALID_INPUT" };
  try {
    return await database.$transaction(async (transaction) => {
      const authorization = await revalidateCapabilityActorInTransaction(
        transaction,
        claims,
        "REGISTRY_IMPORT_APPROVE",
      );
      if (!authorization.ok) return authorization;
      await lockBatchWorkflow(transaction, parsed.data);
      const batch = await transaction.importBatch.findUnique({
        where: { id: parsed.data },
      });
      if (!batch) return { ok: false, reason: "NOT_FOUND" };
      if (batch.uploaderId === authorization.actor.id)
        return { ok: false, reason: "SELF_REVIEW" };
      if (batch.purgedAt) return { ok: false, reason: "PURGED" };
      if (batch.status !== "PENDING_APPROVAL") {
        return { ok: false, reason: "INVALID_TRANSITION" };
      }
      if (
        batch.invalidRows !== 0 ||
        batch.validRows !== batch.totalRows ||
        batch.totalRows === 0
      ) {
        return { ok: false, reason: "INVALID_BATCH" };
      }
      const approval = await validateApprovalRows(
        transaction,
        batch.id,
        batch.totalRows,
      );
      if (!approval) return { ok: false, reason: "REGISTRY_CONFLICT" };

      for (const row of approval.rows) {
        const data = {
          fullName: row.fullName!,
          normalizedFullName: row.normalizedFullName!,
          email: row.email!,
          program: row.program!,
          academicYear: row.academicYear!,
          status: row.status!,
          source: "OFFICIAL_IMPORT" as const,
        };
        if (row.operation === "UPDATE") {
          await transaction.studentRegistry.update({
            where: { id: approval.byStudent.get(row.studentNumber!)!.id },
            data,
          });
        } else {
          await transaction.studentRegistry.create({
            data: { studentNumber: row.studentNumber!, ...data },
          });
        }
      }
      const reviewedAt = new Date();
      await transaction.auditLog.create({
        data: registryImportAuditEvent({
          actorId: authorization.actor.id,
          action: "REGISTRY_IMPORT_APPROVED",
          batchId: batch.id,
          metadata: { totalRows: batch.totalRows },
        }),
      });
      await transaction.importBatch.update({
        where: { id: batch.id },
        data: {
          status: "APPROVED",
          reviewerId: authorization.actor.id,
          reviewedAt,
          appliedAt: reviewedAt,
          expiresAt: reviewedAt,
          version: { increment: 1 },
        },
      });
      return { ok: true, status: "APPROVED" };
    }, registryImportTransactionOptions);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { ok: false, reason: "REGISTRY_CONFLICT" };
    }
    throw error;
  }
}

export async function rejectRegistryImportAsActor(
  claims: ActorSessionClaims,
  input: { batchId: unknown; reason: unknown },
  database: PrismaClient,
): Promise<RegistryImportWorkflowResult> {
  const batchId = registryImportBatchIdSchema.safeParse(input.batchId);
  const reason = registryImportRejectionReasonSchema.safeParse(input.reason);
  if (!batchId.success || !reason.success)
    return { ok: false, reason: "INVALID_INPUT" };
  return database.$transaction(async (transaction) => {
    const authorization = await revalidateCapabilityActorInTransaction(
      transaction,
      claims,
      "REGISTRY_IMPORT_APPROVE",
    );
    if (!authorization.ok) return authorization;
    await lockBatchWorkflow(transaction, batchId.data);
    const batch = await transaction.importBatch.findUnique({
      where: { id: batchId.data },
    });
    if (!batch) return { ok: false, reason: "NOT_FOUND" };
    if (batch.uploaderId === authorization.actor.id)
      return { ok: false, reason: "SELF_REVIEW" };
    if (batch.status !== "PENDING_APPROVAL")
      return { ok: false, reason: "INVALID_TRANSITION" };
    const reviewedAt = new Date();
    await transaction.auditLog.create({
      data: registryImportAuditEvent({
        actorId: authorization.actor.id,
        action: "REGISTRY_IMPORT_REJECTED",
        batchId: batch.id,
        metadata: { totalRows: batch.totalRows },
      }),
    });
    await transaction.importBatch.update({
      where: { id: batch.id },
      data: {
        status: "REJECTED",
        reviewerId: authorization.actor.id,
        reviewedAt,
        rejectionReason: reason.data,
        expiresAt: new Date(
          reviewedAt.getTime() + REGISTRY_IMPORT_RETENTION_DAYS * 86_400_000,
        ),
        version: { increment: 1 },
      },
    });
    return { ok: true, status: "REJECTED" };
  }, registryImportTransactionOptions);
}

export async function purgeExpiredRegistryImportStaging(
  database: PrismaClient,
  now = new Date(),
  limit = 100,
): Promise<{ purged: number }> {
  const candidates = await database.importBatch.findMany({
    where: {
      expiresAt: { lte: now },
      purgedAt: null,
      status: { in: ["UPLOADED", "VALIDATED", "REJECTED", "FAILED"] },
    },
    orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
    take: Math.min(Math.max(limit, 1), 100),
    select: { id: true },
  });
  let purged = 0;
  for (const candidate of candidates) {
    const didPurge = await database.$transaction(async (transaction) => {
      await lockBatchWorkflow(transaction, candidate.id);
      const batch = await transaction.importBatch.findFirst({
        where: {
          id: candidate.id,
          expiresAt: { lte: now },
          purgedAt: null,
          status: { in: ["UPLOADED", "VALIDATED", "REJECTED", "FAILED"] },
        },
        select: { id: true },
      });
      if (!batch) return false;
      await transaction.registryImportRow.deleteMany({
        where: { batchId: batch.id },
      });
      await transaction.auditLog.create({
        data: registryImportAuditEvent({
          actorId: null,
          action: "REGISTRY_IMPORT_STAGING_PURGED",
          batchId: batch.id,
          metadata: { retentionDays: REGISTRY_IMPORT_RETENTION_DAYS },
        }),
      });
      await transaction.importBatch.update({
        where: { id: batch.id },
        data: { purgedAt: now, version: { increment: 1 } },
      });
      return true;
    }, registryImportTransactionOptions);
    if (didPurge) purged += 1;
  }
  return { purged };
}

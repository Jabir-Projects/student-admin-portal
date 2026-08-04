import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  FINANCE_IMPORT_MAX_ROWS,
  FINANCE_RETENTION_DAYS,
  FINANCE_SOURCE_SYSTEM,
  financeImportBatchIdSchema,
  financeRejectionReasonSchema,
  ledgerEffect,
} from "@/features/finance/schemas";
import type {
  ActorSessionClaims,
  AuthorizationFailure,
} from "@/server/auth/capabilities";
import {
  loadCapabilityActor,
  revalidateCapabilityActorInTransaction,
} from "@/server/auth/capabilities.node";
import { financeAuditEvent } from "@/server/finance/audit-events";
import {
  FinanceImportParseError,
  parseFinanceImport,
  type ParsedFinanceImport,
} from "@/server/finance/parser.node";

type Failure =
  | AuthorizationFailure
  | "INVALID_FILE"
  | "DUPLICATE_FILE"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "NOT_OWNER"
  | "SELF_REVIEW"
  | "INVALID_TRANSITION"
  | "INVALID_BATCH"
  | "STALE_BATCH"
  | "PURGED"
  | "DUPLICATE_TRANSACTION"
  | "ALREADY_REVERSED"
  | "INVALID_REVERSAL";
export type FinanceWorkflowResult =
  | {
      ok: true;
      status:
        "VALIDATED" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "REVERSED";
      batchId?: string;
    }
  | { ok: false; reason: Failure; errorCode?: string };
const transactionOptions = { maxWait: 15_000, timeout: 30_000 } as const;
function expiresAt(value: Date) {
  const result = new Date(value);
  result.setUTCDate(result.getUTCDate() + FINANCE_RETENTION_DAYS);
  return result;
}
async function lockBatch(
  transaction: Prisma.TransactionClient,
  batchId: string,
) {
  await transaction.$queryRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`finance-import:${batchId}`}, 0::bigint))::text AS "lock"`,
  );
  await transaction.$queryRaw(
    Prisma.sql`SELECT "id" FROM "FinanceImportBatch" WHERE "id" = CAST(${batchId} AS UUID) FOR UPDATE`,
  );
}
async function stageStudents(
  parsed: ParsedFinanceImport,
  database: PrismaClient,
) {
  const studentNumbers = parsed.rows.flatMap((row) =>
    row.value ? [row.value.studentNumber] : [],
  );
  const students = studentNumbers.length
    ? await database.studentProfile.findMany({
        where: { studentNumber: { in: studentNumbers } },
        select: { id: true, studentNumber: true },
      })
    : [];
  const byNumber = new Map(
    students.map((student) => [student.studentNumber, student.id]),
  );
  return parsed.rows.map((row) =>
    row.value && !byNumber.has(row.value.studentNumber)
      ? {
          ...row,
          value: null,
          studentId: null,
          errors: [...row.errors, "STUDENT_NOT_FOUND" as const],
        }
      : {
          ...row,
          studentId: row.value ? byNumber.get(row.value.studentNumber)! : null,
        },
  );
}
export async function uploadFinanceImportAsActor(
  claims: ActorSessionClaims,
  file: { bytes: Uint8Array; filename: string; mimeType: string },
  database: PrismaClient,
): Promise<FinanceWorkflowResult> {
  const authorized = await loadCapabilityActor(
    claims,
    "FINANCE_IMPORT_UPLOAD",
    database,
  );
  if (!authorized.ok) return authorized;
  let parsed: ParsedFinanceImport;
  try {
    parsed = await parseFinanceImport(file);
  } catch (error) {
    return {
      ok: false,
      reason: "INVALID_FILE",
      ...(error instanceof FinanceImportParseError
        ? { errorCode: error.code }
        : {}),
    };
  }
  const rows = await stageStudents(parsed, database);
  const validRows = rows.filter((row) => !row.errors.length).length;
  const uploadedAt = new Date();
  try {
    return await database.$transaction(async (transaction) => {
      const authorization = await revalidateCapabilityActorInTransaction(
        transaction,
        claims,
        "FINANCE_IMPORT_UPLOAD",
      );
      if (!authorization.ok) return authorization;
      const batch = await transaction.financeImportBatch.create({
        data: {
          status: "UPLOADED",
          uploaderId: authorization.actor.id,
          checksum: parsed.checksum,
          originalFilename: parsed.originalFilename,
          originalByteSize: parsed.originalByteSize,
          totalRows: rows.length,
          validRows,
          invalidRows: rows.length - validRows,
          uploadedAt,
          expiresAt: expiresAt(uploadedAt),
          rows: {
            create: rows.map((row) => ({
              rowNumber: row.rowNumber,
              studentNumber: row.value?.studentNumber,
              studentId: row.studentId,
              entryType: row.value?.entryType,
              amountMinor: row.value?.amountMinor,
              currency: row.value?.currency,
              effectiveDate: row.value
                ? new Date(`${row.value.effectiveDate}T00:00:00.000Z`)
                : undefined,
              postingDate: row.value
                ? new Date(`${row.value.postingDate}T00:00:00.000Z`)
                : undefined,
              billingPeriod: row.value?.billingPeriod,
              term: row.value?.term,
              sourceSystem: row.value?.sourceSystem,
              externalTransactionId: row.value?.externalTransactionId,
              sourceReference: row.value?.sourceReference,
              description: row.value?.description,
              validation: row.errors.length ? "INVALID" : "VALID",
              errorCodes: row.errors,
            })),
          },
        },
        select: { id: true },
      });
      await transaction.auditLog.create({
        data: financeAuditEvent({
          actorId: authorization.actor.id,
          action: "FINANCE_IMPORT_UPLOADED",
          entityType: "FinanceImportBatch",
          entityId: batch.id,
          metadata: {
            sourceType: parsed.sourceType,
            totalRows: rows.length,
            validRows,
            invalidRows: rows.length - validRows,
          },
        }),
      });
      if (validRows === rows.length) {
        await transaction.auditLog.create({
          data: financeAuditEvent({
            actorId: authorization.actor.id,
            action: "FINANCE_IMPORT_VALIDATED",
            entityType: "FinanceImportBatch",
            entityId: batch.id,
            metadata: { totalRows: rows.length },
          }),
        });
        await transaction.financeImportBatch.update({
          where: { id: batch.id },
          data: {
            status: "VALIDATED",
            validatedAt: uploadedAt,
            version: { increment: 1 },
          },
        });
      }
      return { ok: true, status: "VALIDATED", batchId: batch.id };
    }, transactionOptions);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return { ok: false, reason: "DUPLICATE_FILE" };
    throw error;
  }
}
export async function submitFinanceImportAsActor(
  claims: ActorSessionClaims,
  batchIdInput: unknown,
  database: PrismaClient,
): Promise<FinanceWorkflowResult> {
  const batchId = financeImportBatchIdSchema.safeParse(batchIdInput);
  if (!batchId.success) return { ok: false, reason: "INVALID_INPUT" };
  return database.$transaction(async (transaction) => {
    const authorization = await revalidateCapabilityActorInTransaction(
      transaction,
      claims,
      "FINANCE_IMPORT_UPLOAD",
    );
    if (!authorization.ok) return authorization;
    await lockBatch(transaction, batchId.data);
    const batch = await transaction.financeImportBatch.findUnique({
      where: { id: batchId.data },
    });
    if (!batch) return { ok: false, reason: "NOT_FOUND" };
    if (batch.uploaderId !== authorization.actor.id)
      return { ok: false, reason: "NOT_OWNER" };
    if (batch.purgedAt) return { ok: false, reason: "PURGED" };
    if (
      batch.status !== "VALIDATED" ||
      batch.totalRows > FINANCE_IMPORT_MAX_ROWS ||
      batch.invalidRows ||
      batch.validRows !== batch.totalRows
    )
      return { ok: false, reason: "INVALID_BATCH" };
    await transaction.auditLog.create({
      data: financeAuditEvent({
        actorId: authorization.actor.id,
        action: "FINANCE_IMPORT_SUBMITTED",
        entityType: "FinanceImportBatch",
        entityId: batch.id,
        metadata: { totalRows: batch.totalRows },
      }),
    });
    await transaction.financeImportBatch.update({
      where: { id: batch.id },
      data: {
        status: "PENDING_APPROVAL",
        submittedAt: new Date(),
        version: { increment: 1 },
      },
    });
    return { ok: true, status: "PENDING_APPROVAL", batchId: batch.id };
  }, transactionOptions);
}
export async function approveFinanceImportAsActor(
  claims: ActorSessionClaims,
  batchIdInput: unknown,
  database: PrismaClient,
): Promise<FinanceWorkflowResult> {
  const batchId = financeImportBatchIdSchema.safeParse(batchIdInput);
  if (!batchId.success) return { ok: false, reason: "INVALID_INPUT" };
  try {
    return await database.$transaction(async (transaction) => {
      const authorization = await revalidateCapabilityActorInTransaction(
        transaction,
        claims,
        "FINANCE_IMPORT_APPROVE",
      );
      if (!authorization.ok) return authorization;
      await lockBatch(transaction, batchId.data);
      const batch = await transaction.financeImportBatch.findUnique({
        where: { id: batchId.data },
        include: { rows: { orderBy: { rowNumber: "asc" } } },
      });
      if (!batch) return { ok: false, reason: "NOT_FOUND" };
      if (batch.uploaderId === authorization.actor.id)
        return { ok: false, reason: "SELF_REVIEW" };
      if (batch.purgedAt) return { ok: false, reason: "PURGED" };
      if (batch.status !== "PENDING_APPROVAL")
        return { ok: false, reason: "INVALID_TRANSITION" };
      if (
        batch.invalidRows ||
        batch.validRows !== batch.totalRows ||
        batch.rows.length !== batch.totalRows ||
        batch.rows.some(
          (row) =>
            row.validation !== "VALID" ||
            !row.studentId ||
            !row.entryType ||
            !row.amountMinor ||
            row.currency !== "MAD" ||
            !row.effectiveDate ||
            !row.postingDate ||
            !row.billingPeriod ||
            !row.term ||
            row.sourceSystem !== FINANCE_SOURCE_SYSTEM ||
            !row.externalTransactionId ||
            !row.sourceReference,
        )
      )
        return { ok: false, reason: "STALE_BATCH" };
      const currentStudents = await transaction.studentProfile.findMany({
        where: { id: { in: batch.rows.map((row) => row.studentId!) } },
        select: { id: true },
      });
      if (
        currentStudents.length !==
        new Set(batch.rows.map((row) => row.studentId)).size
      )
        return { ok: false, reason: "STALE_BATCH" };
      const prior = await transaction.financeTransaction.count({
        where: {
          sourceSystem: FINANCE_SOURCE_SYSTEM,
          externalTransactionId: {
            in: batch.rows.map((row) => row.externalTransactionId!),
          },
        },
      });
      if (prior) return { ok: false, reason: "DUPLICATE_TRANSACTION" };
      const accountByStudent = new Map<string, string>();
      for (const row of batch.rows) {
        const account = await transaction.studentFinanceAccount.upsert({
          where: { studentId: row.studentId! },
          create: { studentId: row.studentId! },
          update: {},
          select: { id: true },
        });
        accountByStudent.set(row.studentId!, account.id);
      }
      const postedAt = new Date();
      await transaction.financeTransaction.createMany({
        data: batch.rows.map((row) => ({
          accountId: accountByStudent.get(row.studentId!)!,
          entryType: row.entryType!,
          amountMinor: row.amountMinor!,
          ledgerEffectMinor: ledgerEffect(
            row.entryType! as "CHARGE" | "PAYMENT" | "CREDIT" | "REFUND",
            row.amountMinor!,
          ),
          currency: "MAD",
          effectiveDate: row.effectiveDate!,
          postedAt: row.postingDate!,
          billingPeriod: row.billingPeriod!,
          term: row.term!,
          sourceSystem: FINANCE_SOURCE_SYSTEM,
          externalTransactionId: row.externalTransactionId!,
          sourceReference: row.sourceReference!,
          description: row.description ?? "",
          importBatchId: batch.id,
          createdById: batch.uploaderId,
          appliedById: authorization.actor.id,
        })),
      });
      const affected = await transaction.studentProfile.findMany({
        where: { id: { in: [...accountByStudent.keys()] } },
        select: { id: true, userId: true },
      });
      for (const student of affected)
        await transaction.notification.upsert({
          where: {
            eventKey: `finance:batch:${batch.id}:student:${student.id}`,
          },
          create: {
            userId: student.userId,
            eventType: "FINANCE_BALANCE_UPDATED",
            eventKey: `finance:batch:${batch.id}:student:${student.id}`,
            title: "Finance balance updated",
            body: "Your finance statement has been updated. Review it in the student portal.",
          },
          update: {},
        });
      await transaction.auditLog.create({
        data: financeAuditEvent({
          actorId: authorization.actor.id,
          action: "FINANCE_IMPORT_APPROVED",
          entityType: "FinanceImportBatch",
          entityId: batch.id,
          metadata: { status: "APPROVED", transactionCount: batch.totalRows },
        }),
      });
      await transaction.financeImportBatch.update({
        where: { id: batch.id },
        data: {
          status: "APPROVED",
          reviewerId: authorization.actor.id,
          reviewedAt: postedAt,
          appliedAt: postedAt,
          expiresAt: postedAt,
          version: { increment: 1 },
        },
      });
      return { ok: true, status: "APPROVED", batchId: batch.id };
    }, transactionOptions);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return { ok: false, reason: "DUPLICATE_TRANSACTION" };
    throw error;
  }
}
export async function rejectFinanceImportAsActor(
  claims: ActorSessionClaims,
  input: { batchId: unknown; reason: unknown },
  database: PrismaClient,
): Promise<FinanceWorkflowResult> {
  const batchId = financeImportBatchIdSchema.safeParse(input.batchId);
  const reason = financeRejectionReasonSchema.safeParse(input.reason);
  if (!batchId.success || !reason.success)
    return { ok: false, reason: "INVALID_INPUT" };
  return database.$transaction(async (transaction) => {
    const authorization = await revalidateCapabilityActorInTransaction(
      transaction,
      claims,
      "FINANCE_IMPORT_APPROVE",
    );
    if (!authorization.ok) return authorization;
    await lockBatch(transaction, batchId.data);
    const batch = await transaction.financeImportBatch.findUnique({
      where: { id: batchId.data },
    });
    if (!batch) return { ok: false, reason: "NOT_FOUND" };
    if (batch.uploaderId === authorization.actor.id)
      return { ok: false, reason: "SELF_REVIEW" };
    if (batch.status !== "PENDING_APPROVAL" || batch.purgedAt)
      return { ok: false, reason: "INVALID_TRANSITION" };
    const now = new Date();
    await transaction.auditLog.create({
      data: financeAuditEvent({
        actorId: authorization.actor.id,
        action: "FINANCE_IMPORT_REJECTED",
        entityType: "FinanceImportBatch",
        entityId: batch.id,
        metadata: { status: "REJECTED" },
      }),
    });
    await transaction.financeImportBatch.update({
      where: { id: batch.id },
      data: {
        status: "REJECTED",
        reviewerId: authorization.actor.id,
        rejectionReason: reason.data,
        reviewedAt: now,
        version: { increment: 1 },
      },
    });
    return { ok: true, status: "REJECTED", batchId: batch.id };
  }, transactionOptions);
}

export async function reverseFinanceTransactionAsActor(
  claims: ActorSessionClaims,
  input: { transactionId: unknown; reason: unknown; studentId?: unknown },
  database: PrismaClient,
): Promise<FinanceWorkflowResult> {
  const transactionId = financeImportBatchIdSchema.safeParse(
    input.transactionId,
  );
  const reason = financeRejectionReasonSchema.safeParse(input.reason);
  const studentId =
    input.studentId === undefined
      ? undefined
      : financeImportBatchIdSchema.safeParse(input.studentId);
  if (
    !transactionId.success ||
    !reason.success ||
    (studentId && !studentId.success)
  )
    return { ok: false, reason: "INVALID_INPUT" };
  try {
    return await database.$transaction(async (transaction) => {
      const authorization = await revalidateCapabilityActorInTransaction(
        transaction,
        claims,
        "FINANCE_IMPORT_APPROVE",
      );
      if (!authorization.ok) return authorization;
      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "FinanceTransaction" WHERE "id" = CAST(${transactionId.data} AS UUID) FOR UPDATE`,
      );
      const original = await transaction.financeTransaction.findUnique({
        where: { id: transactionId.data },
        include: {
          account: {
            include: { student: { select: { id: true, userId: true } } },
          },
          reversal: true,
        },
      });
      if (
        !original ||
        (studentId && original.account.student.id !== studentId.data)
      )
        return { ok: false, reason: "NOT_FOUND" };
      if (original.entryType === "REVERSAL")
        return { ok: false, reason: "INVALID_REVERSAL" };
      if (original.reversal) return { ok: true, status: "REVERSED" };
      const reversal = await transaction.financeTransaction.create({
        data: {
          accountId: original.accountId,
          entryType: "REVERSAL",
          amountMinor: original.amountMinor,
          ledgerEffectMinor: -original.ledgerEffectMinor,
          currency: original.currency,
          effectiveDate: original.effectiveDate,
          billingPeriod: original.billingPeriod,
          term: original.term,
          sourceSystem: FINANCE_SOURCE_SYSTEM,
          externalTransactionId: `REVERSAL-${original.id}`,
          sourceReference: original.sourceReference,
          description: original.description,
          originalTransactionId: original.id,
          createdById: authorization.actor.id,
          appliedById: authorization.actor.id,
          reversedById: authorization.actor.id,
          reversalReason: reason.data,
        },
      });
      await transaction.auditLog.create({
        data: financeAuditEvent({
          actorId: authorization.actor.id,
          action: "FINANCE_REVERSAL_CREATED",
          entityType: "FinanceTransaction",
          entityId: reversal.id,
          metadata: {
            entryType: "REVERSAL",
            billingPeriod: original.billingPeriod,
          },
        }),
      });
      await transaction.notification.upsert({
        where: { eventKey: `finance:reversal:${original.id}` },
        create: {
          userId: original.account.student.userId,
          eventType: "FINANCE_BALANCE_UPDATED",
          eventKey: `finance:reversal:${original.id}`,
          title: "Finance balance updated",
          body: "Your finance statement has been updated. Review it in the student portal.",
        },
        update: {},
      });
      return { ok: true, status: "REVERSED" };
    }, transactionOptions);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return { ok: true, status: "REVERSED" };
    throw error;
  }
}

export async function purgeExpiredFinanceImportStaging(
  database: PrismaClient,
  now = new Date(),
  limit = 100,
): Promise<number> {
  return database.$transaction(async (transaction) => {
    const batches = await transaction.financeImportBatch.findMany({
      where: {
        status: { in: ["UPLOADED", "VALIDATED", "REJECTED", "FAILED"] },
        purgedAt: null,
        expiresAt: { lte: now },
      },
      orderBy: { expiresAt: "asc" },
      take: Math.min(Math.max(limit, 1), 100),
      select: { id: true, uploaderId: true },
    });
    let purged = 0;
    for (const batch of batches) {
      await lockBatch(transaction, batch.id);
      const result = await transaction.financeImportBatch.updateMany({
        where: {
          id: batch.id,
          status: { in: ["UPLOADED", "VALIDATED", "REJECTED", "FAILED"] },
          purgedAt: null,
        },
        data: { purgedAt: now, version: { increment: 1 } },
      });
      if (result.count) {
        await transaction.financeImportRow.deleteMany({
          where: { batchId: batch.id },
        });
        await transaction.auditLog.create({
          data: financeAuditEvent({
            actorId: batch.uploaderId,
            action: "FINANCE_STAGING_PURGED",
            entityType: "FinanceImportBatch",
            entityId: batch.id,
            metadata: { status: "PURGED" },
          }),
        });
        purged += 1;
      }
    }
    return purged;
  }, transactionOptions);
}

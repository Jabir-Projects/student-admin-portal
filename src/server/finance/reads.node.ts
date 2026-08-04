import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type {
  ActorSessionClaims,
  AuthorizationFailure,
} from "@/server/auth/capabilities";
import { loadCapabilityActor } from "@/server/auth/capabilities.node";
import { authorizeStudentActor } from "@/server/student-portal/authorization.node";

type Failure = {
  ok: false;
  reason: AuthorizationFailure | "NOT_FOUND" | "INVALID_INPUT";
};
const posted = {
  orderBy: [{ postedAt: "desc" as const }, { id: "desc" as const }],
  select: {
    id: true,
    entryType: true,
    amountMinor: true,
    ledgerEffectMinor: true,
    currency: true,
    effectiveDate: true,
    postedAt: true,
    billingPeriod: true,
    term: true,
    sourceReference: true,
    description: true,
  },
};
function balance(rows: readonly { ledgerEffectMinor: bigint }[]) {
  return rows.reduce((total, row) => total + row.ledgerEffectMinor, BigInt(0));
}
export async function readStudentFinance(
  claims: ActorSessionClaims,
  database: PrismaClient,
) {
  const actor = await authorizeStudentActor(claims, database);
  if (!actor.ok) return actor;
  const account = await database.studentFinanceAccount.findUnique({
    where: { studentId: actor.actor.profileId },
    select: { transactions: posted },
  });
  const transactions = account?.transactions ?? [];
  return {
    ok: true as const,
    balanceMinor: balance(transactions),
    transactions,
  };
}
export async function readStaffStudentFinance(
  claims: ActorSessionClaims,
  studentId: unknown,
  database: PrismaClient,
) {
  if (typeof studentId !== "string" || !/^[0-9a-f-]{36}$/iu.test(studentId))
    return { ok: false, reason: "INVALID_INPUT" } as Failure;
  const actor = await loadCapabilityActor(claims, "VIEW_FINANCE", database);
  if (!actor.ok) return actor;
  const student = await database.studentProfile.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      studentNumber: true,
      financeAccount: { select: { transactions: posted } },
    },
  });
  if (!student) return { ok: false, reason: "NOT_FOUND" } as Failure;
  const transactions = student.financeAccount?.transactions ?? [];
  return {
    ok: true as const,
    actor: actor.actor,
    student: { id: student.id, studentNumber: student.studentNumber },
    balanceMinor: balance(transactions),
    transactions,
  };
}
export async function searchStaffFinance(
  claims: ActorSessionClaims,
  query: unknown,
  database: PrismaClient,
) {
  const actor = await loadCapabilityActor(claims, "VIEW_FINANCE", database);
  if (!actor.ok) return actor;
  const value = typeof query === "string" ? query.trim().slice(0, 50) : "";
  const students = await database.studentProfile.findMany({
    where: value
      ? {
          studentNumber: {
            contains: value,
            mode: Prisma.QueryMode.insensitive,
          },
        }
      : {},
    take: 50,
    orderBy: { studentNumber: "asc" },
    select: {
      id: true,
      studentNumber: true,
      financeAccount: {
        select: { transactions: { select: { ledgerEffectMinor: true } } },
      },
    },
  });
  return {
    ok: true as const,
    actor: actor.actor,
    students: students.map((student) => ({
      id: student.id,
      studentNumber: student.studentNumber,
      balanceMinor: balance(student.financeAccount?.transactions ?? []),
    })),
  };
}

const batchSelect = {
  id: true,
  status: true,
  originalFilename: true,
  totalRows: true,
  validRows: true,
  invalidRows: true,
  uploadedAt: true,
  purgedAt: true,
  uploaderId: true,
} as const;
export async function listFinanceImportBatches(
  claims: ActorSessionClaims,
  database: PrismaClient,
) {
  const upload = await loadCapabilityActor(
    claims,
    "FINANCE_IMPORT_UPLOAD",
    database,
  );
  const review = await loadCapabilityActor(
    claims,
    "FINANCE_IMPORT_APPROVE",
    database,
  );
  if (!upload.ok && !review.ok) return upload;
  const actor = upload.ok ? upload.actor : review.ok ? review.actor : null;
  if (!actor)
    return { ok: false as const, reason: "MISSING_CAPABILITY" as const };
  const batches = await database.financeImportBatch.findMany({
    where: review.ok ? {} : { uploaderId: actor.id },
    orderBy: [{ uploadedAt: "desc" }, { id: "desc" }],
    take: 50,
    select: batchSelect,
  });
  return {
    ok: true as const,
    actor,
    canUpload: upload.ok,
    canApprove: review.ok,
    batches,
  };
}
export async function getFinanceImportBatch(
  claims: ActorSessionClaims,
  batchId: unknown,
  database: PrismaClient,
) {
  if (typeof batchId !== "string" || !/^[0-9a-f-]{36}$/iu.test(batchId))
    return { ok: false as const, reason: "INVALID_INPUT" as const };
  const upload = await loadCapabilityActor(
    claims,
    "FINANCE_IMPORT_UPLOAD",
    database,
  );
  const review = await loadCapabilityActor(
    claims,
    "FINANCE_IMPORT_APPROVE",
    database,
  );
  if (!upload.ok && !review.ok) return upload;
  const actor = upload.ok ? upload.actor : review.ok ? review.actor : null;
  if (!actor)
    return { ok: false as const, reason: "MISSING_CAPABILITY" as const };
  const batch = await database.financeImportBatch.findUnique({
    where: { id: batchId },
    select: {
      ...batchSelect,
      reviewerId: true,
      rejectionReason: true,
      rows: {
        orderBy: { rowNumber: "asc" },
        take: 100,
        select: {
          rowNumber: true,
          studentNumber: true,
          entryType: true,
          amountMinor: true,
          currency: true,
          effectiveDate: true,
          postingDate: true,
          billingPeriod: true,
          term: true,
          sourceReference: true,
          description: true,
          validation: true,
          errorCodes: true,
        },
      },
    },
  });
  if (!batch || (!review.ok && batch.uploaderId !== actor.id))
    return { ok: false as const, reason: "NOT_FOUND" as const };
  return {
    ok: true as const,
    actor,
    canUpload: upload.ok,
    canApprove: review.ok,
    batch,
  };
}

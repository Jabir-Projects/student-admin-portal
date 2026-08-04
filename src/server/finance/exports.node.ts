import "server-only";

import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { encodeCsv } from "@/server/administration/exports.node";
import type {
  ActorSessionClaims,
  AuthorizationFailure,
} from "@/server/auth/capabilities";
import { revalidateCapabilityActorInTransaction } from "@/server/auth/capabilities.node";
import { financeAuditEvent } from "@/server/finance/audit-events";
import { revalidateStudentActorInTransaction } from "@/server/student-portal/authorization.node";

const dates = z
  .object({ from: z.string().date(), to: z.string().date() })
  .refine(({ from, to }) => {
    const days =
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86400000;
    return days >= 0 && days <= 366;
  });
const optionalDates = z
  .object({
    from: z.string().date().optional(),
    to: z.string().date().optional(),
  })
  .refine((value) => Boolean(value.from) === Boolean(value.to));
function currentPeriodRange(now = new Date()) {
  const year = now.getUTCFullYear();
  const start = now.getUTCMonth() >= 7 ? year : year - 1;
  return { from: `${start}-08-01`, to: `${start + 1}-07-31` };
}
type Result =
  | { ok: true; filename: string; body: string }
  | { ok: false; reason: AuthorizationFailure | "INVALID_INPUT" };
const columns = [
  "student_number",
  "billing_period",
  "term",
  "effective_date",
  "posting_date",
  "entry_type",
  "amount_minor",
  "currency",
  "source_reference",
  "external_transaction_id",
];
export async function exportStudentFinanceStatement(
  claims: ActorSessionClaims,
  input: unknown,
  db: PrismaClient,
): Promise<Result> {
  const supplied = optionalDates.safeParse(input);
  if (!supplied.success) return { ok: false, reason: "INVALID_INPUT" };
  const parsed = dates.safeParse(
    supplied.data.from ? supplied.data : currentPeriodRange(),
  );
  if (!parsed.success) return { ok: false, reason: "INVALID_INPUT" };
  return db.$transaction(async (tx) => {
    const actor = await revalidateStudentActorInTransaction(tx, claims);
    if (!actor.ok) return actor;
    const rows = await tx.financeTransaction.findMany({
      where: {
        account: { studentId: actor.actor.profileId },
        effectiveDate: {
          gte: new Date(`${parsed.data.from}T00:00:00Z`),
          lte: new Date(`${parsed.data.to}T23:59:59Z`),
        },
      },
      orderBy: [{ postedAt: "desc" }, { id: "desc" }],
      take: 10000,
      select: {
        billingPeriod: true,
        term: true,
        effectiveDate: true,
        postedAt: true,
        entryType: true,
        amountMinor: true,
        currency: true,
        sourceReference: true,
        description: true,
      },
    });
    await tx.auditLog.create({
      data: financeAuditEvent({
        actorId: actor.actor.id,
        action: "FINANCE_STUDENT_EXPORTED",
        entityType: "StudentFinanceAccount",
        entityId: actor.actor.profileId,
        metadata: {
          from: parsed.data.from,
          to: parsed.data.to,
          rowCount: rows.length,
        },
      }),
    });
    return {
      ok: true,
      filename: "sist-finance-statement.csv",
      body: encodeCsv([
        [
          "billing_period",
          "term",
          "effective_date",
          "posting_date",
          "entry_type",
          "amount_minor",
          "currency",
          "source_reference",
          "description",
        ],
        ...rows.map((r) => [
          r.billingPeriod,
          r.term,
          r.effectiveDate.toISOString().slice(0, 10),
          r.postedAt.toISOString(),
          r.entryType,
          r.amountMinor,
          r.currency,
          r.sourceReference,
          r.description,
        ]),
      ]),
    };
  });
}
export async function exportStaffFinance(
  claims: ActorSessionClaims,
  input: unknown,
  db: PrismaClient,
): Promise<Result> {
  const supplied = optionalDates.safeParse(input);
  if (!supplied.success) return { ok: false, reason: "INVALID_INPUT" };
  const parsed = dates.safeParse(
    supplied.data.from ? supplied.data : currentPeriodRange(),
  );
  if (!parsed.success) return { ok: false, reason: "INVALID_INPUT" };
  return db.$transaction(async (tx) => {
    const actor = await revalidateCapabilityActorInTransaction(
      tx,
      claims,
      "EXPORT_FINANCE_DATA",
    );
    if (!actor.ok) return actor;
    const rows = await tx.financeTransaction.findMany({
      where: {
        effectiveDate: {
          gte: new Date(`${parsed.data.from}T00:00:00Z`),
          lte: new Date(`${parsed.data.to}T23:59:59Z`),
        },
      },
      orderBy: [{ effectiveDate: "asc" }, { id: "asc" }],
      take: 10000,
      select: {
        billingPeriod: true,
        term: true,
        effectiveDate: true,
        postedAt: true,
        entryType: true,
        amountMinor: true,
        currency: true,
        sourceReference: true,
        externalTransactionId: true,
        account: { select: { student: { select: { studentNumber: true } } } },
      },
    });
    await tx.auditLog.create({
      data: financeAuditEvent({
        actorId: actor.actor.id,
        action: "FINANCE_STAFF_EXPORTED",
        entityType: "FinanceTransaction",
        entityId: "synchronous-csv",
        metadata: {
          from: parsed.data.from,
          to: parsed.data.to,
          rowCount: rows.length,
        },
      }),
    });
    return {
      ok: true,
      filename: "sist-finance-export.csv",
      body: encodeCsv([
        columns,
        ...rows.map((r) => [
          r.account.student.studentNumber,
          r.billingPeriod,
          r.term,
          r.effectiveDate.toISOString().slice(0, 10),
          r.postedAt.toISOString(),
          r.entryType,
          r.amountMinor,
          r.currency,
          r.sourceReference,
          r.externalTransactionId,
        ]),
      ]),
    };
  });
}

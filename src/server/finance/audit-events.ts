import "server-only";

import type { Prisma } from "@/generated/prisma/client";

export type FinanceAuditAction =
  | "FINANCE_IMPORT_UPLOADED"
  | "FINANCE_IMPORT_VALIDATED"
  | "FINANCE_IMPORT_SUBMITTED"
  | "FINANCE_IMPORT_APPROVED"
  | "FINANCE_IMPORT_REJECTED"
  | "FINANCE_REVERSAL_CREATED"
  | "FINANCE_STAFF_EXPORTED"
  | "FINANCE_STUDENT_EXPORTED"
  | "FINANCE_STAGING_PURGED";

export function financeAuditEvent(input: {
  actorId: string;
  action: FinanceAuditAction;
  entityType:
    "FinanceImportBatch" | "FinanceTransaction" | "StudentFinanceAccount";
  entityId: string;
  metadata: Prisma.InputJsonObject;
}) {
  return input;
}

import { z } from "zod";

export const FINANCE_SOURCE_SYSTEM = "SIST_FINANCE_OFFICIAL";
export const FINANCE_IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const FINANCE_IMPORT_MAX_ROWS = 5_000;
export const FINANCE_RETENTION_DAYS = 30;
export const FINANCE_REQUIRED_HEADERS = [
  "source_system",
  "external_transaction_id",
  "student_number",
  "entry_type",
  "amount_minor",
  "currency",
  "effective_date",
  "posting_date",
  "billing_period",
  "source_reference",
] as const;
export const FINANCE_OPTIONAL_HEADERS = ["term", "description"] as const;

export const financeEntryTypes = [
  "CHARGE",
  "PAYMENT",
  "CREDIT",
  "REFUND",
] as const;
export const financeTerms = [
  "ANNUAL",
  "SEMESTER_1",
  "SEMESTER_2",
  "SUMMER",
] as const;
export type FinanceEntryType = (typeof financeEntryTypes)[number];
export type FinanceTerm = (typeof financeTerms)[number];

export const financeImportErrorCodes = [
  "EMPTY_ROW",
  "INVALID_SOURCE_SYSTEM",
  "INVALID_EXTERNAL_TRANSACTION_ID",
  "INVALID_STUDENT_NUMBER",
  "INVALID_ENTRY_TYPE",
  "INVALID_AMOUNT",
  "INVALID_CURRENCY",
  "INVALID_EFFECTIVE_DATE",
  "INVALID_POSTING_DATE",
  "INVALID_BILLING_PERIOD",
  "INVALID_TERM",
  "INVALID_SOURCE_REFERENCE",
  "INVALID_DESCRIPTION",
  "UNSAFE_CELL",
  "DUPLICATE_EXTERNAL_TRANSACTION_ID",
  "STUDENT_NOT_FOUND",
] as const;
export type FinanceImportErrorCode = (typeof financeImportErrorCodes)[number];

const safeText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !/[\u0000-\u001F\u007F]/u.test(value));

export const billingPeriodSchema = z
  .string()
  .regex(/^\d{4}-\d{4}$/u)
  .refine((value) => Number(value.slice(5)) === Number(value.slice(0, 4)) + 1);
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).refine(
  (value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)),
);
export const amountMinorSchema = z
  .string()
  .regex(/^[1-9]\d*$/u)
  .transform((value) => BigInt(value))
  .refine((value) => value <= BigInt("9223372036854775807"));
export const financeImportBatchIdSchema = z.uuid();
export const financeRejectionReasonSchema = z.string().trim().min(3).max(1000);

export type FinanceImportNormalizedRow = {
  sourceSystem: typeof FINANCE_SOURCE_SYSTEM;
  externalTransactionId: string;
  studentNumber: string;
  entryType: FinanceEntryType;
  amountMinor: bigint;
  currency: "MAD";
  effectiveDate: string;
  postingDate: string;
  billingPeriod: string;
  sourceReference: string;
  term: FinanceTerm;
  description: string;
};

export function ledgerEffect(entryType: FinanceEntryType, amountMinor: bigint) {
  return entryType === "CHARGE" || entryType === "REFUND"
    ? amountMinor
    : -amountMinor;
}

export function validateFinanceImportRow(input: Record<string, string>):
  | { ok: true; value: FinanceImportNormalizedRow }
  | { ok: false; errors: FinanceImportErrorCode[] } {
  if (Object.values(input).every((value) => value.trim() === ""))
    return { ok: false, errors: ["EMPTY_ROW"] };
  const errors = new Set<FinanceImportErrorCode>();
  const sourceSystem = (input.source_system ?? "").trim();
  const externalTransactionId = safeText(160).safeParse(input.external_transaction_id ?? "");
  const studentNumber = safeText(50).safeParse(input.student_number ?? "");
  const entryType = z.enum(financeEntryTypes).safeParse((input.entry_type ?? "").trim().toUpperCase());
  const amountMinor = amountMinorSchema.safeParse((input.amount_minor ?? "").trim());
  const effectiveDate = isoDateSchema.safeParse((input.effective_date ?? "").trim());
  const postingDate = isoDateSchema.safeParse((input.posting_date ?? "").trim());
  const billingPeriod = billingPeriodSchema.safeParse((input.billing_period ?? "").trim());
  const sourceReference = safeText(200).safeParse(input.source_reference ?? "");
  const term = z.enum(financeTerms).safeParse(((input.term ?? "").trim() || "ANNUAL").toUpperCase());
  const description = z.string().trim().max(1000).safeParse(input.description ?? "");
  if (sourceSystem !== FINANCE_SOURCE_SYSTEM) errors.add("INVALID_SOURCE_SYSTEM");
  if (!externalTransactionId.success) errors.add("INVALID_EXTERNAL_TRANSACTION_ID");
  if (!studentNumber.success) errors.add("INVALID_STUDENT_NUMBER");
  if (!entryType.success) errors.add("INVALID_ENTRY_TYPE");
  if (!amountMinor.success) errors.add("INVALID_AMOUNT");
  if ((input.currency ?? "").trim() !== "MAD") errors.add("INVALID_CURRENCY");
  if (!effectiveDate.success) errors.add("INVALID_EFFECTIVE_DATE");
  if (!postingDate.success) errors.add("INVALID_POSTING_DATE");
  if (!billingPeriod.success) errors.add("INVALID_BILLING_PERIOD");
  if (!sourceReference.success) errors.add("INVALID_SOURCE_REFERENCE");
  if (!term.success) errors.add("INVALID_TERM");
  if (!description.success) errors.add("INVALID_DESCRIPTION");
  if (errors.size || !externalTransactionId.success || !studentNumber.success || !entryType.success || !amountMinor.success || !effectiveDate.success || !postingDate.success || !billingPeriod.success || !sourceReference.success || !term.success || !description.success)
    return { ok: false, errors: [...errors] };
  return { ok: true, value: { sourceSystem: FINANCE_SOURCE_SYSTEM, externalTransactionId: externalTransactionId.data, studentNumber: studentNumber.data, entryType: entryType.data, amountMinor: amountMinor.data, currency: "MAD", effectiveDate: effectiveDate.data, postingDate: postingDate.data, billingPeriod: billingPeriod.data, sourceReference: sourceReference.data, term: term.data, description: description.data } };
}

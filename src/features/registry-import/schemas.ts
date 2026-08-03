import { z } from "zod";

import { ACADEMIC_YEARS, PROGRAMS } from "@/features/auth/constants";
import { normalizeFullName } from "@/features/auth/normalization";
import { studentRegistryEntrySchema } from "@/features/student-registry/schemas";

export const REGISTRY_IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const REGISTRY_IMPORT_MAX_ROWS = 5_000;
export const REGISTRY_IMPORT_PAGE_SIZE = 25;
export const REGISTRY_IMPORT_MAX_PAGE_SIZE = 50;
export const REGISTRY_IMPORT_RETENTION_DAYS = 30;

export const REGISTRY_IMPORT_REQUIRED_HEADERS = [
  "student_number",
  "full_name",
  "email",
  "program",
  "academic_year",
] as const;
export const REGISTRY_IMPORT_OPTIONAL_HEADERS = ["status"] as const;

export const registryImportErrorCodes = [
  "EMPTY_ROW",
  "INVALID_STUDENT_NUMBER",
  "INVALID_FULL_NAME",
  "INVALID_EMAIL",
  "INVALID_PROGRAM",
  "INVALID_ACADEMIC_YEAR",
  "INVALID_STATUS",
  "UNSAFE_CELL",
  "DUPLICATE_STUDENT_NUMBER",
  "DUPLICATE_EMAIL",
  "EMAIL_CONFLICT",
] as const;

export type RegistryImportErrorCode = (typeof registryImportErrorCodes)[number];

const statusSchema = z.enum(["ACTIVE", "INACTIVE"]);

function comparisonKey(value: string): string {
  return normalizeFullName(value).toLocaleLowerCase("en-US");
}

const programByKey = new Map(
  PROGRAMS.map((program) => [comparisonKey(program), program]),
);
const academicYearByKey = new Map<
  string,
  (typeof ACADEMIC_YEARS)[number]["value"]
>();
for (const academicYear of ACADEMIC_YEARS) {
  academicYearByKey.set(comparisonKey(academicYear.value), academicYear.value);
  academicYearByKey.set(comparisonKey(academicYear.label), academicYear.value);
  academicYearByKey.set(
    comparisonKey(academicYear.value.replaceAll("_", " ")),
    academicYear.value,
  );
}

export type RegistryImportNormalizedRow = {
  studentNumber: string;
  fullName: string;
  normalizedFullName: string;
  email: string;
  program: (typeof PROGRAMS)[number];
  academicYear: (typeof ACADEMIC_YEARS)[number]["value"];
  status: "ACTIVE" | "INACTIVE";
};

export type RegistryImportRawRow = {
  studentNumber: string;
  fullName: string;
  email: string;
  program: string;
  academicYear: string;
  status: string;
};

export type RegistryImportRowValidation =
  | { ok: true; value: RegistryImportNormalizedRow }
  | { ok: false; errors: RegistryImportErrorCode[] };

function issueCode(path: PropertyKey | undefined): RegistryImportErrorCode {
  switch (path) {
    case "studentNumber":
      return "INVALID_STUDENT_NUMBER";
    case "fullName":
      return "INVALID_FULL_NAME";
    case "email":
      return "INVALID_EMAIL";
    case "program":
      return "INVALID_PROGRAM";
    case "academicYear":
      return "INVALID_ACADEMIC_YEAR";
    default:
      return "INVALID_FULL_NAME";
  }
}

export function validateRegistryImportRow(
  row: RegistryImportRawRow,
): RegistryImportRowValidation {
  if (Object.values(row).every((value) => value.trim().length === 0)) {
    return { ok: false, errors: ["EMPTY_ROW"] };
  }

  const program = programByKey.get(comparisonKey(row.program));
  const academicYear = academicYearByKey.get(comparisonKey(row.academicYear));
  const statusValue = row.status.trim().toUpperCase() || "ACTIVE";
  const status = statusSchema.safeParse(statusValue);
  const registry = studentRegistryEntrySchema.safeParse({
    studentNumber: row.studentNumber,
    fullName: row.fullName,
    email: row.email,
    program: program ?? row.program,
    academicYear: academicYear ?? row.academicYear,
  });

  const errors = new Set<RegistryImportErrorCode>();
  if (!program) errors.add("INVALID_PROGRAM");
  if (!academicYear) errors.add("INVALID_ACADEMIC_YEAR");
  if (!status.success) errors.add("INVALID_STATUS");
  if (!registry.success) {
    for (const issue of registry.error.issues)
      errors.add(issueCode(issue.path[0]));
  }
  if (
    errors.size > 0 ||
    !registry.success ||
    !status.success ||
    !program ||
    !academicYear
  ) {
    return { ok: false, errors: [...errors].slice(0, 8) };
  }

  return {
    ok: true,
    value: {
      ...registry.data,
      program,
      academicYear,
      status: status.data,
    },
  };
}

export const registryImportBatchIdSchema = z.uuid();
export const registryImportRejectionReasonSchema = z
  .string()
  .transform((value) => normalizeFullName(value))
  .pipe(z.string().min(3).max(500));

export const registryImportPageSchema = z.coerce
  .number()
  .int()
  .min(1)
  .default(1);

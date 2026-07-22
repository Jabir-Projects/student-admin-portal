export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeStudentNumber(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizeFullName(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ");
}

export function normalizeFullNameComparisonKey(value: string): string {
  return normalizeFullName(value).toLowerCase();
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeStudentNumber(value: string): string {
  return value.trim().toUpperCase();
}

export function normalizeFullName(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

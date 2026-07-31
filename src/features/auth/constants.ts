export const PROGRAMS = [
  "Foundation Year",
  "BAC+3 Business Management - International Trade",
  "BAC+3 Business Management - Marketing Management",
  "BAC+3 Business Management - Human Resources management",
  "BAC+3 Computer Security",
  "BAC+3 Sports Management",
  "BAC+3 Software Engineering",
  "BAC+3 Business Management - Finance Management",
  "BAC+5 Digital Marketing",
  "BAC+5 Accounting & finance",
  "BAC+5 - Advanced Cyber Security",
  "BAC+5 Business Administration",
  "BAC+5 TESOL Programme",
] as const;

export const ACADEMIC_YEARS = [
  { value: "FOUNDATION", label: "Foundation" },
  { value: "YEAR_1", label: "Year 1" },
  { value: "YEAR_2", label: "Year 2" },
  { value: "YEAR_3", label: "Year 3" },
  { value: "MASTER_1", label: "Master 1" },
  { value: "MASTER_2", label: "Master 2" },
] as const;

export const USER_ROLES = ["STUDENT", "STAFF"] as const;
export const ACCOUNT_STATUSES = [
  "PENDING_APPROVAL",
  "ACTIVE",
  "DISABLED",
] as const;
export const CAPABILITIES = [
  "MANAGE_STUDENT_ACCOUNTS",
  "REACTIVATE_STUDENT_ACCOUNTS",
  "MANAGE_STAFF_ACCOUNTS",
  "MANAGE_STAFF_CAPABILITIES",
  "PROCESS_REQUESTS",
  "MANAGE_REQUEST_CATEGORIES",
  "GENERATE_DOCUMENTS",
  "RELEASE_DOCUMENTS",
  "REVOKE_DOCUMENTS",
  "REGISTRY_IMPORT_UPLOAD",
  "REGISTRY_IMPORT_APPROVE",
  "FINANCE_IMPORT_UPLOAD",
  "FINANCE_IMPORT_APPROVE",
  "VIEW_FINANCE",
  "VIEW_AUDIT_LOG",
  "EXPORT_STUDENT_DATA",
  "EXPORT_REQUEST_DATA",
  "EXPORT_FINANCE_DATA",
] as const;

export type UserRoleValue = (typeof USER_ROLES)[number];
export type AccountStatusValue = (typeof ACCOUNT_STATUSES)[number];
export type CapabilityValue = (typeof CAPABILITIES)[number];

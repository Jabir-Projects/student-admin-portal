import type { CapabilityValue } from "@/features/auth/constants";

export type StaffNavigationIcon =
  | "audit"
  | "dashboard"
  | "documents"
  | "finance"
  | "imports"
  | "profile"
  | "request-categories"
  | "requests"
  | "settings"
  | "staff"
  | "students";

export type StaffNavigationItem = {
  key: string;
  label: string;
  href: string;
  icon: StaffNavigationIcon;
  available: boolean;
  requiredCapabilities?: readonly CapabilityValue[];
};

const staffNavigation: readonly StaffNavigationItem[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/staff",
    icon: "dashboard",
    available: true,
  },
  {
    key: "student-accounts",
    label: "Student Accounts",
    href: "/staff/student-accounts",
    icon: "students",
    available: true,
    requiredCapabilities: [
      "MANAGE_STUDENT_ACCOUNTS",
      "REACTIVATE_STUDENT_ACCOUNTS",
      "EXPORT_STUDENT_DATA",
    ],
  },
  {
    key: "requests",
    label: "Requests",
    href: "/staff/requests",
    icon: "requests",
    available: true,
    requiredCapabilities: ["PROCESS_REQUESTS"],
  },
  {
    key: "request-categories",
    label: "Request Categories",
    href: "/staff/request-categories",
    icon: "request-categories",
    available: true,
    requiredCapabilities: ["MANAGE_REQUEST_CATEGORIES"],
  },
  {
    key: "documents",
    label: "Documents",
    href: "/staff/documents",
    icon: "documents",
    available: false,
    requiredCapabilities: [
      "GENERATE_DOCUMENTS",
      "RELEASE_DOCUMENTS",
      "REVOKE_DOCUMENTS",
    ],
  },
  {
    key: "imports",
    label: "Imports",
    href: "/staff/imports",
    icon: "imports",
    available: false,
    requiredCapabilities: [
      "REGISTRY_IMPORT_UPLOAD",
      "REGISTRY_IMPORT_APPROVE",
      "FINANCE_IMPORT_UPLOAD",
      "FINANCE_IMPORT_APPROVE",
    ],
  },
  {
    key: "finance",
    label: "Finance",
    href: "/staff/finance",
    icon: "finance",
    available: false,
    requiredCapabilities: ["VIEW_FINANCE", "EXPORT_FINANCE_DATA"],
  },
  {
    key: "audit",
    label: "Audit Log",
    href: "/staff/audit",
    icon: "audit",
    available: false,
    requiredCapabilities: ["VIEW_AUDIT_LOG"],
  },
  {
    key: "staff-capabilities",
    label: "Staff & Capabilities",
    href: "/staff/staff-capabilities",
    icon: "staff",
    available: true,
    requiredCapabilities: [
      "MANAGE_STAFF_ACCOUNTS",
      "MANAGE_STAFF_CAPABILITIES",
    ],
  },
  {
    key: "profile",
    label: "Profile",
    href: "/staff/profile",
    icon: "profile",
    available: false,
  },
  {
    key: "settings",
    label: "Settings",
    href: "/staff/settings",
    icon: "settings",
    available: false,
  },
];

export function getVisibleStaffNavigation(
  capabilities: readonly CapabilityValue[],
): StaffNavigationItem[] {
  const assignedCapabilities = new Set(capabilities);
  return staffNavigation.filter(
    (item) =>
      !item.requiredCapabilities ||
      item.requiredCapabilities.some((capability) =>
        assignedCapabilities.has(capability),
      ),
  );
}

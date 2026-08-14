import type { CapabilityValue } from "@/features/auth/constants";

const managerCapabilities = [
  "MANAGE_STUDENT_ACCOUNTS",
  "MANAGE_STAFF_ACCOUNTS",
  "MANAGE_STAFF_CAPABILITIES",
] as const satisfies readonly CapabilityValue[];

const documentCapabilities = [
  "GENERATE_DOCUMENTS",
  "RELEASE_DOCUMENTS",
  "REVOKE_DOCUMENTS",
] as const satisfies readonly CapabilityValue[];

const reviewerCapabilities = [
  "REGISTRY_IMPORT_APPROVE",
  "FINANCE_IMPORT_APPROVE",
] as const satisfies readonly CapabilityValue[];

export function getStaffIdentityLabel(
  capabilities: readonly CapabilityValue[],
): "Manager" | "Documents Staff" | "Reviewer" | "Staff member" {
  const assigned = new Set(capabilities);
  if (managerCapabilities.every((capability) => assigned.has(capability)))
    return "Manager";
  if (documentCapabilities.some((capability) => assigned.has(capability)))
    return "Documents Staff";
  if (reviewerCapabilities.some((capability) => assigned.has(capability)))
    return "Reviewer";
  return "Staff member";
}

export function getStaffQuickActions(capabilities: readonly CapabilityValue[]) {
  const assigned = new Set(capabilities);
  const actions: { href: string; label: string }[] = [];
  if (assigned.has("MANAGE_STUDENT_ACCOUNTS"))
    actions.push({
      href: "/staff/student-accounts",
      label: "Review student accounts",
    });
  if (assigned.has("PROCESS_REQUESTS"))
    actions.push({ href: "/staff/requests", label: "Process requests" });
  if (
    assigned.has("MANAGE_STAFF_ACCOUNTS") ||
    assigned.has("MANAGE_STAFF_CAPABILITIES")
  )
    actions.push({ href: "/staff/staff-capabilities", label: "Manage staff" });
  if (
    assigned.has("GENERATE_DOCUMENTS") ||
    assigned.has("RELEASE_DOCUMENTS") ||
    assigned.has("REVOKE_DOCUMENTS")
  )
    actions.push({ href: "/staff/documents", label: "Manage documents" });
  if (
    assigned.has("REGISTRY_IMPORT_UPLOAD") ||
    assigned.has("REGISTRY_IMPORT_APPROVE")
  )
    actions.push({
      href: "/staff/imports/registry",
      label: "Review registry imports",
    });
  if (
    assigned.has("FINANCE_IMPORT_UPLOAD") ||
    assigned.has("FINANCE_IMPORT_APPROVE")
  )
    actions.push({
      href: "/staff/finance/imports",
      label: "Review finance imports",
    });
  return actions;
}

import { describe, expect, it } from "vitest";

import type { CapabilityValue } from "@/features/auth/constants";
import { getVisibleStaffNavigation } from "@/features/staff/navigation";

function labelsFor(capabilities: readonly CapabilityValue[]) {
  return getVisibleStaffNavigation(capabilities).map(({ label }) => label);
}

describe("STAFF capability-aware navigation", () => {
  it("keeps a zero-capability STAFF account inside the safe shell", () => {
    expect(labelsFor([])).toEqual(["Dashboard", "Profile", "Settings"]);
  });

  it.each([
    ["MANAGE_STUDENT_ACCOUNTS", "Student Accounts"],
    ["REACTIVATE_STUDENT_ACCOUNTS", "Student Accounts"],
    ["PROCESS_REQUESTS", "Requests"],
    ["MANAGE_REQUEST_CATEGORIES", "Request Categories"],
    ["GENERATE_DOCUMENTS", "Documents"],
    ["RELEASE_DOCUMENTS", "Documents"],
    ["REVOKE_DOCUMENTS", "Documents"],
    ["REGISTRY_IMPORT_UPLOAD", "Imports"],
    ["REGISTRY_IMPORT_APPROVE", "Imports"],
    ["VIEW_FINANCE", "Finance"],
    ["EXPORT_FINANCE_DATA", "Finance"],
    ["VIEW_AUDIT_LOG", "Audit Log"],
    ["MANAGE_STAFF_ACCOUNTS", "Staff & Capabilities"],
    ["MANAGE_STAFF_CAPABILITIES", "Staff & Capabilities"],
  ] as const)(
    "shows %s only through its mapped module",
    (capability, label) => {
      const labels = labelsFor([capability]);
      expect(labels).toContain(label);
      expect(labels).toContain("Dashboard");
      expect(labels).toContain("Profile");
      expect(labels).toContain("Settings");
      expect(labels).toHaveLength(4);
    },
  );

  it("locates the approved student export on the student account module", () => {
    expect(labelsFor(["EXPORT_STUDENT_DATA"])).toEqual([
      "Dashboard",
      "Student Accounts",
      "Profile",
      "Settings",
    ]);
  });

  it("does not expose the PROCESS_REQUESTS queue to request-export-only STAFF", () => {
    expect(labelsFor(["EXPORT_REQUEST_DATA"])).toEqual([
      "Dashboard",
      "Profile",
      "Settings",
    ]);
  });

  it("activates Package D for either STAFF management capability", () => {
    expect(labelsFor(["MANAGE_STAFF_ACCOUNTS"])).toContain(
      "Staff & Capabilities",
    );
    expect(labelsFor(["MANAGE_STAFF_CAPABILITIES"])).toContain(
      "Staff & Capabilities",
    );
  });
});

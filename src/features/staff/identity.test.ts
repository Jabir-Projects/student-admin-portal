import { describe, expect, it } from "vitest";

import {
  getStaffIdentityLabel,
  getStaffQuickActions,
} from "@/features/staff/identity";

describe("staff presentation identity", () => {
  it("uses capability assignments only to derive friendly labels", () => {
    expect(
      getStaffIdentityLabel([
        "MANAGE_STUDENT_ACCOUNTS",
        "MANAGE_STAFF_ACCOUNTS",
        "MANAGE_STAFF_CAPABILITIES",
      ]),
    ).toBe("Manager");
    expect(getStaffIdentityLabel(["GENERATE_DOCUMENTS"])).toBe(
      "Documents Staff",
    );
    expect(getStaffIdentityLabel(["FINANCE_IMPORT_APPROVE"])).toBe("Reviewer");
    expect(getStaffIdentityLabel([])).toBe("Staff member");
  });

  it("returns only routes authorized by the assigned capabilities", () => {
    expect(getStaffQuickActions(["GENERATE_DOCUMENTS"])).toEqual([
      { href: "/staff/documents", label: "Manage documents" },
    ]);
    expect(getStaffQuickActions(["FINANCE_IMPORT_APPROVE"])).toEqual([
      { href: "/staff/finance/imports", label: "Review finance imports" },
    ]);
  });
});

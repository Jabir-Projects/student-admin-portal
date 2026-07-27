import { describe, expect, it } from "vitest";

import { CAPABILITIES, USER_ROLES } from "@/features/auth/constants";

describe("V2-3 authorization constants", () => {
  it("retains STUDENT and temporary ADMIN while adding STAFF", () => {
    expect(USER_ROLES).toEqual(["STUDENT", "STAFF", "ADMIN"]);
  });

  it("defines exactly the approved capability catalog", () => {
    expect(CAPABILITIES).toEqual([
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
    ]);
  });
});

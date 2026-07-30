import { describe, expect, it } from "vitest";

import {
  accountManagementActionIntentSchema,
  accountReferenceSchema,
  capabilityNameSchema,
  managedStudentReadInputSchema,
  staffAccountActionInputSchema,
  staffAccountPageQuerySchema,
  staffInventoryReadInputSchema,
  studentAccountPageQuerySchema,
} from "@/features/account-management/schemas";
import { CAPABILITIES } from "@/features/auth/constants";

describe("Package D runtime schemas", () => {
  it("defaults pagination to 25 and normalizes search whitespace", () => {
    expect(
      managedStudentReadInputSchema.parse({
        search: "  Sara \n   Ali  ",
      }),
    ).toEqual({
      search: "Sara Ali",
      page: 1,
      pageSize: 25,
    });
  });

  it("accepts the maximum page size and rejects invalid pagination", () => {
    expect(
      staffInventoryReadInputSchema.parse({ page: 2, pageSize: 50 }),
    ).toMatchObject({ page: 2, pageSize: 50 });
    expect(() => staffInventoryReadInputSchema.parse({ page: 0 })).toThrow();
    expect(() =>
      staffInventoryReadInputSchema.parse({ pageSize: 51 }),
    ).toThrow();
    expect(() =>
      staffInventoryReadInputSchema.parse({ pageSize: 1.5 }),
    ).toThrow();
  });

  it("limits normalized search and rejects unknown fields", () => {
    expect(() =>
      managedStudentReadInputSchema.parse({ search: "x".repeat(101) }),
    ).toThrow();
    expect(() =>
      managedStudentReadInputSchema.parse({ orderBy: "email" }),
    ).toThrow();
  });

  it("accepts only approved status filters", () => {
    expect(
      managedStudentReadInputSchema.parse({ status: "PENDING_APPROVAL" })
        .status,
    ).toBe("PENDING_APPROVAL");
    expect(() =>
      managedStudentReadInputSchema.parse({ status: "DISABLED" }),
    ).toThrow();
    expect(() =>
      staffInventoryReadInputSchema.parse({ status: "PENDING_APPROVAL" }),
    ).toThrow();
  });

  it("validates the exact approved capability set", () => {
    for (const capability of CAPABILITIES) {
      expect(capabilityNameSchema.parse(capability)).toBe(capability);
    }
    expect(() => capabilityNameSchema.parse("ADMIN_BYPASS")).toThrow();
  });

  it("provides strict future action intent discriminators", () => {
    expect(accountManagementActionIntentSchema.parse("approve-student")).toBe(
      "approve-student",
    );
    expect(() =>
      accountManagementActionIntentSchema.parse("delete-account"),
    ).toThrow();
  });

  it("rejects malformed opaque references", () => {
    expect(accountReferenceSchema.safeParse("raw-database-id").success).toBe(
      false,
    );
  });

  it("validates D3 search, status filters, and bounded query pagination", () => {
    expect(studentAccountPageQuerySchema.parse({})).toEqual({
      search: "",
      status: "all",
      page: 1,
      pageSize: 25,
    });
    expect(
      studentAccountPageQuerySchema.parse({
        search: "  SIST-001 ",
        status: "disabled",
        page: "2",
        pageSize: "50",
      }),
    ).toEqual({
      search: "SIST-001",
      status: "disabled",
      page: 2,
      pageSize: 50,
    });
    expect(() =>
      studentAccountPageQuerySchema.parse({ pageSize: "51" }),
    ).toThrow();
    expect(() =>
      studentAccountPageQuerySchema.parse({ status: "staff" }),
    ).toThrow();
    expect(() =>
      studentAccountPageQuerySchema.parse({ search: ["one", "two"] }),
    ).toThrow();
  });

  it("validates D4 lifecycle intents and full-name inventory queries", () => {
    expect(
      staffAccountActionInputSchema.parse({
        intent: "disable-staff",
        accountReference: "acct2.encrypted-reference",
      }),
    ).toEqual({
      intent: "disable-staff",
      accountReference: "acct2.encrypted-reference",
    });
    expect(() =>
      staffAccountActionInputSchema.parse({
        intent: "grant-capability",
        accountReference: "acct2.encrypted-reference",
      }),
    ).toThrow();
    expect(
      staffAccountActionInputSchema.parse({
        intent: "grant-capability",
        accountReference: "acct2.encrypted-reference",
        capability: "VIEW_AUDIT_LOG",
      }),
    ).toMatchObject({
      intent: "grant-capability",
      capability: "VIEW_AUDIT_LOG",
    });
    expect(() =>
      staffAccountActionInputSchema.parse({
        intent: "grant-capability",
        accountReference: "acct2.encrypted-reference",
        capability: "UNRECOGNIZED_CAPABILITY",
      }),
    ).toThrow();
    expect(
      staffAccountActionInputSchema.parse({
        intent: "create-staff",
        fullName: "  Sara   Amrani ",
        email: " SARA@EXAMPLE.COM ",
        password: "strong-password",
        capabilities: ["MANAGE_STAFF_ACCOUNTS"],
      }),
    ).toMatchObject({
      intent: "create-staff",
      fullName: "Sara Amrani",
      email: "sara@example.com",
    });
    expect(staffAccountPageQuerySchema.parse({})).toEqual({
      search: "",
      status: "all",
      page: 1,
      pageSize: 25,
    });
    expect(
      staffAccountPageQuerySchema.parse({
        search: "  Sara   Amrani ",
        status: "disabled",
        page: "2",
        pageSize: "50",
      }),
    ).toEqual({
      search: "Sara Amrani",
      status: "disabled",
      page: 2,
      pageSize: 50,
    });
    expect(() =>
      staffAccountPageQuerySchema.parse({ pageSize: "51" }),
    ).toThrow();
    expect(() =>
      staffAccountPageQuerySchema.parse({ status: "pending" }),
    ).toThrow();
    expect(() =>
      staffAccountPageQuerySchema.parse({ search: ["one", "two"] }),
    ).toThrow();
  });
});

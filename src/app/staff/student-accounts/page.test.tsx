import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  disabled: vi.fn(),
  managed: vi.fn(),
  redirect: vi.fn(),
  redirectFailure: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/server/auth/session-routing", () => ({
  redirectForAuthorizationFailure: mocks.redirectFailure,
}));
vi.mock("@/server/account-management/reads", () => ({
  authorizeAccountManagementPage: mocks.authorize,
  getDisabledStudentAccounts: mocks.disabled,
  getManagedStudentAccounts: mocks.managed,
}));
vi.mock("@/app/staff/student-accounts/actions", () => ({
  studentAccountAction: vi.fn(),
}));

import StudentAccountsPage from "@/app/staff/student-accounts/page";

function emptyResult() {
  return {
    ok: true,
    status: "empty",
    data: {
      page: 1,
      pageSize: 25,
      totalCount: 0,
      records: [],
    },
  } as const;
}

function allow(capabilities: string[]) {
  mocks.authorize.mockResolvedValue({
    ok: true,
    actor: {
      id: "staff-id",
      fullName: "Staff Member",
      role: "STAFF",
      status: "ACTIVE",
      sessionVersion: 4,
      capabilities,
    },
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("/staff/student-accounts", () => {
  it.each([
    [
      ["MANAGE_STUDENT_ACCOUNTS"],
      2,
      0,
      ["Pending student accounts", "Active student accounts"],
    ],
    [["REACTIVATE_STUDENT_ACCOUNTS"], 0, 1, ["Disabled student accounts"]],
    [
      ["MANAGE_STUDENT_ACCOUNTS", "REACTIVATE_STUDENT_ACCOUNTS"],
      2,
      1,
      [
        "Pending student accounts",
        "Active student accounts",
        "Disabled student accounts",
      ],
    ],
  ] as const)(
    "isolates section reads and presentation for %j",
    async (capabilities, managedCalls, disabledCalls, headings) => {
      allow([...capabilities]);
      mocks.managed.mockResolvedValue(emptyResult());
      mocks.disabled.mockResolvedValue(emptyResult());

      render(
        await StudentAccountsPage({
          searchParams: Promise.resolve({}),
        }),
      );

      expect(mocks.managed).toHaveBeenCalledTimes(managedCalls);
      expect(mocks.disabled).toHaveBeenCalledTimes(disabledCalls);
      for (const heading of headings) {
        expect(
          screen.getByRole("heading", { level: 2, name: heading }),
        ).toBeInTheDocument();
      }
    },
  );

  it.each([
    [{ ok: false, reason: "MISSING_CAPABILITY" }, "zero capabilities"],
    [{ ok: false, reason: "WRONG_ROLE" }, "legacy ADMIN"],
  ])("denies page entry for %s", async (authorization) => {
    mocks.authorize.mockResolvedValue(authorization);
    mocks.redirectFailure.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      StudentAccountsPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.managed).not.toHaveBeenCalled();
    expect(mocks.disabled).not.toHaveBeenCalled();
  });

  it("uses normalized search, status-aware filtering, and bounded pagination", async () => {
    allow(["MANAGE_STUDENT_ACCOUNTS"]);
    mocks.managed.mockResolvedValue(emptyResult());

    render(
      await StudentAccountsPage({
        searchParams: Promise.resolve({
          search: "  SIST-2401 ",
          status: "active",
          page: "2",
          pageSize: "50",
        }),
      }),
    );

    expect(mocks.managed).toHaveBeenCalledOnce();
    expect(mocks.managed).toHaveBeenCalledWith({
      search: "SIST-2401",
      status: "ACTIVE",
      page: 2,
      pageSize: 50,
    });
    expect(mocks.disabled).not.toHaveBeenCalled();
    expect(
      screen.getByText("Page 2 · Up to 50 per section"),
    ).toBeInTheDocument();
  });

  it("shows a safe invalid-query state without reading account data", async () => {
    allow(["MANAGE_STUDENT_ACCOUNTS"]);
    render(
      await StudentAccountsPage({
        searchParams: Promise.resolve({ pageSize: "51" }),
      }),
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Invalid student account filters",
      }),
    ).toBeInTheDocument();
    expect(mocks.managed).not.toHaveBeenCalled();
    expect(mocks.disabled).not.toHaveBeenCalled();
  });

  it("does not allow one page-entry capability to select another section", async () => {
    allow(["REACTIVATE_STUDENT_ACCOUNTS"]);
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
    await expect(
      StudentAccountsPage({
        searchParams: Promise.resolve({ status: "pending" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/unauthorized");
    expect(mocks.managed).not.toHaveBeenCalled();
  });
});

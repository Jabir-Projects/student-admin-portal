import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  capabilities: vi.fn(),
  inventory: vi.fn(),
  redirectFailure: vi.fn(),
}));

vi.mock("@/server/auth/session-routing", () => ({
  redirectForAuthorizationFailure: mocks.redirectFailure,
}));
vi.mock("@/server/account-management/reads", () => ({
  authorizeAccountManagementPage: mocks.authorize,
  getStaffCapabilityAssignments: mocks.capabilities,
  getStaffInventory: mocks.inventory,
}));
vi.mock("@/app/staff/staff-capabilities/actions", () => ({
  staffAccountAction: vi.fn(),
}));

import StaffCapabilitiesPage from "@/app/staff/staff-capabilities/page";

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

function allow(capabilities = ["MANAGE_STAFF_ACCOUNTS"]) {
  mocks.authorize.mockResolvedValue({
    ok: true,
    actor: {
      id: "staff-id",
      fullName: "STAFF Manager",
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

describe("/staff/staff-capabilities D4 inventory", () => {
  it.each([
    ["all", 2, ["Active STAFF accounts", "Disabled STAFF accounts"]],
    ["active", 1, ["Active STAFF accounts"]],
    ["disabled", 1, ["Disabled STAFF accounts"]],
  ] as const)("isolates %s section reads", async (status, calls, headings) => {
    allow();
    mocks.inventory.mockResolvedValue(emptyResult());
    mocks.capabilities.mockResolvedValue(emptyResult());
    render(
      await StaffCapabilitiesPage({
        searchParams: Promise.resolve({ status }),
      }),
    );

    expect(mocks.inventory).toHaveBeenCalledTimes(calls);
    for (const heading of headings) {
      expect(
        screen.getByRole("heading", { level: 2, name: heading }),
      ).toBeInTheDocument();
    }
    if (status !== "all") {
      const absent =
        status === "active"
          ? "Disabled STAFF accounts"
          : "Active STAFF accounts";
      expect(screen.queryByText(absent)).toBeNull();
    }
  });

  it("normalizes full-name search and applies bounded pagination", async () => {
    allow();
    mocks.inventory.mockResolvedValue(emptyResult());
    mocks.capabilities.mockResolvedValue(emptyResult());
    render(
      await StaffCapabilitiesPage({
        searchParams: Promise.resolve({
          search: "  Sara   Amrani ",
          status: "active",
          page: "2",
          pageSize: "50",
        }),
      }),
    );

    expect(mocks.inventory).toHaveBeenCalledWith({
      search: "Sara Amrani",
      status: "ACTIVE",
      page: 2,
      pageSize: 50,
    });
    expect(
      screen.getByText("Page 2 · Up to 50 per section"),
    ).toBeInTheDocument();
  });

  it("shows a safe invalid-query state without reading inventory", async () => {
    allow();
    render(
      await StaffCapabilitiesPage({
        searchParams: Promise.resolve({ pageSize: "51" }),
      }),
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Invalid STAFF account filters",
      }),
    ).toBeInTheDocument();
    expect(mocks.inventory).not.toHaveBeenCalled();
  });

  it.each([
    [{ ok: false, reason: "WRONG_ROLE" }, "legacy ADMIN"],
    [{ ok: false, reason: "DISABLED_ACCOUNT" }, "disabled actor"],
    [{ ok: false, reason: "STALE_SESSION" }, "stale actor"],
  ])("denies page entry for %s", async (authorization) => {
    mocks.authorize.mockResolvedValue(authorization);
    mocks.redirectFailure.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      StaffCapabilitiesPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.inventory).not.toHaveBeenCalled();
  });

  it.each([["MANAGE_STUDENT_ACCOUNTS"], ["EXPORT_STUDENT_DATA"]])(
    "denies a STAFF actor with only %s",
    async (capability) => {
      allow([capability]);
      mocks.redirectFailure.mockImplementation(() => {
        throw new Error("NEXT_REDIRECT");
      });

      await expect(
        StaffCapabilitiesPage({ searchParams: Promise.resolve({}) }),
      ).rejects.toThrow("NEXT_REDIRECT");
      expect(mocks.inventory).not.toHaveBeenCalled();
    },
  );

  it("allows a capability-only manager without exposing lifecycle controls", async () => {
    allow(["MANAGE_STAFF_CAPABILITIES"]);
    mocks.capabilities.mockResolvedValue(emptyResult());
    render(await StaffCapabilitiesPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("heading", { level: 1, name: "STAFF capabilities" }),
    ).toBeInTheDocument();
    expect(mocks.inventory).not.toHaveBeenCalled();
    expect(mocks.capabilities).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("heading", { name: "Create STAFF account" }),
    ).toBeNull();
  });

  it("keeps an independent read failure beside a successful empty section", async () => {
    allow();
    mocks.inventory
      .mockResolvedValueOnce({
        ok: false,
        status: "unavailable",
        reason: "READ_FAILED",
      })
      .mockResolvedValueOnce(emptyResult());
    mocks.capabilities.mockResolvedValue(emptyResult());
    render(await StaffCapabilitiesPage({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Active STAFF accounts unavailable",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No disabled STAFF accounts match this view."),
    ).toBeInTheDocument();
  });
});

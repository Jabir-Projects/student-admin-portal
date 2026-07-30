import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StaffCapabilityManagement } from "@/components/account-management/staff-capability-management";
import { StaffCreateForm } from "@/components/account-management/staff-create-form";
import { CAPABILITIES } from "@/features/auth/constants";

vi.mock("@/app/staff/staff-capabilities/actions", () => ({
  staffAccountAction: vi.fn(),
}));

afterEach(cleanup);

describe("Package D STAFF creation and capability presentation", () => {
  it("shows the complete approved capability set for an active STAFF account", () => {
    render(
      <StaffCapabilityManagement
        result={{
          ok: true,
          status: "success",
          data: {
            page: 1,
            pageSize: 25,
            totalCount: 1,
            records: [
              {
                accountReference: "acct2.encrypted-reference",
                fullName: "Sara Amrani",
                status: "ACTIVE",
                capabilities: ["VIEW_AUDIT_LOG"],
                isCurrentActor: false,
              },
            ],
          },
        }}
      />,
    );

    for (const capability of CAPABILITIES) {
      expect(screen.getByText(capability)).toBeInTheDocument();
    }
    expect(screen.getAllByRole("button")).toHaveLength(CAPABILITIES.length);
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(1);
  });

  it("prevents capability changes while the target account is disabled", () => {
    render(
      <StaffCapabilityManagement
        result={{
          ok: true,
          status: "success",
          data: {
            page: 1,
            pageSize: 25,
            totalCount: 1,
            records: [
              {
                accountReference: "acct2.encrypted-reference",
                fullName: "Sara Amrani",
                status: "DISABLED",
                capabilities: [],
                isCurrentActor: false,
              },
            ],
          },
        }}
      />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(CAPABILITIES.length);
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
    expect(
      screen.getByText(
        "Reactivate this STAFF account before changing its capabilities.",
      ),
    ).toBeInTheDocument();
  });

  it("exposes optional initial capabilities only to capability managers", () => {
    const { rerender } = render(
      <StaffCreateForm canAssignCapabilities={false} />,
    );
    expect(
      screen.getByRole("heading", { name: "Create STAFF account" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Initial capabilities" })).toBe(
      null,
    );

    rerender(<StaffCreateForm canAssignCapabilities />);
    expect(
      screen.getByRole("group", { name: "Initial capabilities" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(CAPABILITIES.length);
  });
});

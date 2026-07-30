import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { StaffAccountAction } from "@/components/account-management/staff-account-action";
import { StaffAccountManagement } from "@/components/account-management/staff-account-management";
import type { StaffAccountView } from "@/server/account-management/reads.node";

const mocks = vi.hoisted(() => ({
  action: vi.fn(),
}));

vi.mock("@/app/staff/staff-capabilities/actions", () => ({
  staffAccountAction: mocks.action,
}));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function staff(
  status: StaffAccountView["status"] = "ACTIVE",
): StaffAccountView {
  return {
    accountReference: "acct2.encrypted-staff-reference",
    fullName: "Sara Amrani",
    role: "STAFF",
    status,
    createdAt: new Date("2026-07-20T09:30:00Z"),
    disabledAt: status === "DISABLED" ? new Date("2026-07-22T09:30:00Z") : null,
    isCurrentActor: false,
  };
}

describe("D4 STAFF account presentation", () => {
  it("renders one h1, captioned desktop tables, mobile alternatives, and minimized fields", () => {
    const rawId = "40000000-0000-4000-8000-000000000001";
    const { container } = render(
      <StaffAccountManagement
        query={{ search: "", status: "all", page: 1, pageSize: 25 }}
        sections={[
          {
            kind: "active",
            result: {
              ok: true,
              status: "success",
              data: {
                page: 1,
                pageSize: 25,
                totalCount: 1,
                records: [staff()],
              },
            },
          },
          {
            kind: "disabled",
            result: {
              ok: true,
              status: "empty",
              data: {
                page: 1,
                pageSize: 25,
                totalCount: 0,
                records: [],
              },
            },
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "STAFF accounts" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const table = screen.getByRole("table", {
      name: "Active STAFF accounts available for lifecycle management",
    });
    expect(
      within(table).getByRole("rowheader", { name: "Sara Amrani" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("list")).getByRole("listitem"),
    ).toHaveTextContent("Sara Amrani");
    expect(
      screen.getByText("No disabled STAFF accounts match this view."),
    ).toBeInTheDocument();
    expect(container.textContent).not.toMatch(
      /email|password|sessionVersion|MANAGE_[A-Z_]+|audit metadata|private notes/iu,
    );
    expect(container.innerHTML).not.toContain(rawId);
  });

  it("requires strong disable confirmation with safe target identity", async () => {
    const user = userEvent.setup();
    render(
      <StaffAccountAction
        accountReference="acct2.encrypted-staff-reference"
        fullName="Sara Amrani"
        intent="disable-staff"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Disable Sara Amrani" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Disable STAFF account?",
    });
    expect(dialog).toHaveTextContent("destructive account action");
    expect(dialog).toHaveTextContent("lose portal access immediately");
    expect(dialog).toHaveTextContent("Sara Amrani");
    expect(
      within(dialog).getByRole("button", { name: "Disable account" }),
    ).toBeInTheDocument();
  });

  it.each([
    [
      "validation-error",
      "The submitted account action is invalid. Refresh and retry.",
    ],
    ["denied", "You are not authorized to perform this account action."],
    ["error", "The account action could not be completed. Refresh and retry."],
  ] as const)(
    "keeps accessible %s feedback inside the open dialog",
    async (status, message) => {
      mocks.action.mockResolvedValue({ status, message });
      const user = userEvent.setup();
      render(
        <StaffAccountAction
          accountReference="acct2.encrypted-staff-reference"
          fullName="Sara Amrani"
          intent="reactivate-staff"
        />,
      );

      await user.click(
        screen.getByRole("button", { name: "Reactivate Sara Amrani" }),
      );
      const dialog = screen.getByRole("dialog", {
        name: "Reactivate STAFF account?",
      });
      await user.click(
        within(dialog).getByRole("button", {
          name: "Confirm reactivation",
        }),
      );

      const feedback = await within(dialog).findByRole("alert");
      expect(feedback).toHaveTextContent(message);
      expect(feedback).toHaveAttribute("aria-live", "assertive");
      expect(dialog).toHaveAttribute("open");
      await waitFor(() => expect(feedback).toHaveFocus());
      expect(screen.queryByRole("status")).toBeNull();
    },
  );

  it("closes before publishing success feedback and clears it on reopen", async () => {
    mocks.action.mockResolvedValue({
      status: "success",
      message: "The STAFF account was reactivated.",
    });
    const closeDialog = HTMLDialogElement.prototype.close;
    const closeSpy = vi
      .spyOn(HTMLDialogElement.prototype, "close")
      .mockImplementation(function close(this: HTMLDialogElement) {
        expect(this).toHaveAttribute("open");
        expect(screen.queryByRole("status")).toBeNull();
        closeDialog.call(this);
      });
    const user = userEvent.setup();
    render(
      <StaffAccountAction
        accountReference="acct2.encrypted-staff-reference"
        fullName="Sara Amrani"
        intent="reactivate-staff"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Reactivate Sara Amrani" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Reactivate STAFF account?",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm reactivation" }),
    );

    const feedback = await screen.findByRole("status");
    expect(closeSpy).toHaveBeenCalledOnce();
    expect(dialog).not.toHaveAttribute("open");
    expect(feedback).toHaveTextContent("The STAFF account was reactivated.");
    closeSpy.mockRestore();

    await user.click(
      screen.getByRole("button", { name: "Reactivate Sara Amrani" }),
    );
    expect(dialog).toHaveAttribute("open");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("prevents duplicate submission while pending", async () => {
    mocks.action.mockImplementation(() => new Promise(() => undefined));
    const user = userEvent.setup();
    render(
      <StaffAccountAction
        accountReference="acct2.encrypted-staff-reference"
        fullName="Sara Amrani"
        intent="disable-staff"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Disable Sara Amrani" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Disable STAFF account?",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Disable account" }),
    );

    await waitFor(() => {
      expect(
        within(dialog).getByRole("button", { name: "Submitting…" }),
      ).toBeDisabled();
      expect(
        within(dialog).getByRole("button", { name: "Cancel" }),
      ).toBeDisabled();
    });
  });
});

import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { StudentAccountManagement } from "@/components/account-management/student-account-management";
import { StudentAccountAction } from "@/components/account-management/student-account-action";
import type { StudentAccountView } from "@/server/account-management/reads.node";

const mocks = vi.hoisted(() => ({
  action: vi.fn(),
}));

vi.mock("@/app/staff/student-accounts/actions", () => ({
  studentAccountAction: mocks.action,
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

function student(status: StudentAccountView["status"]): StudentAccountView {
  return {
    accountReference: "acct2.encrypted-student-reference",
    fullName: "Yasmine Idrissi",
    studentNumber: "SIST-2401",
    program: "Software Engineering",
    academicYear: "YEAR_2",
    status,
    createdAt: new Date("2026-07-20T09:30:00Z"),
    approvedAt: status === "ACTIVE" ? new Date("2026-07-21T09:30:00Z") : null,
    disabledAt: status === "DISABLED" ? new Date("2026-07-22T09:30:00Z") : null,
  };
}

describe("D3 student account presentation", () => {
  it("renders one h1, captioned desktop tables, mobile alternatives, and minimized fields", () => {
    const rawId = "40000000-0000-4000-8000-000000000001";
    const { container } = render(
      <StudentAccountManagement
        canManage
        canReactivate={false}
        query={{ search: "", status: "all", page: 1, pageSize: 25 }}
        sections={[
          {
            kind: "pending",
            result: {
              ok: true,
              status: "success",
              data: {
                page: 1,
                pageSize: 25,
                totalCount: 1,
                records: [student("PENDING_APPROVAL")],
              },
            },
          },
          {
            kind: "active",
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
      screen.getByRole("heading", { level: 1, name: "Student accounts" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const desktopTable = screen.getByRole("table", {
      name: "Pending student accounts awaiting review",
    });
    expect(
      within(desktopTable).getByRole("rowheader", {
        name: "Yasmine Idrissi",
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("list")).getByRole("listitem"),
    ).toHaveTextContent("Yasmine Idrissi");
    expect(
      screen.getByText("No active student accounts match this view."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Disabled student accounts")).toBeNull();
    expect(container.textContent).not.toMatch(
      /email|password|sessionVersion|registry|private notes/iu,
    );
    expect(container.innerHTML).not.toContain(rawId);
  });

  it("shows only the disabled section to a reactivation-only actor", () => {
    render(
      <StudentAccountManagement
        canManage={false}
        canReactivate
        query={{ search: "", status: "all", page: 1, pageSize: 25 }}
        sections={[
          {
            kind: "disabled",
            result: {
              ok: true,
              status: "success",
              data: {
                page: 1,
                pageSize: 25,
                totalCount: 1,
                records: [student("DISABLED")],
              },
            },
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Disabled student accounts",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Pending student accounts")).toBeNull();
    expect(screen.queryByText("Active student accounts")).toBeNull();
    expect(
      screen.getAllByRole("button", { name: "Reactivate Yasmine Idrissi" }),
    ).toHaveLength(2);
  });

  it("requires accessible confirmation with stronger disable wording", async () => {
    const user = userEvent.setup();
    render(
      <StudentAccountManagement
        canManage
        canReactivate={false}
        query={{ search: "", status: "active", page: 1, pageSize: 25 }}
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
                records: [student("ACTIVE")],
              },
            },
          },
        ]}
      />,
    );

    await user.click(
      screen.getAllByRole("button", {
        name: "Disable Yasmine Idrissi",
      })[0]!,
    );
    const dialog = screen.getByRole("dialog", {
      name: "Disable student account?",
    });
    expect(dialog).toHaveTextContent("destructive account action");
    expect(dialog).toHaveTextContent("lose access immediately");
    expect(
      within(dialog).getByRole("button", { name: "Disable account" }),
    ).toBeInTheDocument();
    within(dialog).getByRole("button", { name: "Cancel" }).focus();
    await user.keyboard("{Enter}");
    expect(dialog).not.toHaveAttribute("open");
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
        <StudentAccountAction
          accountReference="acct2.encrypted-student-reference"
          fullName="Yasmine Idrissi"
          intent="approve-student"
        />,
      );

      await user.click(
        screen.getByRole("button", { name: "Approve Yasmine Idrissi" }),
      );
      const dialog = screen.getByRole("dialog", {
        name: "Approve student account?",
      });
      await user.click(
        within(dialog).getByRole("button", { name: "Confirm approval" }),
      );

      const feedback = await within(dialog).findByRole("alert");
      expect(feedback).toHaveTextContent(message);
      expect(feedback).toHaveAttribute("aria-live", "assertive");
      expect(dialog).toHaveAttribute("open");
      await waitFor(() => expect(feedback).toHaveFocus());
      expect(screen.queryByRole("status")).toBeNull();
    },
  );

  it("closes after success before presenting external status feedback", async () => {
    mocks.action.mockResolvedValue({
      status: "success",
      message: "The student account was approved.",
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
      <StudentAccountAction
        accountReference="acct2.encrypted-student-reference"
        fullName="Yasmine Idrissi"
        intent="approve-student"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Approve Yasmine Idrissi" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Approve student account?",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm approval" }),
    );

    const feedback = await screen.findByRole("status");
    expect(closeSpy).toHaveBeenCalledOnce();
    expect(dialog).not.toHaveAttribute("open");
    expect(within(dialog).queryByRole("status")).toBeNull();
    expect(feedback).toHaveTextContent("The student account was approved.");
    closeSpy.mockRestore();

    await user.click(
      screen.getByRole("button", { name: "Approve Yasmine Idrissi" }),
    );
    expect(dialog).toHaveAttribute("open");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("disables confirmation controls while a mutation is pending", async () => {
    mocks.action.mockImplementation(() => new Promise(() => undefined));
    const user = userEvent.setup();
    render(
      <StudentAccountAction
        accountReference="acct2.encrypted-student-reference"
        fullName="Yasmine Idrissi"
        intent="approve-student"
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Approve Yasmine Idrissi" }),
    );
    const dialog = screen.getByRole("dialog", {
      name: "Approve student account?",
    });
    await user.click(
      within(dialog).getByRole("button", { name: "Confirm approval" }),
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

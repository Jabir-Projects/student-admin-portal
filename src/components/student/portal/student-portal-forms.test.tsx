import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { CancelRequestAction } from "@/components/student/portal/cancel-request-action";
import { RequestForm } from "@/components/student/portal/request-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/app/student/requests/new/actions", () => ({
  submitStudentRequestAction: vi.fn(),
}));

vi.mock("@/app/student/requests/[requestId]/actions", () => ({
  cancelStudentRequestAction: vi.fn(),
}));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
  };
});

describe("student portal forms", () => {
  it("renders the global delivery selector and approved submission limits", () => {
    render(
      <RequestForm
        categories={[
          {
            id: "98700000-0000-4000-8000-000000000001",
            name: "Enrollment certificate",
          },
        ]}
        selectedCategoryId="98700000-0000-4000-8000-000000000001"
      />,
    );

    expect(screen.getByRole("radio", { name: "Campus pickup" })).toBeChecked();
    expect(
      screen.getByRole("radio", { name: "Digital delivery" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("spinbutton", { name: "Number of copies" }),
    ).toHaveAttribute("min", "1");
    expect(
      screen.getByRole("spinbutton", { name: "Number of copies" }),
    ).toHaveAttribute("max", "5");
    expect(
      screen.getByRole("textbox", { name: /additional details/iu }),
    ).toHaveAttribute("maxlength", "1000");
  });

  it("opens an accessible irreversible cancellation confirmation", async () => {
    const user = userEvent.setup();
    render(
      <CancelRequestAction requestId="98800000-0000-4000-8000-000000000001" />,
    );
    await user.click(screen.getByRole("button", { name: "Cancel request" }));
    expect(
      screen.getByRole("dialog", { name: "Cancel this request?" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/iu)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirm cancellation" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Return" }));
    expect(
      screen.queryByRole("dialog", { name: "Cancel this request?" }),
    ).toBeNull();
  });
});

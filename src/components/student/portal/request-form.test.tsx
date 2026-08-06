import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/student/requests/new/actions", () => ({
  submitStudentRequestAction: vi.fn(),
}));

import { RequestForm } from "@/components/student/portal/request-form";

afterEach(cleanup);

describe("RequestForm", () => {
  it("renders the duplicate-request feedback returned by the server action", () => {
    render(
      <RequestForm
        categories={[{ id: "category-1", name: "Certificate" }]}
        result="DUPLICATE_OPEN_REQUEST"
      />,
    );

    expect(
      screen.getByText("You already have an open request in this category."),
    ).toBeVisible();
    expect(screen.getByRole("alert")).toHaveAttribute(
      "id",
      "request-form-error",
    );
  });

  it("uses a safe generic message for an unknown result code", () => {
    render(
      <RequestForm
        categories={[{ id: "category-1", name: "Certificate" }]}
        result="UNEXPECTED"
      />,
    );

    expect(
      screen.getByText(
        "The request could not be submitted. Check the fields and try again.",
      ),
    ).toBeVisible();
  });
});

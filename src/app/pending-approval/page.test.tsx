import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import PendingApprovalPage from "@/app/pending-approval/page";

afterEach(cleanup);

describe("pending approval access state", () => {
  it("uses the shared institutional state with one valid action", () => {
    render(<PendingApprovalPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Administrative approval pending",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Return to sign in" }),
    ).toHaveAttribute("href", "/login");
    expect(
      screen.queryByText(/database|capability|sessionVersion/iu),
    ).toBeNull();
  });
});

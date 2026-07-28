import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import UnauthorizedPage from "@/app/unauthorized/page";

afterEach(cleanup);

describe("unauthorized presentation", () => {
  it("presents authenticated permission denial as 403 with a safe continuation", () => {
    render(<UnauthorizedPage />);

    expect(screen.getByText("403")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Permission denied" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Return to your portal" }),
    ).toHaveAttribute("href", "/auth/continue");
    expect(screen.queryByText(/capability|sessionVersion/iu)).toBeNull();
  });
});

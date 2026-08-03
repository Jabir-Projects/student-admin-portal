import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import RegistryImportsError from "@/app/staff/imports/registry/error";
import RegistryImportsLoading from "@/app/staff/imports/registry/loading";

describe("V2-8 registry import route states", () => {
  it("announces a bounded loading state", () => {
    render(<RegistryImportsLoading />);
    expect(
      screen.getByRole("status", { name: "Loading registry imports" }),
    ).toHaveAttribute("aria-busy", "true");
  });

  it("shows a safe retryable error without internal details", () => {
    const reset = vi.fn();
    render(<RegistryImportsError reset={reset} />);
    expect(
      screen.getByRole("heading", { name: "Registry imports are unavailable" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no file or database details/iu),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});

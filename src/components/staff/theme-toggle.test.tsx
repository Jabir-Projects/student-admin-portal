import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ThemeToggle } from "@/components/staff/theme-toggle";

beforeEach(() => {
  document.documentElement.dataset.theme = "light";
  document.documentElement.style.colorScheme = "light";
  localStorage.clear();
});

afterEach(cleanup);

describe("ThemeToggle", () => {
  it("persists the selected dark theme", () => {
    render(<ThemeToggle />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Toggle light and dark theme",
      }),
    );

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(localStorage.getItem("sist-color-theme")).toBe("dark");
  });

  it("returns from dark to light", () => {
    document.documentElement.dataset.theme = "dark";
    render(<ThemeToggle />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Toggle light and dark theme",
      }),
    );

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("sist-color-theme")).toBe("light");
  });
});

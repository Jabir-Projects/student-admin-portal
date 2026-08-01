import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ThemeToggle } from "@/components/staff/theme-toggle";

beforeEach(() => {
  document.documentElement.dataset.theme = "light";
  document.documentElement.style.colorScheme = "light";
  localStorage.clear();
});

afterEach(cleanup);

describe("ThemeToggle", () => {
  it("persists the selected dark theme", async () => {
    render(<ThemeToggle />);

    const toggle = screen.getByRole("button", {
      name: "Toggle light and dark theme",
    });
    await waitFor(() => expect(toggle).toBeEnabled());
    fireEvent.click(toggle);

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(localStorage.getItem("sist-color-theme")).toBe("dark");
  });

  it("returns from dark to light", async () => {
    document.documentElement.dataset.theme = "dark";
    render(<ThemeToggle />);

    const toggle = screen.getByRole("button", {
      name: "Toggle light and dark theme",
    });
    await waitFor(() => expect(toggle).toBeEnabled());
    fireEvent.click(toggle);

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("sist-color-theme")).toBe("light");
  });
});

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SystemState } from "@/components/feedback/system-state";
import { AuthPanel, AuthShell } from "@/components/layout/auth-shell";
import { SiteHeader } from "@/components/layout/site-header";
import { StudentShell } from "@/components/student/student-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/student",
}));

vi.mock("@/app/logout/actions", () => ({
  logoutAction: vi.fn(),
}));

afterEach(cleanup);

describe("institutional public and authentication foundations", () => {
  it("uses the real SIST brand with valid public navigation", () => {
    render(<SiteHeader />);

    expect(
      screen.getByRole("img", {
        name: "SIST - Superior Institute of Science and Technology",
      }),
    ).toHaveAttribute("src", expect.stringContaining("sist-logo.jpg"));
    const navigation = screen.getByRole("navigation", {
      name: "Public navigation",
    });
    expect(
      within(navigation).getByRole("link", { name: "Sign in" }),
    ).toHaveAttribute("href", "/login");
    expect(
      within(navigation).getByRole("link", { name: "Register" }),
    ).toHaveAttribute("href", "/register");
  });

  it("provides one clear authentication heading and main landmark", () => {
    render(
      <AuthShell>
        <AuthPanel description="Secure access" title="Sign in">
          <button type="button">Continue</button>
        </AuthPanel>
      </AuthShell>,
    );

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Sign in" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });
});

describe("shared system states", () => {
  it.each([
    ["loading", "Loading portal"],
    ["empty", "Nothing here"],
    ["error", "Unable to load"],
    ["success", "Completed"],
    ["pending", "Approval pending"],
    ["disabled", "Account disabled"],
    ["session-ended", "Session ended"],
  ] as const)("renders the %s state safely", (kind, title) => {
    render(
      <SystemState
        description="A concise safe explanation."
        kind={kind}
        title={title}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: title }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/stack|database|sessionVersion/iu)).toBeNull();
  });
});

describe("student authenticated shell", () => {
  it("links only implemented V2-5 routes and keeps sign out outside navigation", () => {
    render(
      <StudentShell fullName="SIST Test Student" unreadNotificationCount={0}>
        <h1>Student dashboard</h1>
      </StudentShell>,
    );

    const navigations = screen.getAllByRole("navigation", {
      name: "Student navigation",
    });
    for (const navigation of navigations) {
      expect(
        within(navigation).getByRole("link", { name: "Dashboard" }),
      ).toHaveAttribute("href", "/student");
      expect(
        within(navigation).getByRole("link", { name: "My Requests" }),
      ).toHaveAttribute("href", "/student/requests");
      expect(
        within(navigation).getByRole("link", { name: "New Request" }),
      ).toHaveAttribute("href", "/student/requests/new");
      expect(
        within(navigation).getByRole("link", { name: "Profile" }),
      ).toHaveAttribute("href", "/student/profile");
      expect(
        within(navigation).queryByText(/help|logout|sign out/iu),
      ).toBeNull();
    }
    expect(screen.getByLabelText("Open account menu")).toBeInTheDocument();
  });

  it("closes on Escape and restores opener focus", async () => {
    const user = userEvent.setup();
    render(
      <StudentShell fullName="SIST Test Student" unreadNotificationCount={0}>
        <h1>Student dashboard</h1>
      </StudentShell>,
    );
    const opener = screen.getByRole("button", {
      name: "Open student navigation",
    });

    await user.click(opener);
    expect(
      screen.getByRole("dialog", { name: "Student navigation drawer" }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Student navigation drawer" }),
    ).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("renders student navigation in the shared viewport-height drawer", async () => {
    const user = userEvent.setup();
    render(
      <StudentShell fullName="SIST Test Student" unreadNotificationCount={0}>
        <h1>Student dashboard</h1>
      </StudentShell>,
    );

    await user.click(
      screen.getByRole("button", { name: "Open student navigation" }),
    );

    const drawer = screen.getByRole("dialog", {
      name: "Student navigation drawer",
    });
    expect(drawer).toHaveClass("fixed", "h-dvh", "z-10", "bg-sidebar");
    expect(
      within(drawer).getByRole("navigation", { name: "Student navigation" }),
    ).toBeInTheDocument();
    expect(within(drawer).queryByRole("heading", { name: "Student dashboard" }))
      .not.toBeInTheDocument();
  });
});

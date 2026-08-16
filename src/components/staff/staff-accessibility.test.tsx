import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MobileStaffNavigation } from "@/components/staff/staff-navigation";
import { AccountMenu } from "@/components/staff/staff-shell";
import type { StaffNavigationItem } from "@/features/staff/navigation";

vi.mock("next/navigation", () => ({
  usePathname: () => "/staff",
}));

vi.mock("@/app/logout/actions", () => ({
  logoutAction: vi.fn(),
}));

const navigation = [
  {
    key: "dashboard",
    label: "Dashboard",
    href: "/staff",
    icon: "dashboard",
    available: true,
  },
] satisfies readonly StaffNavigationItem[];

afterEach(cleanup);

describe("mobile STAFF navigation accessibility", () => {
  it("contains forward and backward keyboard focus inside the open drawer", async () => {
    const user = userEvent.setup();
    render(
      <>
        <button type="button">Background action</button>
        <MobileStaffNavigation
          branding={<span>SIST staff portal</span>}
          items={navigation}
        />
      </>,
    );

    await user.click(
      screen.getByRole("button", { name: "Open staff navigation" }),
    );
    const drawer = screen.getByRole("dialog", {
      name: "Staff navigation drawer",
    });
    const closeButton = within(drawer).getByRole("button", {
      name: "Close staff navigation",
    });
    const dashboardLink = within(drawer).getByRole("link", {
      name: "Dashboard",
    });

    expect(closeButton).toHaveFocus();
    dashboardLink.focus();
    await user.tab();
    expect(closeButton).toHaveFocus();
    await user.tab({ shift: true });
    expect(dashboardLink).toHaveFocus();
  });

  it("closes on Escape and restores focus to the drawer opener", async () => {
    const user = userEvent.setup();
    render(
      <MobileStaffNavigation
        branding={<span>SIST staff portal</span>}
        items={navigation}
      />,
    );
    const opener = screen.getByRole("button", {
      name: "Open staff navigation",
    });

    await user.click(opener);
    expect(
      screen.getByRole("dialog", { name: "Staff navigation drawer" }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");

    expect(
      screen.queryByRole("dialog", { name: "Staff navigation drawer" }),
    ).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("keeps the mobile navigation inside an opaque viewport-height drawer", async () => {
    const user = userEvent.setup();
    render(
      <>
        <p>Dashboard content outside the drawer</p>
        <MobileStaffNavigation
          branding={<span>SIST staff portal</span>}
          items={navigation}
        />
      </>,
    );

    await user.click(
      screen.getByRole("button", { name: "Open staff navigation" }),
    );

    const drawer = screen.getByRole("dialog", {
      name: "Staff navigation drawer",
    });
    expect(drawer).toHaveClass("fixed", "h-dvh", "z-10", "bg-sidebar");
    expect(within(drawer).getByRole("navigation", { name: "Staff navigation" }))
      .toBeInTheDocument();
    expect(within(drawer).queryByText("Dashboard content outside the drawer"))
      .not.toBeInTheDocument();
    expect(drawer.querySelector(".overflow-y-auto")).toHaveClass(
      "min-h-0",
      "flex-1",
      "overscroll-contain",
    );
  });
});

describe("STAFF account menu accessibility", () => {
  it("gives the trigger a stable accessible name independent of initials", () => {
    render(<AccountMenu fullName="Sara Ali" />);

    expect(screen.getByLabelText("Open account menu")).toBeInTheDocument();
  });
});

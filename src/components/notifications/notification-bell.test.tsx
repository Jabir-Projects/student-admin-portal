import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  formatUnreadNotificationCount,
  NotificationBell,
} from "@/components/notifications/notification-bell";

describe("NotificationBell", () => {
  it("hides the badge when there are no unread notifications", () => {
    render(<NotificationBell href="/student/notifications" unreadCount={0} />);

    expect(screen.getByRole("link", { name: "Notifications" })).toBeVisible();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("formats an owned unread count accessibly and caps the visual badge", () => {
    render(<NotificationBell href="/staff/notifications" unreadCount={125} />);

    expect(
      screen.getByRole("link", { name: "Notifications — 99+ unread" }),
    ).toBeVisible();
    expect(screen.getByText("99+")).toBeInTheDocument();
    expect(formatUnreadNotificationCount(2)).toBe("2");
  });
});

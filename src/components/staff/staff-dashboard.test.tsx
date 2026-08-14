import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import StaffDashboardError from "@/app/staff/error";
import {
  StaffDashboard,
  StaffDashboardLoading,
} from "@/components/staff/staff-dashboard";
import type { StaffDashboardData } from "@/server/staff/dashboard.node";

afterEach(cleanup);

function dashboardData(
  overrides: Partial<StaffDashboardData> = {},
): StaffDashboardData {
  return {
    fullName: "Sara Ali",
    capabilities: [],
    capabilitySummary: { status: "available", assignedCount: 0 },
    pendingStudents: { status: "hidden" },
    ...overrides,
  };
}

describe("STAFF dashboard presentation", () => {
  it("shows the real welcome name, capability count, and safe zero-capability state", () => {
    render(<StaffDashboard data={dashboardData()} />);

    expect(
      screen.getByRole("heading", { name: "Welcome, Sara Ali", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Assigned capabilities")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your account is active, but no administrative capabilities have been assigned yet.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Pending student accounts"),
    ).not.toBeInTheDocument();
  });

  it("shows the authorized pending count and accessible bounded queue", () => {
    render(
      <StaffDashboard
        data={dashboardData({
          capabilitySummary: { status: "available", assignedCount: 1 },
          pendingStudents: {
            status: "available",
            totalCount: 7,
            records: [
              {
                fullName: "Yasmine Idrissi",
                studentNumber: "SIST-2401",
                program: "BAC+3 Software Engineering",
                academicYear: "YEAR_2",
                submittedAt: new Date("2026-07-20T09:30:00Z"),
              },
            ],
          },
        })}
      />,
    );

    expect(screen.getByText("7")).toBeInTheDocument();
    expect(
      screen.getByRole("table", {
        name: "Oldest pending student account submissions",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Yasmine Idrissi")).toHaveLength(2);
    expect(screen.getAllByText("Year 2")).toHaveLength(2);
    expect(screen.queryByText(/email|password|session version/iu)).toBeNull();
    expect(
      screen.queryByRole("link", { name: /approve|manage/iu }),
    ).not.toBeInTheDocument();
  });

  it("shows a meaningful empty state for an authorized empty queue", () => {
    render(
      <StaffDashboard
        data={dashboardData({
          capabilitySummary: { status: "available", assignedCount: 1 },
          pendingStudents: { status: "empty", totalCount: 0, records: [] },
        })}
      />,
    );

    expect(screen.getByRole("status", { name: "" })).toHaveTextContent(
      "No accounts pending approval",
    );
  });

  it("exposes a screen-reader-friendly loading state", () => {
    render(<StaffDashboardLoading />);

    expect(
      screen.getByRole("status", { name: "Loading staff dashboard" }),
    ).toHaveAttribute("aria-busy", "true");
  });

  it("shows a safe error state and supports retry", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    render(
      <StaffDashboardError
        error={new Error("sensitive infrastructure detail")}
        unstable_retry={retry}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Dashboard unavailable",
    );
    expect(screen.queryByText("sensitive infrastructure detail")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  getAuthenticationSecret: vi.fn(),
  redirect: vi.fn(),
  requireActiveUser: vi.fn(),
  requireCapability: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/server/auth/dal", () => ({
  requireActiveUser: mocks.requireActiveUser,
}));
vi.mock("@/server/auth/capabilities", () => ({
  requireCapability: mocks.requireCapability,
}));
vi.mock("@/server/auth/env", () => ({
  getAuthenticationSecret: mocks.getAuthenticationSecret,
}));
vi.mock("@/server/db", () => ({
  db: { user: { findMany: mocks.findMany } },
}));
vi.mock("@/app/admin/users/pending/actions", () => ({
  legacyStudentAccountAction: vi.fn(),
}));

import PendingUsersPage from "@/app/admin/users/pending/page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("/admin/users/pending compatibility", () => {
  const referenceSecret = "test-only-account-reference-secret".repeat(2);

  afterEach(() => {
    mocks.getAuthenticationSecret.mockReset();
  });

  it("redirects an exact active STAFF actor before compatibility data access", async () => {
    mocks.requireActiveUser.mockResolvedValue({
      id: "staff-id",
      fullName: "Staff Member",
      role: "STAFF",
      status: "ACTIVE",
      sessionVersion: 2,
    });
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(
      PendingUsersPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/staff/student-accounts");
    expect(mocks.requireCapability).not.toHaveBeenCalled();
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("renders only encrypted opaque references for protected temporary ADMIN compatibility", async () => {
    const rawId = "40000000-0000-4000-8000-000000000001";
    mocks.requireActiveUser.mockResolvedValue({
      id: "admin-id",
      fullName: "Legacy Administrator",
      role: "ADMIN",
      status: "ACTIVE",
      sessionVersion: 2,
    });
    mocks.getAuthenticationSecret.mockReturnValue(referenceSecret);
    mocks.findMany.mockResolvedValue([
      {
        id: rawId,
        fullName: "Yasmine Idrissi",
        createdAt: new Date("2026-07-20T09:30:00Z"),
        studentProfile: {
          studentNumber: "SIST-2401",
          program: "Software Engineering",
          academicYear: "YEAR_2",
        },
      },
    ]);

    const { container } = render(
      await PendingUsersPage({ searchParams: Promise.resolve({}) }),
    );

    expect(mocks.requireCapability).toHaveBeenCalledWith(
      "MANAGE_STUDENT_ACCOUNTS",
    );
    expect(mocks.findMany).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Pending student accounts",
      }),
    ).toBeInTheDocument();
    expect(container.innerHTML).not.toContain(rawId);
    expect(container.querySelector('[name="targetUserId"]')).toBeNull();
    const references = Array.from(
      container.querySelectorAll<HTMLInputElement>(
        'input[type="hidden"][name="accountReference"]',
      ),
    ).map(({ value }) => value);
    expect(references).toHaveLength(2);
    expect(new Set(references).size).toBe(1);
    expect(references[0]).toMatch(/^acct2\.[A-Za-z0-9_-]+$/u);
    expect(references[0]).not.toContain(rawId);
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});

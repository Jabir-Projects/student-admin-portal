import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  requireActiveUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/server/auth/dal", () => ({
  requireActiveUser: mocks.requireActiveUser,
}));
vi.mock("@/components/auth/logout-button", () => ({
  LogoutButton: () => <button type="button">Sign out</button>,
}));

import AdminPage from "@/app/admin/page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("/admin compatibility landing", () => {
  it("redirects a database-revalidated active STAFF actor to /staff", async () => {
    mocks.requireActiveUser.mockResolvedValue({
      id: "staff-id",
      fullName: "Staff Member",
      role: "STAFF",
      sessionVersion: 4,
      status: "ACTIVE",
    });
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(AdminPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/staff");
  });

  it("retains the compatibility landing for a legacy ADMIN actor", async () => {
    mocks.requireActiveUser.mockResolvedValue({
      id: "admin-id",
      fullName: "Legacy Administrator",
      role: "ADMIN",
      sessionVersion: 2,
      status: "ACTIVE",
    });

    render(await AdminPage());

    expect(
      screen.getByRole("heading", { level: 1, name: "Administration" }),
    ).toBeInTheDocument();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

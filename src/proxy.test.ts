import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeSession: vi.fn(),
  getStaff: vi.fn(),
}));

vi.mock("next-auth", () => ({
  default: () => ({
    auth: (handler: unknown) => handler,
  }),
}));
vi.mock("@/auth.config", () => ({
  authConfig: {
    callbacks: { authorized: mocks.authorizeSession },
  },
}));
vi.mock("@/server/auth/dal.node", () => ({
  getStaffShellUserByClaims: mocks.getStaff,
}));
vi.mock("@/server/db", () => ({ db: {} }));

import proxy from "@/proxy";

function request(pathname: string) {
  return {
    auth: {
      user: { id: "staff-id", sessionVersion: 4 },
    },
    nextUrl: { pathname },
    url: `https://portal.example${pathname}`,
  } as never;
}

function activeStaff(capabilities: string[]) {
  return {
    ok: true,
    user: {
      id: "staff-id",
      role: "STAFF",
      status: "ACTIVE",
      sessionVersion: 4,
      fullName: "Staff Member",
      capabilities,
    },
  };
}

describe("capability-scoped staff proxy", () => {
  it.each([
    "/staff/student-accounts",
    "/staff/staff-capabilities",
    "/staff/imports/registry",
    "/staff/finance/imports",
  ])("redirects a capability-less STAFF actor from %s", async (pathname) => {
    mocks.authorizeSession.mockResolvedValue(true);
    mocks.getStaff.mockResolvedValue(activeStaff([]));

    const response = await proxy(request(pathname), {} as never);

    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe(
      "https://portal.example/unauthorized",
    );
  });

  it("allows the matching capability after database revalidation", async () => {
    mocks.authorizeSession.mockResolvedValue(true);
    mocks.getStaff.mockResolvedValue(activeStaff(["REGISTRY_IMPORT_APPROVE"]));

    const response = await proxy(
      request("/staff/imports/registry"),
      {} as never,
    );

    expect(response?.headers.get("x-middleware-next")).toBe("1");
    expect(mocks.getStaff).toHaveBeenCalledWith(
      { actorId: "staff-id", claimedSessionVersion: 4 },
      {},
    );
  });
});

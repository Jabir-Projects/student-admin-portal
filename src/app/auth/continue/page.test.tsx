import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  requireActiveUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/server/auth/dal", () => ({
  requireActiveUser: mocks.requireActiveUser,
}));

import ContinuePage from "@/app/auth/continue/page";

const redirectSignal = new Error("NEXT_REDIRECT_TEST_SIGNAL");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.redirect.mockImplementation(() => {
    throw redirectSignal;
  });
});

describe("/auth/continue authorization boundary", () => {
  it("does not route an actor rejected by database-authoritative validation", async () => {
    const invalidActorSignal = new Error("INVALID_ACTOR_REDIRECT");
    mocks.requireActiveUser.mockRejectedValue(invalidActorSignal);

    await expect(ContinuePage()).rejects.toBe(invalidActorSignal);

    expect(mocks.requireActiveUser).toHaveBeenCalledWith([
      "STUDENT",
      "STAFF",
      "ADMIN",
    ]);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it.each([
    ["STUDENT", "/student"],
    ["STAFF", "/staff"],
    ["ADMIN", "/admin"],
  ] as const)(
    "routes a revalidated %s actor to %s",
    async (role, destination) => {
      mocks.requireActiveUser.mockResolvedValue({
        fullName: "Active User",
        id: "active-user-id",
        role,
        sessionVersion: 3,
        status: "ACTIVE",
      });

      await expect(ContinuePage()).rejects.toBe(redirectSignal);

      expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith(destination);
    },
  );
});

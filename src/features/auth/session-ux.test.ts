import { describe, expect, it } from "vitest";

import {
  getAuthorizationFailureDestination,
  getLoginPresentationMessage,
} from "@/features/auth/session-ux";

describe("authorization presentation", () => {
  it.each([
    ["UNAUTHENTICATED", "/login"],
    ["DISABLED_ACCOUNT", "/login?reason=disabled"],
    ["STALE_SESSION", "/login?reason=session-ended"],
    ["INACTIVE_ACCOUNT", "/login?reason=session-ended"],
    ["WRONG_ROLE", "/unauthorized"],
    ["MISSING_CAPABILITY", "/unauthorized"],
  ] as const)(
    "maps %s to an allowlisted destination",
    (reason, destination) => {
      expect(getAuthorizationFailureDestination(reason)).toBe(destination);
    },
  );

  it("presents disabled and ended sessions without internal details", () => {
    expect(getLoginPresentationMessage("disabled")).toBe(
      "This account is disabled. Contact an administrator if you believe this is an error.",
    );
    expect(getLoginPresentationMessage("session-ended")).toBe(
      "Your session has ended. Sign in again to continue.",
    );
  });

  it("ignores unknown presentation reasons", () => {
    expect(getLoginPresentationMessage("sessionVersion=42")).toBeUndefined();
  });
});

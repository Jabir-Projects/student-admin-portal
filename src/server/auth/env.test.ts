import { describe, expect, it } from "vitest";
import {
  getAuthenticationSecret,
  parseAuthenticationEnvironment,
  parseRegistrationVerificationMode,
} from "@/server/auth/env";

describe("authentication environment", () => {
  it("accepts a sufficiently long secret", () => {
    expect(
      parseAuthenticationEnvironment({ AUTH_SECRET: "x".repeat(32) }),
    ).toEqual({ AUTH_SECRET: "x".repeat(32) });
  });
  it("reports only the invalid field name", () => {
    expect(() =>
      parseAuthenticationEnvironment({ AUTH_SECRET: "short" }),
    ).toThrow("AUTH_SECRET");
  });
  it("requires the secret outside explicitly allowed build and test contexts", () => {
    expect(() => getAuthenticationSecret({})).toThrow(
      "Invalid authentication environment configuration: AUTH_SECRET",
    );
    expect(getAuthenticationSecret({}, { allowMissing: true })).toBeUndefined();
  });
});

describe("registration verification mode", () => {
  it("defaults missing and empty values to manual approval", () => {
    expect(parseRegistrationVerificationMode({})).toBe("MANUAL_APPROVAL");
    expect(
      parseRegistrationVerificationMode({ REGISTRATION_VERIFICATION_MODE: "" }),
    ).toBe("MANUAL_APPROVAL");
  });

  it.each(["MANUAL_APPROVAL", "INTERNAL_REGISTRY"] as const)(
    "accepts %s",
    (mode) => {
      expect(
        parseRegistrationVerificationMode({
          REGISTRATION_VERIFICATION_MODE: mode,
        }),
      ).toBe(mode);
    },
  );

  it("rejects unknown values without exposing the rejected value", () => {
    const rejectedValue = "UNSAFE_MODE_VALUE";

    expect(() =>
      parseRegistrationVerificationMode({
        REGISTRATION_VERIFICATION_MODE: rejectedValue,
      }),
    ).toThrow("Invalid registration verification mode configuration");

    try {
      parseRegistrationVerificationMode({
        REGISTRATION_VERIFICATION_MODE: rejectedValue,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(rejectedValue);
    }
  });

  it("does not require AUTH_SECRET", () => {
    expect(
      parseRegistrationVerificationMode({
        REGISTRATION_VERIFICATION_MODE: "INTERNAL_REGISTRY",
      }),
    ).toBe("INTERNAL_REGISTRY");
  });
});

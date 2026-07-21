import { describe, expect, it } from "vitest";
import {
  getAuthenticationSecret,
  parseAuthenticationEnvironment,
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

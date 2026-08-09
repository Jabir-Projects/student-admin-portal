// @vitest-environment node

import { describe, expect, it } from "vitest";

import { hasAuthorizedSchedulerSecret } from "@/server/notifications/scheduler-auth.node";

describe("scheduler authorization", () => {
  const secret = "a".repeat(32);

  it("accepts only the exact configured bearer token", () => {
    expect(hasAuthorizedSchedulerSecret(`Bearer ${secret}`, secret)).toBe(true);
    expect(hasAuthorizedSchedulerSecret("Bearer different", secret)).toBe(
      false,
    );
    expect(hasAuthorizedSchedulerSecret(null, secret)).toBe(false);
  });

  it("fails closed for short or absent scheduler secrets", () => {
    expect(hasAuthorizedSchedulerSecret(`Bearer ${secret}`, undefined)).toBe(
      false,
    );
    expect(hasAuthorizedSchedulerSecret("Bearer short", "short")).toBe(false);
  });
});

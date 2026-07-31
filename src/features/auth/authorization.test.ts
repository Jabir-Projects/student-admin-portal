import { describe, expect, it } from "vitest";
import { hasActiveRole } from "@/features/auth/authorization";

describe("role and status policy", () => {
  it("allows only an active account with the expected role", () => {
    expect(hasActiveRole({ role: "STAFF", status: "ACTIVE" }, "STAFF")).toBe(
      true,
    );
    expect(hasActiveRole({ role: "STUDENT", status: "ACTIVE" }, "STAFF")).toBe(
      false,
    );
    expect(hasActiveRole({ role: "STAFF", status: "DISABLED" }, "STAFF")).toBe(
      false,
    );
    expect(hasActiveRole(null, "STUDENT")).toBe(false);
  });
});

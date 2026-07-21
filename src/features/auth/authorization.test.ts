import { describe, expect, it } from "vitest";
import { hasActiveRole } from "@/features/auth/authorization";

describe("role and status policy", () => {
  it("allows only an active account with the expected role", () => {
    expect(hasActiveRole({ role: "ADMIN", status: "ACTIVE" }, "ADMIN")).toBe(
      true,
    );
    expect(hasActiveRole({ role: "STUDENT", status: "ACTIVE" }, "ADMIN")).toBe(
      false,
    );
    expect(hasActiveRole({ role: "ADMIN", status: "DISABLED" }, "ADMIN")).toBe(
      false,
    );
    expect(hasActiveRole(null, "STUDENT")).toBe(false);
  });
});

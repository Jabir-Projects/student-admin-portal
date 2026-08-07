import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";

describe("Argon2id password service", () => {
  it("hashes and verifies without retaining plaintext", async () => {
    const password = "a production length password";
    const digest = await hashPassword(password);
    expect(digest).toMatch(/^\$argon2id\$/u);
    expect(digest).not.toContain(password);
    await expect(verifyPassword(digest, password)).resolves.toBe(true);
    await expect(verifyPassword(digest, "incorrect password")).resolves.toBe(
      false,
    );
  });
  it("rejects excessively large input before hashing", async () => {
    await expect(hashPassword("x".repeat(129))).rejects.toThrow(
      "Password length",
    );
  });

  it("treats malformed hashes as invalid credentials", async () => {
    await expect(
      verifyPassword("not-a-valid-argon2-hash", "safe password for testing"),
    ).resolves.toBe(false);
  });
});

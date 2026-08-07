import { afterEach, describe, expect, it, vi } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";

const originalVercelEnvironment = process.env.VERCEL_ENV;

afterEach(() => {
  if (originalVercelEnvironment === undefined) {
    delete process.env.VERCEL_ENV;
  } else {
    process.env.VERCEL_ENV = originalVercelEnvironment;
  }
  vi.restoreAllMocks();
});

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

  it("reports an ordinary verification mismatch without revealing inputs", async () => {
    process.env.VERCEL_ENV = "preview";
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const digest = await hashPassword("safe password for mismatch testing");

    await expect(
      verifyPassword(digest, "different safe password for testing"),
    ).resolves.toBe(false);

    expect(info).toHaveBeenCalledExactlyOnceWith(
      "AUTH_DIAG password_verify_false",
    );
  });

  it("reports malformed hashes as verification exceptions without revealing inputs", async () => {
    process.env.VERCEL_ENV = "preview";
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    await expect(
      verifyPassword("not-a-valid-argon2-hash", "safe password for testing"),
    ).resolves.toBe(false);

    expect(info).toHaveBeenCalledExactlyOnceWith(
      "AUTH_DIAG password_verify_exception",
    );
  });
});

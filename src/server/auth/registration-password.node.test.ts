// @vitest-environment node

import { describe, expect, it, vi } from "vitest";

import { ACADEMIC_YEARS, PROGRAMS } from "@/features/auth/constants";
import { verifyPassword } from "@/server/auth/password";
import { registerStudentWithDatabase } from "@/server/auth/registration.node";

describe("registration password persistence", () => {
  it("stores a hash that verifies the exact accepted registration password", async () => {
    const password = "  Registration é́ 🔒 password  ";
    let storedPasswordHash: string | undefined;
    const userCreate = vi.fn(
      async ({ data }: { data: { passwordHash: string } }) => {
        storedPasswordHash = data.passwordHash;
        return { id: "created-user-id" };
      },
    );
    const transaction = {
      auditLog: { create: vi.fn(async () => ({ id: "audit-id" })) },
      user: { create: userCreate },
    };
    const database = {
      $transaction: async (
        callback: (client: typeof transaction) => Promise<unknown>,
      ) => callback(transaction),
    } as unknown as Parameters<typeof registerStudentWithDatabase>[1];

    await expect(
      registerStudentWithDatabase(
        {
          academicYear: ACADEMIC_YEARS[0].value,
          confirmPassword: password,
          email: "registration-password@example.test",
          fullName: "Registration Password",
          password,
          program: PROGRAMS[0],
          studentNumber: "REGISTRATION-PASSWORD-1",
        },
        database,
        { runtime: "test", verificationMode: "MANUAL_APPROVAL" },
      ),
    ).resolves.toEqual({ ok: true });

    expect(storedPasswordHash).toMatch(/^\$argon2id\$/u);
    await expect(verifyPassword(storedPasswordHash!, password)).resolves.toBe(
      true,
    );
  });
});

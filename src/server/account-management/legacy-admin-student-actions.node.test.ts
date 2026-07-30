// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  createAccountReference,
  resolveAccountReference,
} from "@/server/account-management/account-reference.node";
import { executeLegacyAdminStudentAction } from "@/server/account-management/legacy-admin-student-actions.node";

const claims = { actorId: "actor-id", claimedSessionVersion: 4 };
const accountId = "40000000-0000-4000-8000-000000000001";
const unknownAccountId = "40000000-0000-4000-8000-000000000099";
const database = {} as PrismaClient;
const secret = "test-only-account-reference-secret".repeat(2);
const authorize = vi.fn();
const approve = vi.fn();
const disable = vi.fn();

const dependencies = {
  authorize,
  resolveReference: resolveAccountReference,
  mutate: {
    "approve-student": approve,
    "disable-student": disable,
  },
};

function actor(role: "STAFF" | "ADMIN", capabilities: readonly string[]) {
  return {
    ok: true as const,
    actor: {
      id: "actor-id",
      role,
      status: "ACTIVE" as const,
      sessionVersion: 4,
      capabilities,
    },
  };
}

function tamper(reference: string): string {
  const [version, encodedEnvelope] = reference.split(".");
  if (!version || !encodedEnvelope) throw new Error("Invalid test reference.");
  const envelope = Buffer.from(encodedEnvelope, "base64url");
  envelope[12] = (envelope[12] ?? 0) ^ 1;
  return `${version}.${envelope.toString("base64url")}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  authorize.mockResolvedValue(actor("ADMIN", ["MANAGE_STUDENT_ACCOUNTS"]));
  approve.mockResolvedValue({ ok: true });
  disable.mockResolvedValue({ ok: true });
});

describe("legacy ADMIN student-account compatibility action", () => {
  it("rejects malformed opaque references before authorization or mutation", async () => {
    await expect(
      executeLegacyAdminStudentAction(
        claims,
        { intent: "approve-student", accountReference: "raw-database-id" },
        database,
        secret,
        dependencies,
      ),
    ).resolves.toMatchObject({ status: "validation-error" });
    expect(authorize).not.toHaveBeenCalled();
    expect(approve).not.toHaveBeenCalled();
  });

  it.each([
    ["tampered", tamper(createAccountReference("student", accountId, secret))],
    ["wrong-purpose", createAccountReference("staff", accountId, secret)],
  ])("rejects a %s reference safely", async (_label, accountReference) => {
    const result = await executeLegacyAdminStudentAction(
      claims,
      { intent: "approve-student", accountReference },
      database,
      secret,
      dependencies,
    );

    expect(result).toEqual({
      status: "validation-error",
      message: "The submitted account action is invalid. Refresh and retry.",
    });
    expect(authorize).not.toHaveBeenCalled();
    expect(approve).not.toHaveBeenCalled();
  });

  it("does not disclose target existence to an unauthorized actor", async () => {
    authorize.mockResolvedValue({
      ok: false,
      reason: "MISSING_CAPABILITY",
    });
    const inputs = [accountId, unknownAccountId].map((id) => ({
      intent: "disable-student" as const,
      accountReference: createAccountReference("student", id, secret),
    }));

    const results = await Promise.all(
      inputs.map((input) =>
        executeLegacyAdminStudentAction(
          claims,
          input,
          database,
          secret,
          dependencies,
        ),
      ),
    );

    expect(results[0]).toEqual(results[1]);
    expect(results[0]).toEqual({
      status: "denied",
      message: "You are not authorized to perform this account action.",
    });
    expect(disable).not.toHaveBeenCalled();
  });

  it.each([
    ["approve-student", approve, "The student account was approved."],
    ["disable-student", disable, "The student account was disabled."],
  ] as const)(
    "allows exact ADMIN with MANAGE_STUDENT_ACCOUNTS to %s in protected compatibility mode",
    async (intent, mutation, message) => {
      const result = await executeLegacyAdminStudentAction(
        claims,
        {
          intent,
          accountReference: createAccountReference(
            "student",
            accountId,
            secret,
          ),
        },
        database,
        secret,
        dependencies,
      );

      expect(authorize).toHaveBeenCalledWith(
        claims,
        "MANAGE_STUDENT_ACCOUNTS",
        database,
      );
      expect(mutation).toHaveBeenCalledWith(
        claims,
        accountId,
        database,
        "ADMIN_ONLY",
      );
      expect(result).toEqual({ status: "success", message });
    },
  );

  it("denies ADMIN without MANAGE_STUDENT_ACCOUNTS", async () => {
    authorize.mockResolvedValue({
      ok: false,
      reason: "MISSING_CAPABILITY",
    });

    await expect(
      executeLegacyAdminStudentAction(
        claims,
        {
          intent: "approve-student",
          accountReference: createAccountReference(
            "student",
            accountId,
            secret,
          ),
        },
        database,
        secret,
        dependencies,
      ),
    ).resolves.toMatchObject({ status: "denied" });
    expect(approve).not.toHaveBeenCalled();
  });

  it("denies exact STAFF even when the capability is present", async () => {
    authorize.mockResolvedValue(actor("STAFF", ["MANAGE_STUDENT_ACCOUNTS"]));

    await expect(
      executeLegacyAdminStudentAction(
        claims,
        {
          intent: "approve-student",
          accountReference: createAccountReference(
            "student",
            accountId,
            secret,
          ),
        },
        database,
        secret,
        dependencies,
      ),
    ).resolves.toMatchObject({ status: "denied" });
    expect(approve).not.toHaveBeenCalled();
  });

  it("sanitizes authorized target failures without disclosing existence", async () => {
    disable.mockResolvedValue({
      ok: false,
      message: "private target state",
    });
    const results = await Promise.all(
      [accountId, unknownAccountId].map((id) =>
        executeLegacyAdminStudentAction(
          claims,
          {
            intent: "disable-student",
            accountReference: createAccountReference("student", id, secret),
          },
          database,
          secret,
          dependencies,
        ),
      ),
    );

    expect(results[0]).toEqual(results[1]);
    expect(results[0]).toEqual({
      status: "error",
      message: "The account action could not be completed. Refresh and retry.",
    });
    expect(results[0]?.message).not.toContain("private target state");
  });
});

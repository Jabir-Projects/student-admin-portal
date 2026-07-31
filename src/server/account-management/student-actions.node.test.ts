// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { executeStudentAccountAction } from "@/server/account-management/student-actions.node";

const claims = { actorId: "actor-id", claimedSessionVersion: 3 };
const accountId = "40000000-0000-4000-8000-000000000001";
const database = {} as PrismaClient;
const secret = "test-only-account-reference-secret".repeat(2);
const authorize = vi.fn();
const resolveReference = vi.fn();
const approve = vi.fn();
const disable = vi.fn();
const reactivate = vi.fn();

const dependencies = {
  authorize,
  resolveReference,
  mutate: {
    "approve-student": approve,
    "disable-student": disable,
    "reactivate-student": reactivate,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  resolveReference.mockReturnValue({ ok: true, accountId });
  authorize.mockResolvedValue({
    ok: true,
    actor: {
      id: "actor-id",
      role: "STAFF",
      status: "ACTIVE",
      sessionVersion: 3,
      fullName: "Staff Actor",
      capabilities: ["MANAGE_STUDENT_ACCOUNTS"],
    },
  });
  approve.mockResolvedValue({ ok: true });
  disable.mockResolvedValue({ ok: true });
  reactivate.mockResolvedValue({ ok: true });
});

describe("D3 student account actions", () => {
  it.each([
    [
      "approve-student",
      "MANAGE_STUDENT_ACCOUNTS",
      approve,
      "The student account was approved.",
    ],
    [
      "disable-student",
      "MANAGE_STUDENT_ACCOUNTS",
      disable,
      "The student account was disabled.",
    ],
    [
      "reactivate-student",
      "REACTIVATE_STUDENT_ACCOUNTS",
      reactivate,
      "The student account was reactivated.",
    ],
  ] as const)(
    "validates, authorizes, and executes %s in exact STAFF mode",
    async (intent, capability, mutation, message) => {
      const result = await executeStudentAccountAction(
        claims,
        { intent, accountReference: "acct2.valid-reference" },
        database,
        secret,
        dependencies,
      );

      expect(resolveReference).toHaveBeenCalledWith(
        "acct2.valid-reference",
        "student",
        secret,
      );
      expect(authorize).toHaveBeenCalledWith(claims, capability, database);
      expect(mutation).toHaveBeenCalledWith(claims, accountId, database);
      expect(result).toEqual({ status: "success", message });
    },
  );

  it.each([
    ["missing intent", { accountReference: "acct2.valid-reference" }],
    [
      "unexpected intent",
      {
        intent: "disable-staff",
        accountReference: "acct2.valid-reference",
      },
    ],
    [
      "malformed reference",
      { intent: "approve-student", accountReference: "raw-id" },
    ],
  ])("rejects %s before authorization", async (_label, input) => {
    await expect(
      executeStudentAccountAction(
        claims,
        input,
        database,
        secret,
        dependencies,
      ),
    ).resolves.toMatchObject({ status: "validation-error" });
    expect(authorize).not.toHaveBeenCalled();
    expect(approve).not.toHaveBeenCalled();
  });

  it.each(["tampered", "wrong-purpose"])(
    "rejects a %s opaque reference without loading a target",
    async () => {
      resolveReference.mockReturnValue({
        ok: false,
        reason: "INVALID_REFERENCE",
      });
      await expect(
        executeStudentAccountAction(
          claims,
          {
            intent: "approve-student",
            accountReference: "acct2.invalid-reference",
          },
          database,
          secret,
          dependencies,
        ),
      ).resolves.toMatchObject({ status: "validation-error" });
      expect(authorize).not.toHaveBeenCalled();
      expect(approve).not.toHaveBeenCalled();
    },
  );

  it("returns non-sensitive authorization and mutation failures", async () => {
    authorize.mockResolvedValueOnce({
      ok: false,
      reason: "MISSING_CAPABILITY",
    });
    const denied = await executeStudentAccountAction(
      claims,
      {
        intent: "disable-student",
        accountReference: "acct2.valid-reference",
      },
      database,
      secret,
      dependencies,
    );
    expect(denied).toEqual({
      status: "denied",
      message: "You are not authorized to perform this account action.",
    });
    expect(disable).not.toHaveBeenCalled();

    authorize.mockResolvedValueOnce({
      ok: true,
      actor: {
        id: "actor-id",
        role: "STAFF",
        status: "ACTIVE",
        sessionVersion: 3,
        fullName: "Staff Actor",
        capabilities: ["MANAGE_STUDENT_ACCOUNTS"],
      },
    });
    disable.mockResolvedValueOnce({
      ok: false,
      message: "private database state",
    });
    const failed = await executeStudentAccountAction(
      claims,
      {
        intent: "disable-student",
        accountReference: "acct2.valid-reference",
      },
      database,
      secret,
      dependencies,
    );
    expect(failed.message).not.toContain("private database state");
    expect(failed.status).toBe("error");
  });
});

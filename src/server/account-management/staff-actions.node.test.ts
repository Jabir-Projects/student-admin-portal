// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { executeStaffAccountAction } from "@/server/account-management/staff-actions.node";

const claims = { actorId: "actor-id", claimedSessionVersion: 3 };
const accountId = "40000000-0000-4000-8000-000000000001";
const database = {} as PrismaClient;
const secret = "test-only-account-reference-secret".repeat(2);
const authorize = vi.fn();
const resolveReference = vi.fn();
const disable = vi.fn();
const reactivate = vi.fn();
const grant = vi.fn();
const revoke = vi.fn();
const create = vi.fn();
const hashPassword = vi.fn();

const dependencies = {
  authorize,
  resolveReference,
  mutate: {
    "disable-staff": disable,
    "reactivate-staff": reactivate,
  },
  mutateCapability: {
    "grant-capability": grant,
    "revoke-capability": revoke,
  },
  create,
  hashPassword,
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
      fullName: "STAFF Actor",
      capabilities: ["MANAGE_STAFF_ACCOUNTS"],
    },
  });
  disable.mockResolvedValue({ ok: true });
  reactivate.mockResolvedValue({ ok: true });
  grant.mockResolvedValue({ ok: true });
  revoke.mockResolvedValue({ ok: true });
  create.mockResolvedValue({ ok: true });
  hashPassword.mockResolvedValue("argon2id-test-hash");
});

describe("D4 STAFF account actions", () => {
  it.each([
    ["disable-staff", disable, "The STAFF account was disabled."],
    ["reactivate-staff", reactivate, "The STAFF account was reactivated."],
  ] as const)(
    "validates, authorizes, and executes %s",
    async (intent, mutation, message) => {
      const result = await executeStaffAccountAction(
        claims,
        { intent, accountReference: "acct2.valid-reference" },
        database,
        secret,
        dependencies,
      );

      expect(resolveReference).toHaveBeenCalledWith(
        "acct2.valid-reference",
        "staff",
        secret,
      );
      expect(authorize).toHaveBeenCalledWith(
        claims,
        "MANAGE_STAFF_ACCOUNTS",
        database,
      );
      expect(mutation).toHaveBeenCalledWith(claims, accountId, database);
      expect(result).toEqual({ status: "success", message });
    },
  );

  it.each([
    ["grant-capability", grant, "The capability was assigned."],
    ["revoke-capability", revoke, "The capability was removed."],
  ] as const)(
    "requires capability management and executes %s",
    async (intent, mutation, message) => {
      authorize.mockResolvedValueOnce({
        ok: true,
        actor: {
          id: "actor-id",
          role: "STAFF",
          status: "ACTIVE",
          sessionVersion: 3,
          fullName: "STAFF Actor",
          capabilities: ["MANAGE_STAFF_CAPABILITIES"],
        },
      });
      await expect(
        executeStaffAccountAction(
          claims,
          {
            intent,
            accountReference: "acct2.valid-reference",
            capability: "VIEW_AUDIT_LOG",
          },
          database,
          secret,
          dependencies,
        ),
      ).resolves.toEqual({ status: "success", message });
      expect(authorize).toHaveBeenCalledWith(
        claims,
        "MANAGE_STAFF_CAPABILITIES",
        database,
      );
      expect(mutation).toHaveBeenCalledWith(
        claims,
        accountId,
        "VIEW_AUDIT_LOG",
        database,
      );
    },
  );

  it("creates an active STAFF account with a password hash and deduplicated initial capabilities", async () => {
    authorize.mockResolvedValueOnce({
      ok: true,
      actor: {
        id: "actor-id",
        role: "STAFF",
        status: "ACTIVE",
        sessionVersion: 3,
        fullName: "STAFF Actor",
        capabilities: ["MANAGE_STAFF_ACCOUNTS", "MANAGE_STAFF_CAPABILITIES"],
      },
    });
    await expect(
      executeStaffAccountAction(
        claims,
        {
          intent: "create-staff",
          fullName: "  Sara   Amrani ",
          email: " SARA@EXAMPLE.COM ",
          password: "strong-password",
          capabilities: ["VIEW_AUDIT_LOG", "VIEW_AUDIT_LOG"],
        },
        database,
        secret,
        dependencies,
      ),
    ).resolves.toEqual({
      status: "success",
      message: "The STAFF account was created.",
    });
    expect(hashPassword).toHaveBeenCalledWith("strong-password");
    expect(create).toHaveBeenCalledWith(
      claims,
      {
        fullName: "Sara Amrani",
        email: "sara@example.com",
        passwordHash: "argon2id-test-hash",
        capabilities: ["VIEW_AUDIT_LOG"],
      },
      database,
    );
  });

  it("rejects forged and unknown capability input before authorization", async () => {
    for (const capability of ["ADMIN", "UNKNOWN_CAPABILITY"]) {
      await expect(
        executeStaffAccountAction(
          claims,
          {
            intent: "grant-capability",
            accountReference: "acct2.valid-reference",
            capability,
          },
          database,
          secret,
          dependencies,
        ),
      ).resolves.toMatchObject({ status: "validation-error" });
    }
    expect(authorize).not.toHaveBeenCalled();
    expect(grant).not.toHaveBeenCalled();
  });

  it("does not allow a STAFF account manager to assign initial capabilities", async () => {
    await expect(
      executeStaffAccountAction(
        claims,
        {
          intent: "create-staff",
          fullName: "Sara Amrani",
          email: "sara@example.com",
          password: "strong-password",
          capabilities: ["VIEW_AUDIT_LOG"],
        },
        database,
        secret,
        dependencies,
      ),
    ).resolves.toEqual({
      status: "denied",
      message: "You are not authorized to assign STAFF capabilities.",
    });
    expect(hashPassword).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    ["missing intent", { accountReference: "acct2.valid-reference" }],
    [
      "wrong lifecycle intent",
      {
        intent: "disable-student",
        accountReference: "acct2.valid-reference",
      },
    ],
    [
      "malformed reference",
      { intent: "disable-staff", accountReference: accountId },
    ],
  ])("rejects %s before authorization", async (_label, input) => {
    await expect(
      executeStaffAccountAction(claims, input, database, secret, dependencies),
    ).resolves.toMatchObject({ status: "validation-error" });
    expect(authorize).not.toHaveBeenCalled();
    expect(disable).not.toHaveBeenCalled();
  });

  it.each(["tampered", "wrong-purpose", "wrong-secret"])(
    "rejects a %s opaque reference without authorizing or loading a target",
    async () => {
      resolveReference.mockReturnValue({
        ok: false,
        reason: "INVALID_REFERENCE",
      });
      await expect(
        executeStaffAccountAction(
          claims,
          {
            intent: "disable-staff",
            accountReference: "acct2.invalid-reference",
          },
          database,
          secret,
          dependencies,
        ),
      ).resolves.toMatchObject({ status: "validation-error" });
      expect(authorize).not.toHaveBeenCalled();
      expect(disable).not.toHaveBeenCalled();
    },
  );

  it("does not disclose target existence before mutation", async () => {
    authorize.mockResolvedValueOnce({
      ok: false,
      reason: "MISSING_CAPABILITY",
    });
    const denied = await executeStaffAccountAction(
      claims,
      {
        intent: "disable-staff",
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
  });

  it.each(["TARGET_NOT_ELIGIBLE", "STALE_TARGET", "LAST_CAPABILITY_MANAGER"])(
    "sanitizes the %s disable failure without disclosing target details",
    async (reason) => {
      disable.mockResolvedValueOnce({ ok: false, reason });

      await expect(
        executeStaffAccountAction(
          claims,
          {
            intent: "disable-staff",
            accountReference: "acct2.valid-reference",
          },
          database,
          secret,
          dependencies,
        ),
      ).resolves.toEqual({
        status: "error",
        message:
          "The account action could not be completed. Refresh and retry.",
      });
    },
  );

  it("sanitizes an audit transaction failure", async () => {
    disable.mockRejectedValueOnce(new Error("audit unavailable"));

    await expect(
      executeStaffAccountAction(
        claims,
        {
          intent: "disable-staff",
          accountReference: "acct2.valid-reference",
        },
        database,
        secret,
        dependencies,
      ),
    ).resolves.toEqual({
      status: "error",
      message: "The account action could not be completed. Refresh and retry.",
    });
  });
});

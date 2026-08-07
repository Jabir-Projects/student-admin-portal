// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditCreate: vi.fn(),
  credentials: vi.fn((options: unknown) => options),
  findUnique: vi.fn(),
  nextAuth: vi.fn(() => ({
    auth: vi.fn(),
    handlers: {},
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
  performComparablePasswordWork: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock("next-auth", () => {
  class CredentialsSignin extends Error {
    type = "CredentialsSignin";
    code = "credentials";
  }

  return {
    CredentialsSignin,
    default: mocks.nextAuth,
  };
});
vi.mock("next-auth/providers/credentials", () => ({
  default: mocks.credentials,
}));
vi.mock("@/server/auth/password", () => ({
  performComparablePasswordWork: mocks.performComparablePasswordWork,
  verifyPassword: mocks.verifyPassword,
}));
vi.mock("@/server/db", () => ({
  db: {
    auditLog: { create: mocks.auditCreate },
    user: { findUnique: mocks.findUnique },
  },
}));

import "@/auth";

type Authorize = (credentials?: Record<string, unknown>) => Promise<unknown>;

const credentialsOptions = mocks.credentials.mock.calls[0]?.[0] as {
  authorize: Authorize;
};

function authorize(): Authorize {
  return credentialsOptions.authorize;
}

function user(status: "PENDING_APPROVAL" | "ACTIVE" | "DISABLED") {
  return {
    id: "user-id",
    passwordHash: "argon2id-test-hash",
    role: "STUDENT",
    sessionVersion: 3,
    status,
  };
}

const credentialsWithFrameworkFields = {
  callbackUrl: "/auth/continue",
  email: " Student@Example.COM ",
  password: "a secure password",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auditCreate.mockResolvedValue({ id: "audit-id" });
  mocks.performComparablePasswordWork.mockResolvedValue(undefined);
  mocks.verifyPassword.mockResolvedValue(true);
});

describe("credentials authorization", () => {
  it("uses only email and password from an Auth.js payload before routing a pending account", async () => {
    mocks.findUnique.mockResolvedValue(user("PENDING_APPROVAL"));

    await expect(
      authorize()(credentialsWithFrameworkFields),
    ).rejects.toMatchObject({
      code: "pending_approval",
      type: "CredentialsSignin",
    });

    expect(mocks.findUnique).toHaveBeenCalledExactlyOnceWith({
      select: {
        id: true,
        passwordHash: true,
        role: true,
        sessionVersion: true,
        status: true,
      },
      where: { email: "student@example.com" },
    });
    expect(mocks.verifyPassword).toHaveBeenCalledExactlyOnceWith(
      "argon2id-test-hash",
      "a secure password",
    );
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("rejects a disabled account after a valid password", async () => {
    mocks.findUnique.mockResolvedValue(user("DISABLED"));

    await expect(
      authorize()(credentialsWithFrameworkFields),
    ).rejects.toMatchObject({
      code: "account_disabled",
      type: "CredentialsSignin",
    });

    expect(mocks.verifyPassword).toHaveBeenCalledTimes(1);
    expect(mocks.auditCreate).not.toHaveBeenCalled();
  });

  it("creates the existing active-account result and audit record", async () => {
    mocks.findUnique.mockResolvedValue(user("ACTIVE"));

    await expect(authorize()(credentialsWithFrameworkFields)).resolves.toEqual({
      id: "user-id",
      role: "STUDENT",
      sessionVersion: 3,
      status: "ACTIVE",
    });

    expect(mocks.auditCreate).toHaveBeenCalledExactlyOnceWith({
      data: {
        action: "AUTHENTICATION_SUCCEEDED",
        actorId: "user-id",
        entityId: "user-id",
        entityType: "User",
        metadata: { method: "credentials" },
      },
    });
  });

  it("rejects a wrong password without exposing the account state", async () => {
    mocks.findUnique.mockResolvedValue(user("PENDING_APPROVAL"));
    mocks.verifyPassword.mockResolvedValue(false);

    await expect(
      authorize()(credentialsWithFrameworkFields),
    ).resolves.toBeNull();

    expect(mocks.auditCreate).not.toHaveBeenCalled();
    expect(mocks.performComparablePasswordWork).not.toHaveBeenCalled();
  });

  it("performs comparable password work for a nonexistent user", async () => {
    mocks.findUnique.mockResolvedValue(null);

    await expect(
      authorize()(credentialsWithFrameworkFields),
    ).resolves.toBeNull();

    expect(mocks.performComparablePasswordWork).toHaveBeenCalledExactlyOnceWith(
      "a secure password",
    );
    expect(mocks.verifyPassword).not.toHaveBeenCalled();
  });
});

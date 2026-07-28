import { describe, expect, it } from "vitest";

import {
  createMinimalJwt,
  createMinimalSession,
  getPostAuthenticationPath,
  getProxyAuthorizationOutcome,
  getSafeCallbackUrl,
  isProxyAuthorized,
} from "@/auth.config";
import type {
  AccountStatusValue,
  UserRoleValue,
} from "@/features/auth/constants";

function session(role: UserRoleValue, status: AccountStatusValue) {
  return {
    expires: "2099-01-01T00:00:00.000Z",
    user: { id: "user-id", role, status, sessionVersion: 0 },
  };
}

describe("Proxy authorization", () => {
  it.each([
    "/student",
    "/student/requests",
    "/staff",
    "/staff/requests",
    "/admin",
    "/admin/users/pending",
  ])("rejects unauthenticated access to %s", (pathname) =>
    expect(isProxyAuthorized(pathname, null)).toBe(false),
  );
  it("enforces active student route boundaries", () => {
    const student = session("STUDENT", "ACTIVE");
    expect(isProxyAuthorized("/student", student)).toBe(true);
    expect(isProxyAuthorized("/student/requests", student)).toBe(true);
    expect(isProxyAuthorized("/staff", student)).toBe(false);
    expect(isProxyAuthorized("/admin", student)).toBe(false);
    expect(isProxyAuthorized("/admin/users/pending", student)).toBe(false);
  });
  it("distinguishes missing authentication from wrong-role access", () => {
    expect(getProxyAuthorizationOutcome("/staff", null)).toBe("LOGIN");
    expect(
      getProxyAuthorizationOutcome("/staff", session("STUDENT", "ACTIVE")),
    ).toBe("UNAUTHORIZED");
  });
  it("enforces active administrator route boundaries", () => {
    const administrator = session("ADMIN", "ACTIVE");
    expect(isProxyAuthorized("/admin", administrator)).toBe(true);
    expect(isProxyAuthorized("/admin/users/pending", administrator)).toBe(true);
    expect(isProxyAuthorized("/staff", administrator)).toBe(false);
    expect(isProxyAuthorized("/student", administrator)).toBe(false);
    expect(isProxyAuthorized("/student/requests", administrator)).toBe(false);
  });
  it("allows active staff through the coarse admin route boundary", () => {
    const staff = session("STAFF", "ACTIVE");
    expect(isProxyAuthorized("/staff", staff)).toBe(true);
    expect(isProxyAuthorized("/staff/requests", staff)).toBe(true);
    expect(isProxyAuthorized("/admin", staff)).toBe(true);
    expect(isProxyAuthorized("/admin/users/pending", staff)).toBe(true);
    expect(isProxyAuthorized("/student", staff)).toBe(false);
  });
  it.each(["PENDING_APPROVAL", "DISABLED"] as const)(
    "rejects %s accounts",
    (status) => {
      expect(isProxyAuthorized("/student", session("STUDENT", status))).toBe(
        false,
      );
      expect(isProxyAuthorized("/staff", session("STAFF", status))).toBe(false);
      expect(isProxyAuthorized("/admin", session("ADMIN", status))).toBe(false);
      expect(
        getProxyAuthorizationOutcome("/admin", session("ADMIN", status)),
      ).toBe("SESSION_ENDED");
    },
  );
});

describe("post-authentication routing", () => {
  it.each([
    ["STUDENT", "/student"],
    ["STAFF", "/staff"],
    ["ADMIN", "/admin"],
  ] as const)("routes %s to %s", (role, expectedPath) => {
    expect(getPostAuthenticationPath(role)).toBe(expectedPath);
  });
});

describe("safe authentication callbacks", () => {
  const baseUrl = "https://portal.sist.example";

  it.each([
    [
      "/student/requests?status=open",
      `${baseUrl}/student/requests?status=open`,
    ],
    [`${baseUrl}/staff`, `${baseUrl}/staff`],
    ["/admin/users/pending", `${baseUrl}/admin/users/pending`],
  ])("accepts the internal portal callback %s", (url, expected) => {
    expect(getSafeCallbackUrl(url, baseUrl)).toBe(expected);
  });

  it.each([
    "https://attacker.example/staff",
    "//attacker.example/staff",
    "\\\\attacker.example\\staff",
    "/%2f%2fattacker.example/staff",
    "/student%2f..%2fadmin",
    "/api/auth/signout",
    "/unknown",
    "/staff#sensitive-fragment",
    "https%3A%2F%2Fattacker.example",
  ])("rejects the unsafe or unknown callback %s", (url) => {
    expect(getSafeCallbackUrl(url, baseUrl)).toBe(`${baseUrl}/auth/continue`);
  });
});

describe("minimal Auth.js claims", () => {
  it("retains only approved application and technical JWT claims", () => {
    const token = createMinimalJwt(
      {
        sub: "old-id",
        iat: 1,
        exp: 2,
        jti: "token-id",
        name: "Not retained",
        email: "not-retained@example.invalid",
        picture: "not-retained",
        passwordHash: "not-retained",
        studentProfile: { private: true },
        capabilities: ["MANAGE_STAFF_CAPABILITIES"],
      },
      {
        id: "user-id",
        role: "STAFF",
        status: "ACTIVE",
        sessionVersion: 7,
      },
    );
    expect(token).toEqual({
      sub: "user-id",
      iat: 1,
      exp: 2,
      jti: "token-id",
      role: "STAFF",
      status: "ACTIVE",
      sessionVersion: 7,
    });
  });
  it("constructs a session user containing only approved identity claims", () => {
    const result = createMinimalSession("expiry", {
      sub: "user-id",
      role: "ADMIN",
      status: "ACTIVE",
      sessionVersion: 3,
      email: "not-retained@example.invalid",
      name: "Not retained",
      picture: "not-retained",
      capabilities: ["MANAGE_STAFF_CAPABILITIES"],
    });
    expect(result).toEqual({
      expires: "expiry",
      user: {
        id: "user-id",
        role: "ADMIN",
        status: "ACTIVE",
        sessionVersion: 3,
      },
    });
    expect(Object.keys(result.user)).toEqual([
      "id",
      "role",
      "status",
      "sessionVersion",
    ]);
  });
  it.each([undefined, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid sessionVersion %s",
    (sessionVersion) => {
      expect(() =>
        createMinimalSession("expiry", {
          sub: "user-id",
          role: "STAFF",
          status: "ACTIVE",
          sessionVersion,
        }),
      ).toThrow("Invalid authenticated session claims.");
    },
  );
  it("retains a valid sessionVersion when refreshing an existing JWT", () => {
    expect(
      createMinimalJwt({
        sub: "user-id",
        role: "STAFF",
        status: "ACTIVE",
        sessionVersion: 11,
      }),
    ).toEqual({
      sub: "user-id",
      role: "STAFF",
      status: "ACTIVE",
      sessionVersion: 11,
    });
  });
});

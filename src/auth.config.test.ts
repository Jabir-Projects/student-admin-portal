import { describe, expect, it } from "vitest";

import {
  authConfig,
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
import {
  createSessionHistoryMarker,
  SESSION_HISTORY_COOKIE_NAME,
} from "@/features/auth/session-marker";

function session(role: UserRoleValue, status: AccountStatusValue) {
  return {
    expires: "2099-01-01T00:00:00.000Z",
    user: { id: "user-id", role, status, sessionVersion: 0 },
  };
}

describe("Proxy authorization", () => {
  it.each(["/student", "/student/requests", "/staff", "/staff/requests"])(
    "rejects unauthenticated access to %s",
    (pathname) => expect(isProxyAuthorized(pathname, null)).toBe(false),
  );
  it("enforces active student route boundaries", () => {
    const student = session("STUDENT", "ACTIVE");
    expect(isProxyAuthorized("/student", student)).toBe(true);
    expect(isProxyAuthorized("/student/requests", student)).toBe(true);
    expect(isProxyAuthorized("/staff", student)).toBe(false);
  });
  it("distinguishes first-time, ended-session, and wrong-role access", () => {
    expect(getProxyAuthorizationOutcome("/staff", null, false)).toBe("LOGIN");
    expect(getProxyAuthorizationOutcome("/staff", null, true)).toBe(
      "SESSION_ENDED",
    );
    expect(
      getProxyAuthorizationOutcome("/staff", session("STUDENT", "ACTIVE")),
    ).toBe("UNAUTHORIZED");
  });
  it("uses only verified server-managed evidence for ended-session UX", async () => {
    const previousSecret = process.env.AUTH_SECRET;
    const authenticationSecret = "test-authentication-secret-value-1234";
    process.env.AUTH_SECRET = authenticationSecret;
    const marker = await createSessionHistoryMarker(authenticationSecret);
    const authorized = authConfig.callbacks.authorized;
    const request = {
      cookies: {
        get: (name: string) =>
          name === SESSION_HISTORY_COOKIE_NAME ? { value: marker } : undefined,
      },
      nextUrl: new URL("https://portal.sist.example/staff"),
    };

    try {
      await expect(
        authorized({ auth: null, request } as never),
      ).resolves.toMatchObject({
        status: 307,
      });
      const response = await authorized({ auth: null, request } as never);
      expect(response).toBeInstanceOf(Response);
      expect((response as Response).headers.get("location")).toBe(
        "https://portal.sist.example/login?reason=session-ended",
      );

      request.cookies.get = () => ({ value: "browser-created-value" });
      await expect(authorized({ auth: null, request } as never)).resolves.toBe(
        false,
      );

      request.cookies.get = () => undefined;
      await expect(authorized({ auth: null, request } as never)).resolves.toBe(
        false,
      );
    } finally {
      if (previousSecret === undefined) delete process.env.AUTH_SECRET;
      else process.env.AUTH_SECRET = previousSecret;
    }
  });
  it("allows active staff only through the staff route boundary", () => {
    const staff = session("STAFF", "ACTIVE");
    expect(isProxyAuthorized("/staff", staff)).toBe(true);
    expect(isProxyAuthorized("/staff/requests", staff)).toBe(true);
    expect(isProxyAuthorized("/student", staff)).toBe(false);
  });
  it.each(["PENDING_APPROVAL", "DISABLED"] as const)(
    "rejects %s accounts",
    (status) => {
      expect(isProxyAuthorized("/student", session("STUDENT", status))).toBe(
        false,
      );
      expect(isProxyAuthorized("/staff", session("STAFF", status))).toBe(false);
      expect(
        getProxyAuthorizationOutcome("/staff", session("STAFF", status)),
      ).toBe("SESSION_ENDED");
    },
  );
});

describe("post-authentication routing", () => {
  it.each([
    ["STUDENT", "/student"],
    ["STAFF", "/staff"],
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
    ["/staff", `${baseUrl}/staff`],
    ["/student/profile/%E2%9C%93", `${baseUrl}/student/profile/%E2%9C%93`],
    [
      "/staff/reports?completion=100%25",
      `${baseUrl}/staff/reports?completion=100%25`,
    ],
  ])("accepts the internal portal callback %s", (url, expected) => {
    expect(getSafeCallbackUrl(url, baseUrl)).toBe(expected);
  });

  it.each([
    " /staff",
    "/staff ",
    "\t/student",
    "/student\r",
    "/stu\ndent",
    "/student\u0000",
    "/student\u001f",
    "/student\u007f",
    "/staff/%20",
    "/staff?query=%20",
    "/staff/%2520",
    "/student\\requests",
    "/student%2frequests",
    "/student%5crequests",
    "/student/%252f..%252fadmin",
    "/student/%255c..%255cadmin",
    "/student/%25%32%66..%25%32%66admin",
    "/student/%25%32%46..%25%32%46admin",
    "/student/%25%35%63..%25%35%63admin",
    "/student/%25%35%43..%25%35%43admin",
    "/student/%2e%2e/admin",
    "/student/%252e%252e/admin",
    "/student/%25%32%65%25%32%65/admin",
    "/student/%25%32%45%25%32%45/admin",
    "/student/%2525252e%2525252e/admin",
    "/student/%25%32%35%25%33%32%25%36%35%25%32%35%25%33%32%25%36%35/admin",
    "/student/%2525252541",
    "/student/%",
    "/student/%2",
    "/student/%GG",
    "/student/%ff",
    `${baseUrl}/staff`,
    "https://attacker.example/staff",
    "https://user@portal.sist.example/staff",
    "//attacker.example/staff",
    "\\\\attacker.example\\staff",
    "/%2f%2fattacker.example/staff",
    "/student%2f..%2fadmin",
    "/student/../admin",
    "/login",
    "/login?callbackUrl=/staff",
    "/auth/continue",
    "/admin",
    "/admin/users/pending",
    "/api/auth/signin",
    "/api/auth/callback/credentials",
    "/api/auth/signout",
    "/unknown",
    "/staff#sensitive-fragment",
    "https%3A%2F%2Fattacker.example",
  ])("rejects the unsafe or unknown callback %s", (url) => {
    expect(getSafeCallbackUrl(url, baseUrl)).toBe(`${baseUrl}/auth/continue`);
  });

  it("does not let an accepted callback change role authorization", () => {
    const callback = new URL(getSafeCallbackUrl("/staff", baseUrl));

    expect(
      getProxyAuthorizationOutcome(
        callback.pathname,
        session("STUDENT", "ACTIVE"),
      ),
    ).toBe("UNAUTHORIZED");
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
      role: "STAFF",
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
        role: "STAFF",
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

// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookieDelete: vi.fn(),
  cookieSet: vi.fn(),
  redirect: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/auth", () => ({
  signIn: mocks.signIn,
  signOut: mocks.signOut,
}));
vi.mock("next-auth", () => ({
  AuthError: class AuthError extends Error {
    code?: string;
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    delete: mocks.cookieDelete,
    set: mocks.cookieSet,
  }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { loginAction } from "@/app/login/actions";
import { logoutAction } from "@/app/logout/actions";
import {
  isValidSessionHistoryMarker,
  SESSION_HISTORY_COOKIE_NAME,
} from "@/features/auth/session-marker";

const redirectSignal = new Error("NEXT_REDIRECT_TEST_SIGNAL");
const authenticationSecret = "test-authentication-secret-value-1234";
const previousAuthenticationSecret = process.env.AUTH_SECRET;

function loginFormData(): FormData {
  const formData = new FormData();
  formData.set("email", "student@example.com");
  formData.set("password", "a secure password");
  formData.set("callbackUrl", "/student/requests?status=open");
  return formData;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUTH_SECRET = authenticationSecret;
  mocks.redirect.mockImplementation(() => {
    throw redirectSignal;
  });
});

afterEach(() => {
  if (previousAuthenticationSecret === undefined) {
    delete process.env.AUTH_SECRET;
  } else {
    process.env.AUTH_SECRET = previousAuthenticationSecret;
  }
});

describe("authentication session history lifecycle", () => {
  it("issues non-sensitive server-authenticated evidence after successful sign-in", async () => {
    mocks.signIn.mockResolvedValue(
      "https://portal.sist.example/student/requests?status=open",
    );

    await expect(loginAction(loginFormData())).rejects.toBe(redirectSignal);

    expect(mocks.signIn).toHaveBeenCalledWith("credentials", {
      email: "student@example.com",
      password: "a secure password",
      redirect: false,
      redirectTo: "/student/requests?status=open",
    });
    expect(mocks.cookieSet).toHaveBeenCalledOnce();
    const [name, marker, options] = mocks.cookieSet.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(name).toBe(SESSION_HISTORY_COOKIE_NAME);
    await expect(
      isValidSessionHistoryMarker(marker, authenticationSecret),
    ).resolves.toBe(true);
    expect(options).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    });
    expect(marker).not.toContain("student@example.com");
    expect(mocks.redirect).toHaveBeenCalledWith(
      "https://portal.sist.example/student/requests?status=open",
    );
  });

  it("does not issue previous-session evidence when sign-in fails", async () => {
    const signInFailure = new Error("sign-in failed");
    mocks.signIn.mockRejectedValue(signInFailure);

    await expect(loginAction(loginFormData())).rejects.toBe(signInFailure);

    expect(mocks.cookieSet).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it.each([
    [
      "pending account",
      "https://portal.sist.example/login?error=CredentialsSignin&code=pending_approval",
      "/pending-approval",
    ],
    [
      "disabled account",
      "https://portal.sist.example/login?error=CredentialsSignin&code=account_disabled",
      "/login?error=disabled",
    ],
    [
      "invalid credentials",
      "https://portal.sist.example/login?error=CredentialsSignin&code=credentials",
      "/login?error=invalid",
    ],
  ])(
    "routes Auth.js %s response without creating a session marker",
    async (_case, destination, expectedRedirect) => {
      mocks.signIn.mockResolvedValue(destination);

      await expect(loginAction(loginFormData())).rejects.toBe(redirectSignal);

      expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith(expectedRedirect);
      expect(mocks.cookieSet).not.toHaveBeenCalled();
    },
  );

  it.each([
    "/student/%252f..%252fadmin",
    "/student/%25%32%66..%25%32%66admin",
    "/student/%25%32%65%25%32%65/admin",
    "/staff/%2520",
  ])(
    "replaces the suspicious raw callback %s before passing it to Auth.js",
    async (callbackUrl) => {
      mocks.signIn.mockResolvedValue(
        "https://portal.sist.example/auth/continue",
      );
      const formData = loginFormData();
      formData.set("callbackUrl", callbackUrl);

      await expect(loginAction(formData)).rejects.toBe(redirectSignal);

      expect(mocks.signIn).toHaveBeenCalledWith(
        "credentials",
        expect.objectContaining({ redirectTo: "/auth/continue" }),
      );
    },
  );

  it("clears previous-session evidence after explicit sign-out", async () => {
    mocks.signOut.mockResolvedValue(new Response());

    await expect(logoutAction()).rejects.toBe(redirectSignal);

    expect(mocks.signOut).toHaveBeenCalledWith({
      redirect: false,
      redirectTo: "/login",
    });
    expect(mocks.cookieDelete).toHaveBeenCalledExactlyOnceWith(
      SESSION_HISTORY_COOKIE_NAME,
    );
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/login");
  });
});

import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { NextAuthConfig } from "next-auth";

import {
  ACCOUNT_STATUSES,
  type AccountStatusValue,
  USER_ROLES,
  type UserRoleValue,
} from "@/features/auth/constants";
import {
  isValidSessionHistoryMarker,
  SESSION_HISTORY_COOKIE_NAME,
} from "@/features/auth/session-marker";

type ApprovedUserClaims = {
  id?: string;
  role: UserRoleValue;
  status: AccountStatusValue;
  sessionVersion: number;
};

function isUserRole(value: unknown): value is UserRoleValue {
  return USER_ROLES.some((role) => role === value);
}

function isAccountStatus(value: unknown): value is AccountStatusValue {
  return ACCOUNT_STATUSES.some((status) => status === value);
}

function isSessionVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function createMinimalJwt(token: JWT, user?: ApprovedUserClaims): JWT {
  const minimalToken: JWT = {};
  const subject = user?.id ?? token.sub;
  const role = user?.role ?? token.role;
  const status = user?.status ?? token.status;
  const sessionVersion = user?.sessionVersion ?? token.sessionVersion;

  if (subject) minimalToken.sub = subject;
  if (typeof token.iat === "number") minimalToken.iat = token.iat;
  if (typeof token.exp === "number") minimalToken.exp = token.exp;
  if (typeof token.jti === "string") minimalToken.jti = token.jti;
  if (isUserRole(role)) minimalToken.role = role;
  if (isAccountStatus(status)) minimalToken.status = status;
  if (isSessionVersion(sessionVersion))
    minimalToken.sessionVersion = sessionVersion;

  return minimalToken;
}

export function createMinimalSession(expires: string, token: JWT): Session {
  if (
    !token.sub ||
    !isUserRole(token.role) ||
    !isAccountStatus(token.status) ||
    !isSessionVersion(token.sessionVersion)
  ) {
    throw new Error("Invalid authenticated session claims.");
  }
  return {
    expires,
    user: {
      id: token.sub,
      role: token.role,
      status: token.status,
      sessionVersion: token.sessionVersion,
    },
  };
}

export function isProxyAuthorized(
  pathname: string,
  session: Session | null,
): boolean {
  return getProxyAuthorizationOutcome(pathname, session) === "ALLOW";
}

export type ProxyAuthorizationOutcome =
  "ALLOW" | "LOGIN" | "SESSION_ENDED" | "UNAUTHORIZED";

export function getProxyAuthorizationOutcome(
  pathname: string,
  session: Session | null,
  hasPreviousAuthentication = false,
): ProxyAuthorizationOutcome {
  const isStudentRoute =
    pathname === "/student" || pathname.startsWith("/student/");
  const isStaffRoute = pathname === "/staff" || pathname.startsWith("/staff/");
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  if (!isStudentRoute && !isStaffRoute && !isAdminRoute) return "ALLOW";
  if (!session) return hasPreviousAuthentication ? "SESSION_ENDED" : "LOGIN";
  if (session.user.status !== "ACTIVE") return "SESSION_ENDED";
  if (isStudentRoute)
    return session.user.role === "STUDENT" ? "ALLOW" : "UNAUTHORIZED";
  if (isStaffRoute)
    return session.user.role === "STAFF" ? "ALLOW" : "UNAUTHORIZED";
  return session.user.role === "STAFF" || session.user.role === "ADMIN"
    ? "ALLOW"
    : "UNAUTHORIZED";
}

export function getPostAuthenticationPath(
  role: UserRoleValue,
): "/admin" | "/staff" | "/student" {
  if (role === "STAFF") return "/staff";
  return role === "ADMIN" ? "/admin" : "/student";
}

const safeCallbackRoots = ["/student", "/staff", "/admin"] as const;
const asciiControlCharacter = /[\u0000-\u001f\u007f]/u;
const unsafeEncodedValue = /%(?:25)*(?:0[0-9a-f]|1[0-9a-f]|2e|2f|5c|7f)/iu;
const malformedPercentEncoding = /%(?![0-9a-f]{2})/iu;
const rawTraversalSegment = /(?:^|\/)\.{1,2}(?:\/|$)/u;

function isSafeCallbackPath(pathname: string): boolean {
  return safeCallbackRoots.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  );
}

export function getSafeCallbackPath(url: string): string {
  const fallback = "/auth/continue";
  const rawPath = url.split(/[?#]/u, 1)[0] ?? "";
  if (
    url.length === 0 ||
    url.length > 2048 ||
    url !== url.trim() ||
    asciiControlCharacter.test(url) ||
    url.includes("\\") ||
    url.includes("#") ||
    malformedPercentEncoding.test(url) ||
    unsafeEncodedValue.test(url) ||
    !url.startsWith("/") ||
    url.startsWith("//") ||
    rawTraversalSegment.test(rawPath)
  ) {
    return fallback;
  }

  let candidate: URL;
  try {
    candidate = new URL(url, "https://internal.invalid");
  } catch {
    return fallback;
  }
  if (
    candidate.origin !== "https://internal.invalid" ||
    candidate.hash ||
    !isSafeCallbackPath(candidate.pathname)
  ) {
    return fallback;
  }
  return `${candidate.pathname}${candidate.search}`;
}

export function getSafeCallbackUrl(url: string, baseUrl: string): string {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return "/auth/continue";
  }
  return new URL(getSafeCallbackPath(url), base).toString();
}

export const authConfig = {
  providers: [],
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  callbacks: {
    jwt({ token, user }) {
      return createMinimalJwt(token, user);
    },
    session({ session, token }) {
      return createMinimalSession(session.expires, token);
    },
    async authorized({ auth, request }) {
      const hasPreviousAuthentication = await isValidSessionHistoryMarker(
        request.cookies.get(SESSION_HISTORY_COOKIE_NAME)?.value,
        process.env.AUTH_SECRET,
      );
      const outcome = getProxyAuthorizationOutcome(
        request.nextUrl.pathname,
        auth,
        hasPreviousAuthentication,
      );
      if (outcome === "ALLOW") return true;
      if (outcome === "LOGIN") return false;
      const destination =
        outcome === "SESSION_ENDED"
          ? "/login?reason=session-ended"
          : "/unauthorized";
      return Response.redirect(new URL(destination, request.nextUrl), 307);
    },
  },
} satisfies NextAuthConfig;

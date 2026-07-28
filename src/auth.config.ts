import type { Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { NextAuthConfig } from "next-auth";

import {
  ACCOUNT_STATUSES,
  type AccountStatusValue,
  USER_ROLES,
  type UserRoleValue,
} from "@/features/auth/constants";

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
): ProxyAuthorizationOutcome {
  const isStudentRoute =
    pathname === "/student" || pathname.startsWith("/student/");
  const isStaffRoute = pathname === "/staff" || pathname.startsWith("/staff/");
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  if (!isStudentRoute && !isStaffRoute && !isAdminRoute) return "ALLOW";
  if (!session) return "LOGIN";
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
const unsafeEncodedPath = /%(?:00|0a|0d|2f|5c)/iu;
const malformedPercentEncoding = /%(?![0-9a-f]{2})/iu;

function isSafeCallbackPath(pathname: string): boolean {
  if (pathname === "/auth/continue") return true;
  return safeCallbackRoots.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  );
}

export function getSafeCallbackUrl(url: string, baseUrl: string): string {
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return "/auth/continue";
  }
  const fallback = new URL("/auth/continue", base).toString();
  if (url.includes("\\") || malformedPercentEncoding.test(url)) return fallback;

  let candidate: URL;
  try {
    candidate = new URL(url, base);
  } catch {
    return fallback;
  }
  const authorityEnd = candidate.href.indexOf(
    "/",
    candidate.protocol.length + 2,
  );
  const authority = candidate.href.slice(
    candidate.protocol.length + 2,
    authorityEnd,
  );
  if (
    candidate.origin !== base.origin ||
    candidate.username ||
    authority.includes("@") ||
    candidate.hash ||
    unsafeEncodedPath.test(candidate.pathname) ||
    !isSafeCallbackPath(candidate.pathname)
  ) {
    return fallback;
  }
  if (candidate.pathname === "/auth/continue") return fallback;
  return new URL(`${candidate.pathname}${candidate.search}`, base).toString();
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
    authorized({ auth, request }) {
      const outcome = getProxyAuthorizationOutcome(
        request.nextUrl.pathname,
        auth,
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

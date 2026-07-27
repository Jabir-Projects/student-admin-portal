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
  const isStudentRoute =
    pathname === "/student" || pathname.startsWith("/student/");
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  if (!isStudentRoute && !isAdminRoute) return true;
  if (!session || session.user.status !== "ACTIVE") return false;
  if (isStudentRoute) return session.user.role === "STUDENT";
  return session.user.role === "ADMIN";
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
      return isProxyAuthorized(request.nextUrl.pathname, auth);
    },
  },
} satisfies NextAuthConfig;

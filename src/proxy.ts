import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";
import { getAuthorizationFailureDestination } from "@/features/auth/session-ux";
import { getStaffShellUserByClaims } from "@/server/auth/dal.node";
import { db } from "@/server/db";

const protectedRouteCapabilities = [
  {
    pathname: "/staff/student-accounts",
    capabilities: [
      "MANAGE_STUDENT_ACCOUNTS",
      "REACTIVATE_STUDENT_ACCOUNTS",
      "EXPORT_STUDENT_DATA",
    ],
  },
  {
    pathname: "/staff/staff-capabilities",
    capabilities: ["MANAGE_STAFF_ACCOUNTS", "MANAGE_STAFF_CAPABILITIES"],
  },
  {
    pathname: "/staff/imports/registry",
    capabilities: ["REGISTRY_IMPORT_UPLOAD", "REGISTRY_IMPORT_APPROVE"],
  },
  {
    pathname: "/staff/finance/imports",
    capabilities: ["FINANCE_IMPORT_UPLOAD", "FINANCE_IMPORT_APPROVE"],
  },
  {
    pathname: "/staff/documents",
    capabilities: [
      "GENERATE_DOCUMENTS",
      "RELEASE_DOCUMENTS",
      "REVOKE_DOCUMENTS",
    ],
  },
] as const;

function capabilitiesForPathname(pathname: string) {
  return protectedRouteCapabilities.find((route) => route.pathname === pathname)
    ?.capabilities;
}

const { auth } = NextAuth(authConfig);

export default auth(async (request) => {
  const sessionAuthorization = await authConfig.callbacks.authorized({
    auth: request.auth,
    request,
  });
  if (sessionAuthorization !== true) {
    return sessionAuthorization instanceof Response
      ? sessionAuthorization
      : NextResponse.redirect(new URL("/login", request.url), 307);
  }

  const requiredCapabilities = capabilitiesForPathname(
    request.nextUrl.pathname,
  );
  if (!requiredCapabilities) return NextResponse.next();

  const actor = await getStaffShellUserByClaims(
    {
      actorId: request.auth?.user.id,
      claimedSessionVersion: request.auth?.user.sessionVersion,
    },
    db,
  );
  if (!actor.ok) {
    return NextResponse.redirect(
      new URL(getAuthorizationFailureDestination(actor.reason), request.url),
      307,
    );
  }
  if (
    !requiredCapabilities.some((capability) =>
      actor.user.capabilities.includes(capability),
    )
  ) {
    return NextResponse.redirect(new URL("/unauthorized", request.url), 307);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/student/:path*", "/staff/:path*"],
};

import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import type { SessionAuthorizationFailure } from "@/features/auth/session-ux";
import type { ActorSessionClaims } from "@/server/auth/capabilities";
import {
  getStaffShellUserByClaims,
  type StaffShellUser,
} from "@/server/auth/dal.node";

export type PackageDPage = "student-accounts" | "staff-management";
export type PackageDReadCapability =
  | "MANAGE_STUDENT_ACCOUNTS"
  | "REACTIVATE_STUDENT_ACCOUNTS"
  | "MANAGE_STAFF_ACCOUNTS"
  | "MANAGE_STAFF_CAPABILITIES";

export type PackageDAuthorizationResult =
  | { ok: true; actor: StaffShellUser }
  | { ok: false; reason: SessionAuthorizationFailure | "MISSING_CAPABILITY" };

const pageCapabilities = {
  "student-accounts": [
    "MANAGE_STUDENT_ACCOUNTS",
    "REACTIVATE_STUDENT_ACCOUNTS",
  ],
  "staff-management": ["MANAGE_STAFF_ACCOUNTS", "MANAGE_STAFF_CAPABILITIES"],
} as const satisfies Record<PackageDPage, readonly PackageDReadCapability[]>;

export async function authorizePackageDPageEntry(
  claims: ActorSessionClaims,
  page: PackageDPage,
  database: PrismaClient,
): Promise<PackageDAuthorizationResult> {
  const actor = await getStaffShellUserByClaims(claims, database);
  if (!actor.ok) return actor;

  const allowed = pageCapabilities[page].some((capability) =>
    actor.user.capabilities.includes(capability),
  );
  return allowed
    ? { ok: true, actor: actor.user }
    : { ok: false, reason: "MISSING_CAPABILITY" };
}

export async function authorizePackageDRead(
  claims: ActorSessionClaims,
  capability: PackageDReadCapability,
  database: PrismaClient,
): Promise<PackageDAuthorizationResult> {
  const actor = await getStaffShellUserByClaims(claims, database);
  if (!actor.ok) return actor;
  return actor.user.capabilities.includes(capability)
    ? { ok: true, actor: actor.user }
    : { ok: false, reason: "MISSING_CAPABILITY" };
}

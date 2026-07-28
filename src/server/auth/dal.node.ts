import "server-only";

import type {
  AccountStatusValue,
  CapabilityValue,
  UserRoleValue,
} from "@/features/auth/constants";
import type { SessionAuthorizationFailure } from "@/features/auth/session-ux";
import type { PrismaClient } from "@/generated/prisma/client";
import type { ActorSessionClaims } from "@/server/auth/capabilities";

export type AuthorizedUser = {
  id: string;
  role: UserRoleValue;
  status: Extract<AccountStatusValue, "ACTIVE">;
  sessionVersion: number;
  fullName: string;
};

export type StaffShellUser = Omit<AuthorizedUser, "role"> & {
  role: "STAFF";
  capabilities: readonly CapabilityValue[];
};

export type SessionUserResult =
  | { ok: true; user: AuthorizedUser }
  | {
      ok: false;
      reason: Exclude<SessionAuthorizationFailure, "WRONG_ROLE">;
    };

export type StaffShellUserResult =
  | { ok: true; user: StaffShellUser }
  | {
      ok: false;
      reason: SessionAuthorizationFailure;
    };

export async function getSessionUserByClaims(
  claims: ActorSessionClaims,
  database: PrismaClient,
): Promise<SessionUserResult> {
  if (!claims.actorId) return { ok: false, reason: "UNAUTHENTICATED" };
  const user = await database.user.findUnique({
    where: { id: claims.actorId },
    select: {
      id: true,
      role: true,
      status: true,
      sessionVersion: true,
      fullName: true,
    },
  });
  if (!user) return { ok: false, reason: "UNAUTHENTICATED" };
  if (user.status === "DISABLED")
    return { ok: false, reason: "DISABLED_ACCOUNT" };
  if (user.status !== "ACTIVE")
    return { ok: false, reason: "INACTIVE_ACCOUNT" };
  if (
    typeof claims.claimedSessionVersion !== "number" ||
    !Number.isSafeInteger(claims.claimedSessionVersion) ||
    claims.claimedSessionVersion < 0 ||
    user.sessionVersion !== claims.claimedSessionVersion
  ) {
    return { ok: false, reason: "STALE_SESSION" };
  }
  return { ok: true, user: { ...user, status: "ACTIVE" } };
}

export async function getActiveUserById(
  userId: string,
  database: PrismaClient,
): Promise<AuthorizedUser | null> {
  const user = await database.user.findFirst({
    where: { id: userId, status: "ACTIVE" },
    select: {
      id: true,
      role: true,
      status: true,
      sessionVersion: true,
      fullName: true,
    },
  });
  return user ? { ...user, status: "ACTIVE" } : null;
}

export async function getStaffShellUserByClaims(
  claims: ActorSessionClaims,
  database: PrismaClient,
): Promise<StaffShellUserResult> {
  if (!claims.actorId) return { ok: false, reason: "UNAUTHENTICATED" };
  const user = await database.user.findUnique({
    where: { id: claims.actorId },
    select: {
      id: true,
      role: true,
      status: true,
      sessionVersion: true,
      fullName: true,
      capabilityAssignments: { select: { capability: true } },
    },
  });
  if (!user) return { ok: false, reason: "UNAUTHENTICATED" };
  if (user.status === "DISABLED")
    return { ok: false, reason: "DISABLED_ACCOUNT" };
  if (user.status !== "ACTIVE")
    return { ok: false, reason: "INACTIVE_ACCOUNT" };
  if (
    typeof claims.claimedSessionVersion !== "number" ||
    !Number.isSafeInteger(claims.claimedSessionVersion) ||
    claims.claimedSessionVersion < 0 ||
    user.sessionVersion !== claims.claimedSessionVersion
  ) {
    return { ok: false, reason: "STALE_SESSION" };
  }
  if (user.role !== "STAFF") return { ok: false, reason: "WRONG_ROLE" };
  return {
    ok: true,
    user: {
      id: user.id,
      role: "STAFF",
      status: "ACTIVE",
      sessionVersion: user.sessionVersion,
      fullName: user.fullName,
      capabilities: user.capabilityAssignments.map(
        ({ capability }) => capability,
      ),
    },
  };
}

export async function findOwnedStudentProfile(
  userId: string,
  studentProfileId: string,
  database: PrismaClient,
): Promise<{ id: string } | null> {
  return database.studentProfile.findFirst({
    where: { id: studentProfileId, userId },
    select: { id: true },
  });
}

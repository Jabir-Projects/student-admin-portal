import "server-only";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import type { UserRoleValue } from "@/features/auth/constants";
import {
  findOwnedStudentProfile,
  getSessionUserByClaims,
  type AuthorizedUser,
} from "@/server/auth/dal.node";
import { db } from "@/server/db";

export async function getActiveUser(): Promise<AuthorizedUser | null> {
  const session = await auth();
  const result = await getSessionUserByClaims(
    {
      actorId: session?.user.id,
      claimedSessionVersion: session?.user.sessionVersion,
    },
    db,
  );
  return result.ok ? result.user : null;
}

export async function requireActiveUser(
  roles: UserRoleValue | readonly UserRoleValue[],
): Promise<AuthorizedUser> {
  const session = await auth();
  const result = await getSessionUserByClaims(
    {
      actorId: session?.user.id,
      claimedSessionVersion: session?.user.sessionVersion,
    },
    db,
  );
  if (!result.ok) redirect("/login");
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  if (!allowedRoles.some((role) => role === result.user.role))
    redirect("/unauthorized");
  return result.user;
}

export async function requireOwnedStudentProfile(
  studentProfileId: string,
): Promise<{ id: string }> {
  const user = await requireActiveUser("STUDENT");
  const profile = await findOwnedStudentProfile(user.id, studentProfileId, db);
  if (!profile) redirect("/unauthorized");
  return profile;
}

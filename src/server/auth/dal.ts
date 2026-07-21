import "server-only";

import { redirect } from "next/navigation";

import { auth } from "@/auth";
import type { UserRoleValue } from "@/features/auth/constants";
import {
  findOwnedStudentProfile,
  getActiveUserById,
  type AuthorizedUser,
} from "@/server/auth/dal.node";
import { db } from "@/server/db";

export async function getActiveUser(): Promise<AuthorizedUser | null> {
  const session = await auth();
  if (!session?.user.id) return null;
  return getActiveUserById(session.user.id, db);
}

export async function requireActiveUser(
  role: UserRoleValue,
): Promise<AuthorizedUser> {
  const user = await getActiveUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect("/unauthorized");
  return user;
}

export async function requireOwnedStudentProfile(
  studentProfileId: string,
): Promise<{ id: string }> {
  const user = await requireActiveUser("STUDENT");
  const profile = await findOwnedStudentProfile(user.id, studentProfileId, db);
  if (!profile) redirect("/unauthorized");
  return profile;
}

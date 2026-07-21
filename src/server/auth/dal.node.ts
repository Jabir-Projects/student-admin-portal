import "server-only";

import type { UserRoleValue } from "@/features/auth/constants";
import type { PrismaClient } from "@/generated/prisma/client";

export type AuthorizedUser = {
  id: string;
  role: UserRoleValue;
  fullName: string;
};

export async function getActiveUserById(
  userId: string,
  database: PrismaClient,
): Promise<AuthorizedUser | null> {
  return database.user.findFirst({
    where: { id: userId, status: "ACTIVE" },
    select: { id: true, role: true, fullName: true },
  });
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

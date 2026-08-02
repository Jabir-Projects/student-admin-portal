import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type {
  ActorSessionClaims,
  AuthorizationFailure,
} from "@/server/auth/capabilities";

export type StudentPortalActor = {
  id: string;
  profileId: string;
  fullName: string;
  email: string;
  studentNumber: string;
  program: string;
  academicYear: string;
  status: "ACTIVE";
};

export type StudentAuthorizationResult =
  | { ok: true; actor: StudentPortalActor }
  | { ok: false; reason: AuthorizationFailure };

type StudentActorRow = {
  id: string;
  role: "STUDENT" | "STAFF";
  status: "PENDING_APPROVAL" | "ACTIVE" | "DISABLED";
  sessionVersion: number;
  fullName: string;
  email: string;
};

function authorize(
  user: StudentActorRow | null,
  profile: {
    id: string;
    studentNumber: string;
    program: string;
    academicYear: string;
  } | null,
  claims: ActorSessionClaims,
): StudentAuthorizationResult {
  if (!user) return { ok: false, reason: "UNAUTHENTICATED" };
  if (user.status === "DISABLED")
    return { ok: false, reason: "DISABLED_ACCOUNT" };
  if (user.status !== "ACTIVE")
    return { ok: false, reason: "INACTIVE_ACCOUNT" };
  if (user.role !== "STUDENT") return { ok: false, reason: "WRONG_ROLE" };
  if (
    !Number.isSafeInteger(claims.claimedSessionVersion) ||
    claims.claimedSessionVersion !== user.sessionVersion
  ) {
    return { ok: false, reason: "STALE_SESSION" };
  }
  if (!profile) return { ok: false, reason: "UNAUTHENTICATED" };
  return {
    ok: true,
    actor: {
      id: user.id,
      profileId: profile.id,
      fullName: user.fullName,
      email: user.email,
      studentNumber: profile.studentNumber,
      program: profile.program,
      academicYear: profile.academicYear,
      status: "ACTIVE",
    },
  };
}

export async function authorizeStudentActor(
  claims: ActorSessionClaims,
  database: PrismaClient,
): Promise<StudentAuthorizationResult> {
  if (!claims.actorId) return { ok: false, reason: "UNAUTHENTICATED" };
  const user = await database.user.findUnique({
    where: { id: claims.actorId },
    select: {
      id: true,
      role: true,
      status: true,
      sessionVersion: true,
      fullName: true,
      email: true,
      studentProfile: {
        select: {
          id: true,
          studentNumber: true,
          program: true,
          academicYear: true,
        },
      },
    },
  });
  return authorize(user, user?.studentProfile ?? null, claims);
}

export async function revalidateStudentActorInTransaction(
  transaction: Prisma.TransactionClient,
  claims: ActorSessionClaims,
): Promise<StudentAuthorizationResult> {
  if (!claims.actorId) return { ok: false, reason: "UNAUTHENTICATED" };
  const rows = await transaction.$queryRaw<StudentActorRow[]>(Prisma.sql`
    SELECT "id"::text AS "id", "role", "status", "sessionVersion", "fullName", "email"
    FROM "User"
    WHERE "id" = CAST(${claims.actorId} AS UUID)
    FOR UPDATE
  `);
  const user = rows[0] ?? null;
  const profile = user
    ? await transaction.studentProfile.findUnique({
        where: { userId: user.id },
        select: {
          id: true,
          studentNumber: true,
          program: true,
          academicYear: true,
        },
      })
    : null;
  return authorize(user, profile, claims);
}

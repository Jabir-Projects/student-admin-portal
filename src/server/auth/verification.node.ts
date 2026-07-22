import "server-only";

import {
  Prisma,
  type PrismaClient,
  StudentRegistrySource,
  StudentRegistryStatus,
} from "@/generated/prisma/client";
import {
  type StudentRegistryEntry,
  studentRegistryEntrySchema,
} from "@/features/student-registry/schemas";

const developmentAndTestSources = [
  StudentRegistrySource.DEVELOPMENT_DEMO,
  StudentRegistrySource.OFFICIAL_IMPORT,
] satisfies StudentRegistrySource[];

const productionSources = [
  StudentRegistrySource.OFFICIAL_IMPORT,
] satisfies StudentRegistrySource[];

type StudentRegistryLookupClient = Pick<PrismaClient, "studentRegistry">;

export type StudentRegistryMatch = { id: string };

export type StudentRegistryClaimInput = {
  registryId: string;
  identity: unknown;
  runtime: string | undefined;
  userId: string;
  claimedAt: Date;
};

export function getAllowedStudentRegistrySources(
  runtime: string | undefined,
): StudentRegistrySource[] {
  if (runtime === "development" || runtime === "test") {
    return [...developmentAndTestSources];
  }
  if (runtime === "production") return [...productionSources];

  throw new Error("Invalid Student Registry runtime configuration");
}

function buildStudentRegistryMatchPredicate(
  identity: StudentRegistryEntry,
  allowedSources: StudentRegistrySource[],
): Prisma.StudentRegistryWhereInput {
  return {
    studentNumber: identity.studentNumber,
    status: StudentRegistryStatus.ACTIVE,
    source: { in: allowedSources },
    email: identity.email,
    normalizedFullName: identity.normalizedFullName,
    program: identity.program,
    academicYear: identity.academicYear,
    registeredUserId: null,
    registeredAt: null,
  };
}

export async function findAvailableStudentRegistryEntry(
  database: StudentRegistryLookupClient,
  rawIdentity: unknown,
  runtime: string | undefined,
): Promise<StudentRegistryMatch | null> {
  const identity = studentRegistryEntrySchema.parse(rawIdentity);
  const allowedSources = getAllowedStudentRegistrySources(runtime);
  const match = await database.studentRegistry.findFirst({
    where: buildStudentRegistryMatchPredicate(identity, allowedSources),
    select: { id: true },
  });

  return match ? { id: match.id } : null;
}

export async function claimStudentRegistryEntry(
  transaction: Prisma.TransactionClient,
  input: StudentRegistryClaimInput,
): Promise<number> {
  const identity = studentRegistryEntrySchema.parse(input.identity);
  const allowedSources = getAllowedStudentRegistrySources(input.runtime);
  const result = await transaction.studentRegistry.updateMany({
    where: {
      id: input.registryId,
      ...buildStudentRegistryMatchPredicate(identity, allowedSources),
    },
    data: {
      registeredUserId: input.userId,
      registeredAt: input.claimedAt,
    },
  });

  return result.count;
}

import "server-only";

import { ZodError } from "zod";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { registrationSchema } from "@/features/auth/schemas";
import type { StudentRegistryEntry } from "@/features/student-registry/schemas";
import type { RegistrationVerificationMode } from "@/server/auth/env";
import { hashPassword } from "@/server/auth/password.node";
import {
  claimStudentRegistryEntry,
  findAvailableStudentRegistryEntry,
  type StudentRegistryMatch,
} from "@/server/auth/verification";

export type RegistrationResult = { ok: true } | { ok: false; message: string };

export type RegistrationServiceOptions = {
  verificationMode: RegistrationVerificationMode;
  runtime: string | undefined;
};

const genericRegistrationFailure = {
  ok: false,
  message:
    "The registration could not be submitted. Check the information or contact administration.",
} as const;

class RegistryClaimLostError extends Error {}

type RawStudentRegistryIdentity = Omit<
  StudentRegistryEntry,
  "normalizedFullName"
>;

function requireRegistrationRuntime(
  runtime: string | undefined,
): "development" | "test" | "production" {
  if (
    runtime === "development" ||
    runtime === "test" ||
    runtime === "production"
  ) {
    return runtime;
  }

  throw new Error("Invalid registration runtime configuration");
}

function isExpectedRegistrationFailure(error: unknown): boolean {
  if (error instanceof RegistryClaimLostError) return true;

  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2002" || error.code === "P2034")
  );
}

export async function registerStudentWithDatabase(
  rawInput: unknown,
  database: PrismaClient,
  options: RegistrationServiceOptions,
): Promise<RegistrationResult> {
  const parsed = registrationSchema.safeParse(rawInput);
  if (!parsed.success) return genericRegistrationFailure;

  const { confirmPassword, password, ...student } = parsed.data;
  void confirmPassword;
  const runtime = requireRegistrationRuntime(options.runtime);
  let registryContext: {
    identity: RawStudentRegistryIdentity;
    match: StudentRegistryMatch;
  } | null = null;

  if (options.verificationMode === "INTERNAL_REGISTRY") {
    const registryIdentity = {
      studentNumber: student.studentNumber,
      fullName: student.fullName,
      email: student.email,
      program: student.program,
      academicYear: student.academicYear,
    } satisfies RawStudentRegistryIdentity;

    let registryMatch: StudentRegistryMatch | null;
    try {
      registryMatch = await findAvailableStudentRegistryEntry(
        database,
        registryIdentity,
        runtime,
      );
    } catch (error) {
      if (error instanceof ZodError) return genericRegistrationFailure;
      throw error;
    }
    if (!registryMatch) return genericRegistrationFailure;
    registryContext = { identity: registryIdentity, match: registryMatch };
  } else if (options.verificationMode !== "MANUAL_APPROVAL") {
    throw new Error("Invalid registration verification mode configuration");
  }

  const passwordHash = await hashPassword(password);

  try {
    await database.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          email: student.email,
          fullName: student.fullName,
          passwordHash,
          role: "STUDENT",
          status: "PENDING_APPROVAL",
          studentProfile: {
            create: {
              studentNumber: student.studentNumber,
              program: student.program,
              academicYear: student.academicYear,
            },
          },
        },
        select: { id: true },
      });
      if (registryContext) {
        const claimedCount = await claimStudentRegistryEntry(transaction, {
          registryId: registryContext.match.id,
          identity: registryContext.identity,
          runtime,
          userId: user.id,
          claimedAt: new Date(),
        });
        if (claimedCount !== 1) throw new RegistryClaimLostError();
      }
      await transaction.auditLog.create({
        data: {
          action: "STUDENT_REGISTRATION_SUBMITTED",
          entityType: "User",
          entityId: user.id,
          metadata: { source: "public_registration" },
        },
      });
    });
    return { ok: true };
  } catch (error) {
    if (isExpectedRegistrationFailure(error)) return genericRegistrationFailure;
    throw error;
  }
}

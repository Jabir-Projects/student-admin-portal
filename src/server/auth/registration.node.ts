import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { registrationSchema } from "@/features/auth/schemas";
import { hashPassword } from "@/server/auth/password.node";
import { verifyStudentNumberInstitutionally } from "@/server/auth/verification";

export type RegistrationResult = { ok: true } | { ok: false; message: string };

export async function registerStudentWithDatabase(
  rawInput: unknown,
  database: PrismaClient,
): Promise<RegistrationResult> {
  const parsed = registrationSchema.safeParse(rawInput);
  if (!parsed.success)
    return {
      ok: false,
      message: "Please correct the highlighted information.",
    };

  const { confirmPassword, password, ...student } = parsed.data;
  void confirmPassword;
  await verifyStudentNumberInstitutionally(student.studentNumber);
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
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        message: "An account with these details cannot be created.",
      };
    }
    throw error;
  }
}

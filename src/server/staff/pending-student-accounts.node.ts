import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";

export const pendingStudentQueueLimit = 5;

export type PendingStudentAccount = {
  fullName: string;
  studentNumber: string;
  program: string;
  academicYear:
    "FOUNDATION" | "YEAR_1" | "YEAR_2" | "YEAR_3" | "MASTER_1" | "MASTER_2";
  submittedAt: Date;
};

export type PendingStudentAccountSummary = {
  totalCount: number;
  records: readonly PendingStudentAccount[];
};

const pendingStudentWhere = {
  role: "STUDENT",
  status: "PENDING_APPROVAL",
} as const;

export async function loadPendingStudentAccountSummary(
  database: PrismaClient,
): Promise<PendingStudentAccountSummary> {
  const [totalCount, users] = await Promise.all([
    database.user.count({ where: pendingStudentWhere }),
    database.user.findMany({
      where: pendingStudentWhere,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: pendingStudentQueueLimit,
      select: {
        fullName: true,
        createdAt: true,
        studentProfile: {
          select: {
            studentNumber: true,
            program: true,
            academicYear: true,
          },
        },
      },
    }),
  ]);

  const records = users.slice(0, pendingStudentQueueLimit).map((user) => {
    if (!user.studentProfile) {
      throw new Error(
        "Pending student account is missing its student profile.",
      );
    }
    return {
      fullName: user.fullName,
      studentNumber: user.studentProfile.studentNumber,
      program: user.studentProfile.program,
      academicYear: user.studentProfile.academicYear,
      submittedAt: user.createdAt,
    };
  });

  return { totalCount, records };
}

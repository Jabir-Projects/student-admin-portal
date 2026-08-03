import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  requestExportQuerySchema,
  studentExportQuerySchema,
} from "@/features/administration/schemas";
import type {
  ActorSessionClaims,
  AuthorizationFailure,
} from "@/server/auth/capabilities";
import { revalidateCapabilityActorInTransaction } from "@/server/auth/capabilities.node";
import { buildRequestWhere } from "@/server/administration/reads.node";

type ExportFailure = {
  ok: false;
  reason: AuthorizationFailure | "INVALID_INPUT";
};

type ExportSuccess = {
  ok: true;
  filename: string;
  body: string;
  rowCount: number;
};

export type CsvExportResult = ExportFailure | ExportSuccess;

function neutralizeFormula(value: string): string {
  const trimmed = value.trimStart();
  return /^[=+\-@]/u.test(trimmed) || /^[\t\r\n]/u.test(value)
    ? `'${value}`
    : value;
}

export function encodeCsv(rows: readonly (readonly unknown[])[]): string {
  const text = rows
    .map((row) =>
      row
        .map((cell) => {
          const value = neutralizeFormula(
            cell instanceof Date ? cell.toISOString() : String(cell ?? ""),
          );
          return `"${value.replaceAll('"', '""')}"`;
        })
        .join(","),
    )
    .join("\r\n");
  return `${text}\r\n`;
}

export async function exportStudentsAsActor(
  claims: ActorSessionClaims,
  input: unknown,
  database: PrismaClient,
): Promise<CsvExportResult> {
  const parsed = studentExportQuerySchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "INVALID_INPUT" };
  return database.$transaction(async (transaction) => {
    const authorization = await revalidateCapabilityActorInTransaction(
      transaction,
      claims,
      "EXPORT_STUDENT_DATA",
    );
    if (!authorization.ok) return authorization;
    const status =
      parsed.data.status === "pending"
        ? "PENDING_APPROVAL"
        : parsed.data.status === "active"
          ? "ACTIVE"
          : parsed.data.status === "disabled"
            ? "DISABLED"
            : undefined;
    const students = await transaction.user.findMany({
      where: {
        role: "STUDENT",
        ...(status ? { status } : {}),
        studentProfile: { isNot: null },
        ...(parsed.data.search
          ? {
              OR: [
                {
                  fullName: {
                    contains: parsed.data.search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
                {
                  studentProfile: {
                    is: {
                      studentNumber: {
                        contains: parsed.data.search,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 10_000,
      select: {
        fullName: true,
        email: true,
        status: true,
        studentProfile: {
          select: { studentNumber: true, program: true, academicYear: true },
        },
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId: authorization.actor.id,
        action: "STUDENT_DATA_EXPORTED",
        entityType: "StudentExport",
        entityId: "synchronous-csv",
        metadata: {
          filters: {
            searchApplied: Boolean(parsed.data.search),
            status: parsed.data.status,
          },
          rowCount: students.length,
        },
      },
    });
    return {
      ok: true as const,
      filename: "sist-students.csv",
      rowCount: students.length,
      body: encodeCsv([
        [
          "Full name",
          "Email",
          "Student number",
          "Program",
          "Academic year",
          "Account status",
        ],
        ...students.map((student) => [
          student.fullName,
          student.email,
          student.studentProfile?.studentNumber ?? "",
          student.studentProfile?.program ?? "",
          student.studentProfile?.academicYear ?? "",
          student.status,
        ]),
      ]),
    };
  });
}

export async function exportRequestsAsActor(
  claims: ActorSessionClaims,
  input: unknown,
  database: PrismaClient,
): Promise<CsvExportResult> {
  const parsed = requestExportQuerySchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "INVALID_INPUT" };
  return database.$transaction(async (transaction) => {
    const authorization = await revalidateCapabilityActorInTransaction(
      transaction,
      claims,
      "EXPORT_REQUEST_DATA",
    );
    if (!authorization.ok) return authorization;
    const requests = await transaction.documentRequest.findMany({
      where: buildRequestWhere(parsed.data),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 10_000,
      select: {
        referenceNumber: true,
        status: true,
        deliveryMethod: true,
        copyCount: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { name: true } },
        student: { select: { studentNumber: true } },
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId: authorization.actor.id,
        action: "REQUEST_DATA_EXPORTED",
        entityType: "RequestExport",
        entityId: "synchronous-csv",
        metadata: {
          filters: {
            status: parsed.data.status ?? null,
            categoryId: parsed.data.categoryId ?? null,
            referenceApplied: Boolean(parsed.data.reference),
            studentApplied: Boolean(parsed.data.student),
          },
          rowCount: requests.length,
        },
      },
    });
    return {
      ok: true as const,
      filename: "sist-requests.csv",
      rowCount: requests.length,
      body: encodeCsv([
        [
          "Request reference",
          "Student number",
          "Category name",
          "Status",
          "Delivery method",
          "Copy count",
          "Submitted timestamp",
          "Updated timestamp",
        ],
        ...requests.map((request) => [
          request.referenceNumber,
          request.student.studentNumber,
          request.category.name,
          request.status,
          request.deliveryMethod,
          request.copyCount,
          request.createdAt,
          request.updatedAt,
        ]),
      ]),
    };
  });
}

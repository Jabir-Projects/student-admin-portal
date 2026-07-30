import "server-only";

import {
  type CapabilityAssignmentReadInput,
  capabilityAssignmentReadInputSchema,
  type DisabledStudentReadInput,
  disabledStudentReadInputSchema,
  type ManagedStudentReadInput,
  managedStudentReadInputSchema,
  type StaffInventoryReadInput,
  staffInventoryReadInputSchema,
} from "@/features/account-management/schemas";
import type {
  AccountStatusValue,
  CapabilityValue,
} from "@/features/auth/constants";
import type { SessionAuthorizationFailure } from "@/features/auth/session-ux";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { createAccountReference } from "@/server/account-management/account-reference.node";
import { authorizePackageDRead } from "@/server/account-management/authorization.node";
import type { ActorSessionClaims } from "@/server/auth/capabilities";

type ReadFailure =
  | {
      ok: false;
      status: "denied";
      reason: SessionAuthorizationFailure | "MISSING_CAPABILITY";
    }
  | { ok: false; status: "invalid"; reason: "INVALID_INPUT" }
  | { ok: false; status: "unavailable"; reason: "READ_FAILED" };

type ReadPage<T> = {
  page: number;
  pageSize: number;
  totalCount: number;
  records: readonly T[];
};

export type CollectionReadResult<T> =
  | { ok: true; status: "success"; data: ReadPage<T> }
  | {
      ok: true;
      status: "empty";
      data: ReadPage<T> & { records: readonly [] };
    }
  | ReadFailure;

export type StudentAccountView = {
  accountReference: string;
  fullName: string;
  studentNumber: string;
  program: string;
  academicYear:
    "FOUNDATION" | "YEAR_1" | "YEAR_2" | "YEAR_3" | "MASTER_1" | "MASTER_2";
  status: AccountStatusValue;
  createdAt: Date;
  approvedAt: Date | null;
  disabledAt: Date | null;
};

export type StaffAccountView = {
  accountReference: string;
  fullName: string;
  role: "STAFF";
  status: Extract<AccountStatusValue, "ACTIVE" | "DISABLED">;
  createdAt: Date;
  disabledAt: Date | null;
  isCurrentActor: boolean;
};

export type StaffCapabilityAssignmentView = {
  accountReference: string;
  fullName: string;
  status: Extract<AccountStatusValue, "ACTIVE" | "DISABLED">;
  capabilities: readonly CapabilityValue[];
  isCurrentActor: boolean;
};

type ParsedPageInput = {
  search: string;
  page: number;
  pageSize: number;
};

function denied(
  reason: SessionAuthorizationFailure | "MISSING_CAPABILITY",
): ReadFailure {
  return { ok: false, status: "denied", reason };
}

function readPage<T>(
  input: ParsedPageInput,
  totalCount: number,
  records: readonly T[],
): CollectionReadResult<T> {
  const data = {
    page: input.page,
    pageSize: input.pageSize,
    totalCount,
    records,
  };
  return records.length === 0
    ? {
        ok: true,
        status: "empty",
        data: { ...data, records: [] },
      }
    : { ok: true, status: "success", data };
}

function pageWindow(input: ParsedPageInput): {
  skip: number;
  take: number;
} {
  return {
    skip: (input.page - 1) * input.pageSize,
    take: input.pageSize,
  };
}

function searchWhere(
  search: string,
  includeStudentNumber: boolean,
): Prisma.UserWhereInput {
  if (!search) return {};
  const matches: Prisma.UserWhereInput[] = [
    { fullName: { contains: search, mode: "insensitive" } },
  ];
  if (includeStudentNumber) {
    matches.push({
      studentProfile: {
        is: { studentNumber: { contains: search, mode: "insensitive" } },
      },
    });
  }
  return { OR: matches };
}

function mapStudent(
  user: {
    id: string;
    fullName: string;
    status: AccountStatusValue;
    createdAt: Date;
    approvedAt: Date | null;
    disabledAt: Date | null;
    studentProfile: {
      studentNumber: string;
      program: string;
      academicYear: StudentAccountView["academicYear"];
    } | null;
  },
  secret: string,
): StudentAccountView {
  if (!user.studentProfile) {
    throw new Error("Managed student account is missing its profile.");
  }
  return {
    accountReference: createAccountReference("student", user.id, secret),
    fullName: user.fullName,
    studentNumber: user.studentProfile.studentNumber,
    program: user.studentProfile.program,
    academicYear: user.studentProfile.academicYear,
    status: user.status,
    createdAt: user.createdAt,
    approvedAt: user.approvedAt,
    disabledAt: user.disabledAt,
  };
}

async function readStudentAccounts(
  claims: ActorSessionClaims,
  input: unknown,
  database: PrismaClient,
  referenceSecret: string,
  options:
    | {
        capability: "MANAGE_STUDENT_ACCOUNTS";
        disabledOnly: false;
      }
    | {
        capability: "REACTIVATE_STUDENT_ACCOUNTS";
        disabledOnly: true;
      },
): Promise<CollectionReadResult<StudentAccountView>> {
  const schema = options.disabledOnly
    ? disabledStudentReadInputSchema
    : managedStudentReadInputSchema;
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return { ok: false, status: "invalid", reason: "INVALID_INPUT" };

  try {
    const authorization = await authorizePackageDRead(
      claims,
      options.capability,
      database,
    );
    if (!authorization.ok) return denied(authorization.reason);

    const requestedStatus =
      "status" in parsed.data ? parsed.data.status : undefined;
    const where: Prisma.UserWhereInput = {
      role: "STUDENT",
      status: options.disabledOnly
        ? "DISABLED"
        : (requestedStatus ?? { in: ["PENDING_APPROVAL", "ACTIVE"] }),
      ...searchWhere(parsed.data.search, true),
    };
    const [totalCount, users] = await Promise.all([
      database.user.count({ where }),
      database.user.findMany({
        where,
        ...pageWindow(parsed.data),
        orderBy: options.disabledOnly
          ? [{ fullName: "asc" }, { id: "asc" }]
          : [{ status: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          fullName: true,
          status: true,
          createdAt: true,
          approvedAt: true,
          disabledAt: true,
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
    return readPage(
      parsed.data,
      totalCount,
      users.map((user) => mapStudent(user, referenceSecret)),
    );
  } catch {
    return { ok: false, status: "unavailable", reason: "READ_FAILED" };
  }
}

export async function readManagedStudentAccounts(
  claims: ActorSessionClaims,
  input: ManagedStudentReadInput,
  database: PrismaClient,
  referenceSecret: string,
): Promise<CollectionReadResult<StudentAccountView>> {
  return readStudentAccounts(claims, input, database, referenceSecret, {
    capability: "MANAGE_STUDENT_ACCOUNTS",
    disabledOnly: false,
  });
}

export async function readDisabledStudentAccounts(
  claims: ActorSessionClaims,
  input: DisabledStudentReadInput,
  database: PrismaClient,
  referenceSecret: string,
): Promise<CollectionReadResult<StudentAccountView>> {
  return readStudentAccounts(claims, input, database, referenceSecret, {
    capability: "REACTIVATE_STUDENT_ACCOUNTS",
    disabledOnly: true,
  });
}

export async function readStaffInventory(
  claims: ActorSessionClaims,
  input: StaffInventoryReadInput,
  database: PrismaClient,
  referenceSecret: string,
): Promise<CollectionReadResult<StaffAccountView>> {
  const parsed = staffInventoryReadInputSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, status: "invalid", reason: "INVALID_INPUT" };

  try {
    const authorization = await authorizePackageDRead(
      claims,
      "MANAGE_STAFF_ACCOUNTS",
      database,
    );
    if (!authorization.ok) return denied(authorization.reason);

    const where: Prisma.UserWhereInput = {
      role: "STAFF",
      status: parsed.data.status ?? { in: ["ACTIVE", "DISABLED"] },
      ...searchWhere(parsed.data.search, false),
    };
    const [totalCount, users] = await Promise.all([
      database.user.count({ where }),
      database.user.findMany({
        where,
        ...pageWindow(parsed.data),
        orderBy: [{ fullName: "asc" }, { id: "asc" }],
        select: {
          id: true,
          fullName: true,
          role: true,
          status: true,
          createdAt: true,
          disabledAt: true,
        },
      }),
    ]);
    return readPage(
      parsed.data,
      totalCount,
      users.map((user) => ({
        accountReference: createAccountReference(
          "staff",
          user.id,
          referenceSecret,
        ),
        fullName: user.fullName,
        role: "STAFF",
        status: user.status as StaffAccountView["status"],
        createdAt: user.createdAt,
        disabledAt: user.disabledAt,
        isCurrentActor: user.id === authorization.actor.id,
      })),
    );
  } catch {
    return { ok: false, status: "unavailable", reason: "READ_FAILED" };
  }
}

export async function readStaffCapabilityAssignments(
  claims: ActorSessionClaims,
  input: CapabilityAssignmentReadInput,
  database: PrismaClient,
  referenceSecret: string,
): Promise<CollectionReadResult<StaffCapabilityAssignmentView>> {
  const parsed = capabilityAssignmentReadInputSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, status: "invalid", reason: "INVALID_INPUT" };

  try {
    const authorization = await authorizePackageDRead(
      claims,
      "MANAGE_STAFF_CAPABILITIES",
      database,
    );
    if (!authorization.ok) return denied(authorization.reason);

    const where: Prisma.UserWhereInput = {
      role: "STAFF",
      status: parsed.data.status ?? { in: ["ACTIVE", "DISABLED"] },
      ...searchWhere(parsed.data.search, false),
    };
    const [totalCount, users] = await Promise.all([
      database.user.count({ where }),
      database.user.findMany({
        where,
        ...pageWindow(parsed.data),
        orderBy: [{ fullName: "asc" }, { id: "asc" }],
        select: {
          id: true,
          fullName: true,
          status: true,
          capabilityAssignments: {
            orderBy: { capability: "asc" },
            select: { capability: true },
          },
        },
      }),
    ]);
    return readPage(
      parsed.data,
      totalCount,
      users.map((user) => ({
        accountReference: createAccountReference(
          "staff",
          user.id,
          referenceSecret,
        ),
        fullName: user.fullName,
        status: user.status as StaffCapabilityAssignmentView["status"],
        capabilities: user.capabilityAssignments.map(
          ({ capability }) => capability,
        ),
        isCurrentActor: user.id === authorization.actor.id,
      })),
    );
  } catch {
    return { ok: false, status: "unavailable", reason: "READ_FAILED" };
  }
}

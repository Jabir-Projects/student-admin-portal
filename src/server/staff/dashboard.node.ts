import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import type { SessionAuthorizationFailure } from "@/features/auth/session-ux";
import type { ActorSessionClaims } from "@/server/auth/capabilities";
import { getStaffShellUserByClaims } from "@/server/auth/dal.node";
import {
  loadPendingStudentAccountSummary,
  type PendingStudentAccount,
} from "@/server/staff/pending-student-accounts.node";

export type StaffDashboardData = {
  fullName: string;
  capabilitySummary: {
    status: "available";
    assignedCount: number;
  };
  pendingStudents:
    | { status: "hidden" }
    | { status: "empty"; totalCount: 0; records: readonly [] }
    | {
        status: "available";
        totalCount: number;
        records: readonly PendingStudentAccount[];
      };
  requestCounts?:
    | { status: "hidden" }
    | {
        status: "available";
        totalActive: number;
        submitted: number;
        underReview: number;
        approved: number;
        ready: number;
      };
};

export type StaffDashboardResult =
  | { ok: true; data: StaffDashboardData }
  | {
      ok: false;
      reason: SessionAuthorizationFailure;
    };

export async function getStaffDashboardDataByClaims(
  claims: ActorSessionClaims,
  database: PrismaClient,
): Promise<StaffDashboardResult> {
  const actor = await getStaffShellUserByClaims(claims, database);
  if (!actor.ok) return actor;

  const fullName = actor.user.fullName.trim();
  if (!fullName) {
    throw new Error("Active STAFF account has no displayable full name.");
  }

  const assignedCount = actor.user.capabilities.length;
  const canProcessRequests =
    actor.user.capabilities.includes("PROCESS_REQUESTS");
  const requestCounts = canProcessRequests
    ? await database.documentRequest.groupBy({
        by: ["status"],
        where: {
          status: { in: ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "READY"] },
        },
        _count: { _all: true },
      })
    : null;
  const requestCountByStatus = new Map(
    requestCounts?.map((entry) => [entry.status, entry._count._all]) ?? [],
  );
  const requestSummary = requestCounts
    ? {
        status: "available" as const,
        submitted: requestCountByStatus.get("SUBMITTED") ?? 0,
        underReview: requestCountByStatus.get("UNDER_REVIEW") ?? 0,
        approved: requestCountByStatus.get("APPROVED") ?? 0,
        ready: requestCountByStatus.get("READY") ?? 0,
        totalActive: requestCounts.reduce(
          (total, entry) => total + entry._count._all,
          0,
        ),
      }
    : ({ status: "hidden" } as const);
  if (!actor.user.capabilities.includes("MANAGE_STUDENT_ACCOUNTS")) {
    return {
      ok: true,
      data: {
        fullName,
        capabilitySummary: { status: "available", assignedCount },
        pendingStudents: { status: "hidden" },
        requestCounts: requestSummary,
      },
    };
  }

  const pending = await loadPendingStudentAccountSummary(database);
  return {
    ok: true,
    data: {
      fullName,
      capabilitySummary: { status: "available", assignedCount },
      pendingStudents:
        pending.totalCount === 0
          ? { status: "empty", totalCount: 0, records: [] }
          : {
              status: "available",
              totalCount: pending.totalCount,
              records: pending.records,
            },
      requestCounts: requestSummary,
    },
  };
}

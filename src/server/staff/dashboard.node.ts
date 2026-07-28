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
  if (!actor.user.capabilities.includes("MANAGE_STUDENT_ACCOUNTS")) {
    return {
      ok: true,
      data: {
        fullName,
        capabilitySummary: { status: "available", assignedCount },
        pendingStudents: { status: "hidden" },
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
    },
  };
}

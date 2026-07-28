import "server-only";

import { auth } from "@/auth";
import { redirectForAuthorizationFailure } from "@/server/auth/session-routing";
import { db } from "@/server/db";
import {
  getStaffDashboardDataByClaims,
  type StaffDashboardData,
} from "@/server/staff/dashboard.node";

export async function requireStaffDashboardData(): Promise<StaffDashboardData> {
  const session = await auth();
  const result = await getStaffDashboardDataByClaims(
    {
      actorId: session?.user.id,
      claimedSessionVersion: session?.user.sessionVersion,
    },
    db,
  );
  if (!result.ok) redirectForAuthorizationFailure(result.reason);
  return result.data;
}

import "server-only";

import { normalizeEmail } from "@/features/auth/normalization";
import {
  approvePendingStudentAsActor,
  type AccountTransitionResult,
  disableStudentAsActor,
} from "@/server/auth/account-management.node";
import { requireActiveUser } from "@/server/auth/dal";
import { db } from "@/server/db";

export async function approvePendingStudent(
  targetUserId: string,
): Promise<AccountTransitionResult> {
  const actor = await requireActiveUser("ADMIN");
  return approvePendingStudentAsActor(actor.id, targetUserId, db);
}

export async function disableStudent(
  targetUserId: string,
): Promise<AccountTransitionResult> {
  const actor = await requireActiveUser("ADMIN");
  return disableStudentAsActor(actor.id, targetUserId, db);
}

export async function disableStudentByEmail(
  submittedEmail: string,
): Promise<AccountTransitionResult> {
  await requireActiveUser("ADMIN");
  const email = normalizeEmail(submittedEmail);
  if (email.length === 0 || email.length > 320)
    return { ok: false, message: "The account cannot be disabled." };
  const target = await db.user.findFirst({
    where: {
      email,
      role: "STUDENT",
      status: { in: ["PENDING_APPROVAL", "ACTIVE"] },
    },
    select: { id: true },
  });
  if (!target) return { ok: false, message: "The account cannot be disabled." };
  return disableStudent(target.id);
}

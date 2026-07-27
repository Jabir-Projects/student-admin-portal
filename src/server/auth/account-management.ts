import "server-only";

import { normalizeEmail } from "@/features/auth/normalization";
import {
  approvePendingStudentAsActor,
  type AccountTransitionResult,
  disableStudentByEmailAsActor,
  disableStudentAsActor,
  reactivateDisabledStudentAsActor,
} from "@/server/auth/account-management.node";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { db } from "@/server/db";

export async function approvePendingStudent(
  targetUserId: string,
): Promise<AccountTransitionResult> {
  return approvePendingStudentAsActor(
    await getActorSessionClaims(),
    targetUserId,
    db,
  );
}

export async function disableStudent(
  targetUserId: string,
): Promise<AccountTransitionResult> {
  return disableStudentAsActor(await getActorSessionClaims(), targetUserId, db);
}

export async function reactivateStudent(
  targetUserId: string,
): Promise<AccountTransitionResult> {
  return reactivateDisabledStudentAsActor(
    await getActorSessionClaims(),
    targetUserId,
    db,
  );
}

export async function disableStudentByEmail(
  submittedEmail: string,
): Promise<AccountTransitionResult> {
  const email = normalizeEmail(submittedEmail);
  if (email.length === 0 || email.length > 320)
    return { ok: false, message: "The account cannot be disabled." };
  return disableStudentByEmailAsActor(await getActorSessionClaims(), email, db);
}

"use server";

import { revalidatePath } from "next/cache";

import type { StudentAccountActionState } from "@/server/account-management/student-actions.node";
import { executeStudentAccountAction } from "@/server/account-management/student-actions.node";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { getAuthenticationSecret } from "@/server/auth/env";
import { db } from "@/server/db";

export async function studentAccountAction(
  _previousState: StudentAccountActionState,
  formData: FormData,
): Promise<StudentAccountActionState> {
  const secret = getAuthenticationSecret(process.env);
  if (!secret) {
    return {
      status: "error",
      message: "The account action could not be completed. Refresh and retry.",
    };
  }

  const result = await executeStudentAccountAction(
    await getActorSessionClaims(),
    {
      intent: formData.get("intent"),
      accountReference: formData.get("accountReference"),
    },
    db,
    secret,
  );
  if (result.status === "success") {
    revalidatePath("/staff/student-accounts");
  }
  return result;
}

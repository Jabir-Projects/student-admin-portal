"use server";

import { revalidatePath } from "next/cache";

import type { StaffAccountActionState } from "@/server/account-management/staff-actions.node";
import { executeStaffAccountAction } from "@/server/account-management/staff-actions.node";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { getAuthenticationSecret } from "@/server/auth/env";
import { db } from "@/server/db";

export async function staffAccountAction(
  _previousState: StaffAccountActionState,
  formData: FormData,
): Promise<StaffAccountActionState> {
  const secret = getAuthenticationSecret(process.env);
  if (!secret) {
    return {
      status: "error",
      message: "The account action could not be completed. Refresh and retry.",
    };
  }

  const intent = formData.get("intent");
  const input =
    intent === "create-staff"
      ? {
          intent,
          fullName: formData.get("fullName"),
          email: formData.get("email"),
          password: formData.get("password"),
          capabilities: formData.getAll("capabilities"),
        }
      : intent === "grant-capability" || intent === "revoke-capability"
        ? {
            intent,
            accountReference: formData.get("accountReference"),
            capability: formData.get("capability"),
          }
        : {
            intent,
            accountReference: formData.get("accountReference"),
          };
  const result = await executeStaffAccountAction(
    await getActorSessionClaims(),
    input,
    db,
    secret,
  );
  if (result.status === "success") {
    revalidatePath("/staff/staff-capabilities");
  }
  return result;
}

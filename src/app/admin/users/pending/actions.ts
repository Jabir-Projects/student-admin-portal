"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { executeLegacyAdminStudentAction } from "@/server/account-management/legacy-admin-student-actions.node";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { getAuthenticationSecret } from "@/server/auth/env";
import { db } from "@/server/db";

export async function legacyStudentAccountAction(
  formData: FormData,
): Promise<void> {
  let result: Awaited<ReturnType<typeof executeLegacyAdminStudentAction>>;
  try {
    const secret = getAuthenticationSecret(process.env);
    if (!secret) throw new Error("Authentication secret is unavailable.");
    result = await executeLegacyAdminStudentAction(
      await getActorSessionClaims(),
      {
        intent: formData.get("intent"),
        accountReference: formData.get("accountReference"),
      },
      db,
      secret,
    );
  } catch {
    result = {
      status: "error",
      message: "The account action could not be completed. Refresh and retry.",
    };
  }

  revalidatePath("/admin/users/pending");
  const outcome =
    result.status === "success"
      ? formData.get("intent") === "approve-student"
        ? "approved"
        : "disabled"
      : "rejected";
  redirect(`/admin/users/pending?result=${outcome}`);
}

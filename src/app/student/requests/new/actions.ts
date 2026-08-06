"use server";

import {
  submitRequestAsActor,
  type SubmitRequestResult,
} from "@/server/student-portal/mutations.node";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { db } from "@/server/db";
import { redirect } from "next/navigation";

export async function submitStudentRequestAction(
  formData: FormData,
): Promise<never> {
  let result: SubmitRequestResult;
  try {
    result = await submitRequestAsActor(
      await getActorSessionClaims(),
      { categoryId: formData.get("categoryId"), copyCount: formData.get("copyCount"), details: formData.get("details"), deliveryMethod: formData.get("deliveryMethod") },
      db,
    );
  } catch {
    redirect("/student/requests/new?result=ERROR");
  }
  if (result.ok) redirect(`/student/requests/${result.requestId}?submitted=1`);
  redirect(`/student/requests/new?result=${encodeURIComponent(result.reason)}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  addRequestMessageAsActor,
  transitionRequestAsActor,
} from "@/server/administration/mutations.node";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { db } from "@/server/db";

function resultLocation(requestId: string, result: "success" | string) {
  return `/staff/requests/${encodeURIComponent(requestId)}?result=${encodeURIComponent(result)}`;
}

export async function transitionRequestAction(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "");
  const result = await transitionRequestAsActor(
    await getActorSessionClaims(),
    {
      requestId,
      targetStatus: formData.get("targetStatus"),
      rejectionReason: formData.get("rejectionReason") ?? "",
      internalNote: formData.get("internalNote") ?? "",
      publicMessage: formData.get("publicMessage") ?? "",
    },
    db,
  );
  if (result.ok) {
    revalidatePath("/staff");
    revalidatePath("/staff/requests");
    revalidatePath(`/staff/requests/${requestId}`);
    redirect(resultLocation(requestId, "transitioned"));
  }
  redirect(resultLocation(requestId, result.reason.toLowerCase()));
}

export async function addRequestMessageAction(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "");
  const result = await addRequestMessageAsActor(
    await getActorSessionClaims(),
    {
      requestId,
      visibility: formData.get("visibility"),
      body: formData.get("body"),
    },
    db,
  );
  if (result.ok) {
    revalidatePath(`/staff/requests/${requestId}`);
    revalidatePath(`/student/requests/${requestId}`);
    redirect(resultLocation(requestId, "message-added"));
  }
  redirect(resultLocation(requestId, result.reason.toLowerCase()));
}

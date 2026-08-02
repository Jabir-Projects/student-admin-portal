"use server";

import { revalidatePath } from "next/cache";

import { getActorSessionClaims } from "@/server/auth/capabilities";
import { db } from "@/server/db";
import {
  cancelRequestAsActor,
  type CancelRequestResult,
} from "@/server/student-portal/mutations.node";

export type CancelRequestState = {
  status:
    | "idle"
    | "success"
    | "already-cancelled"
    | "conflict"
    | "not-found"
    | "denied"
    | "error";
  message: string;
};

function stateForResult(result: CancelRequestResult): CancelRequestState {
  if (result.ok)
    return { status: "success", message: "The request was cancelled." };
  if (result.reason === "ALREADY_CANCELLED")
    return {
      status: "already-cancelled",
      message: "This request is already cancelled.",
    };
  if (result.reason === "STATUS_CONFLICT")
    return {
      status: "conflict",
      message: "This request has progressed and can no longer be cancelled.",
    };
  if (result.reason === "NOT_FOUND" || result.reason === "INVALID_INPUT")
    return { status: "not-found", message: "The request could not be found." };
  if (
    [
      "UNAUTHENTICATED",
      "INACTIVE_ACCOUNT",
      "DISABLED_ACCOUNT",
      "STALE_SESSION",
      "WRONG_ROLE",
    ].includes(result.reason)
  ) {
    return {
      status: "denied",
      message: "Your session cannot cancel this request.",
    };
  }
  return {
    status: "error",
    message: "The request could not be cancelled. Please try again.",
  };
}

export async function cancelStudentRequestAction(
  _previousState: CancelRequestState,
  formData: FormData,
): Promise<CancelRequestState> {
  try {
    const result = stateForResult(
      await cancelRequestAsActor(
        await getActorSessionClaims(),
        { requestId: formData.get("requestId") },
        db,
      ),
    );
    if (result.status === "success" || result.status === "already-cancelled") {
      revalidatePath("/student");
      revalidatePath("/student/requests");
      const requestId = formData.get("requestId");
      if (typeof requestId === "string")
        revalidatePath(`/student/requests/${requestId}`);
    }
    return result;
  } catch {
    return {
      status: "error",
      message: "The request could not be cancelled. Please try again.",
    };
  }
}

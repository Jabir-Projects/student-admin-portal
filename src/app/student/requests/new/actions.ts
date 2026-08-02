"use server";

import type { SubmitRequestResult } from "@/server/student-portal/mutations.node";
import { submitRequestAsActor } from "@/server/student-portal/mutations.node";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { db } from "@/server/db";

export type SubmitRequestState = {
  status:
    | "idle"
    | "success"
    | "validation-error"
    | "duplicate"
    | "unavailable"
    | "denied"
    | "error";
  message: string;
  requestId?: string;
};

function stateForResult(result: SubmitRequestResult): SubmitRequestState {
  if (result.ok)
    return {
      status: "success",
      message: "Your request was submitted.",
      requestId: result.requestId,
    };
  if (result.reason === "INVALID_INPUT")
    return {
      status: "validation-error",
      message: "Check the request fields and try again.",
    };
  if (result.reason === "DUPLICATE_OPEN_REQUEST")
    return {
      status: "duplicate",
      message: "You already have an open request in this category.",
    };
  if (result.reason === "CATEGORY_UNAVAILABLE")
    return {
      status: "unavailable",
      message: "That request category is no longer available.",
    };
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
      message:
        "Your session cannot submit this request. Sign in again or contact administration.",
    };
  }
  return {
    status: "error",
    message: "The request could not be submitted. Please try again.",
  };
}

export async function submitStudentRequestAction(
  _previousState: SubmitRequestState,
  formData: FormData,
): Promise<SubmitRequestState> {
  try {
    return stateForResult(
      await submitRequestAsActor(
        await getActorSessionClaims(),
        {
          categoryId: formData.get("categoryId"),
          copyCount: formData.get("copyCount"),
          details: formData.get("details"),
          deliveryMethod: formData.get("deliveryMethod"),
        },
        db,
      ),
    );
  } catch {
    return {
      status: "error",
      message: "The request could not be submitted. Please try again.",
    };
  }
}

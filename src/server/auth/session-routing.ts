import "server-only";

import { redirect } from "next/navigation";

import {
  getAuthorizationFailureDestination,
  type AuthorizationPresentationFailure,
} from "@/features/auth/session-ux";

export function redirectForAuthorizationFailure(
  reason: AuthorizationPresentationFailure,
): never {
  redirect(getAuthorizationFailureDestination(reason));
}

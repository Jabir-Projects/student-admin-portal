export type SessionAuthorizationFailure =
  | "UNAUTHENTICATED"
  | "STALE_SESSION"
  | "DISABLED_ACCOUNT"
  | "INACTIVE_ACCOUNT"
  | "WRONG_ROLE";

export type AuthorizationPresentationFailure =
  SessionAuthorizationFailure | "MISSING_CAPABILITY";

export function getAuthorizationFailureDestination(
  reason: AuthorizationPresentationFailure,
):
  | "/login"
  | "/login?reason=disabled"
  | "/login?reason=session-ended"
  | "/unauthorized" {
  if (reason === "UNAUTHENTICATED") return "/login";
  if (reason === "DISABLED_ACCOUNT") return "/login?reason=disabled";
  if (reason === "STALE_SESSION" || reason === "INACTIVE_ACCOUNT")
    return "/login?reason=session-ended";
  return "/unauthorized";
}

export function getLoginPresentationMessage(
  reason: string | undefined,
): string | undefined {
  if (reason === "disabled") {
    return "This account is disabled. Contact an administrator if you believe this is an error.";
  }
  if (reason === "session-ended") {
    return "Your session has ended. Sign in again to continue.";
  }
  return undefined;
}

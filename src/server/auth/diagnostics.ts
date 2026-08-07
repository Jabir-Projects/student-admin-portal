import "server-only";

export type AuthenticationDiagnosticStage =
  | "login_action_schema_invalid"
  | "login_action_schema_valid"
  | "login_action_signin_dispatched"
  | "login_action_credentials_error_pending_approval"
  | "login_action_credentials_error_disabled"
  | "login_action_credentials_error_invalid"
  | "login_action_auth_error"
  | "password_verify_false"
  | "password_verify_exception"
  | "authorize_entered"
  | "authorize_schema_invalid"
  | "authorize_schema_valid"
  | "authorize_user_lookup_completed"
  | "authorize_user_lookup_failed"
  | "authorize_user_found"
  | "authorize_user_not_found"
  | "authorize_password_check_started"
  | "authorize_password_valid"
  | "authorize_password_invalid"
  | "authorize_pending_approval"
  | "authorize_disabled"
  | "authorize_active_user"
  | "authorize_audit_written"
  | "authorize_audit_failed";

export function emitAuthenticationDiagnostic(
  stage: AuthenticationDiagnosticStage,
): void {
  if (process.env.VERCEL_ENV !== "preview") return;

  console.info(`AUTH_DIAG ${stage}`);
}

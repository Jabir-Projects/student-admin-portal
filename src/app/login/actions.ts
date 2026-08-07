"use server";

import { AuthError } from "next-auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { getSafeCallbackPath } from "@/auth.config";
import { loginSchema } from "@/features/auth/schemas";
import {
  createSessionHistoryMarker,
  SESSION_HISTORY_COOKIE_NAME,
  SESSION_HISTORY_MAX_AGE_SECONDS,
} from "@/features/auth/session-marker";
import { getAuthenticationSecret } from "@/server/auth/env";
import { emitAuthenticationDiagnostic } from "@/server/auth/diagnostics";

function getCredentialsSignInErrorCode(value: unknown): string | undefined {
  if (typeof value === "string") {
    const url = new URL(value, "https://portal.sist.example");
    return url.searchParams.get("error") === "CredentialsSignin"
      ? (url.searchParams.get("code") ?? undefined)
      : undefined;
  }

  if (
    value &&
    typeof value === "object" &&
    "type" in value &&
    value.type === "CredentialsSignin" &&
    "code" in value &&
    typeof value.code === "string"
  ) {
    return value.code;
  }

  return undefined;
}

export async function loginAction(formData: FormData): Promise<void> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    emitAuthenticationDiagnostic("login_action_schema_invalid");
    redirect("/login?error=invalid");
  }
  emitAuthenticationDiagnostic("login_action_schema_valid");
  const requestedCallbackUrl = formData.get("callbackUrl");
  const redirectTo =
    typeof requestedCallbackUrl === "string" &&
    requestedCallbackUrl.length > 0 &&
    requestedCallbackUrl.length <= 2048
      ? getSafeCallbackPath(requestedCallbackUrl)
      : "/auth/continue";
  try {
    emitAuthenticationDiagnostic("login_action_signin_dispatched");
    const destination = await signIn("credentials", {
      ...parsed.data,
      redirect: false,
      redirectTo,
    });
    const code = getCredentialsSignInErrorCode(destination);
    if (code === "pending_approval") {
      emitAuthenticationDiagnostic(
        "login_action_credentials_error_pending_approval",
      );
      redirect("/pending-approval");
    }
    if (code === "account_disabled") {
      emitAuthenticationDiagnostic("login_action_credentials_error_disabled");
      redirect("/login?error=disabled");
    }
    if (code) {
      emitAuthenticationDiagnostic("login_action_credentials_error_invalid");
      redirect("/login?error=invalid");
    }

    const secret = getAuthenticationSecret(process.env);
    if (!secret) {
      throw new Error("Invalid session history marker configuration.");
    }
    const marker = await createSessionHistoryMarker(secret);
    const cookieStore = await cookies();
    cookieStore.set(SESSION_HISTORY_COOKIE_NAME, marker, {
      httpOnly: true,
      maxAge: SESSION_HISTORY_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    redirect(destination);
  } catch (error) {
    const code = getCredentialsSignInErrorCode(error);
    if (code === "pending_approval") {
      emitAuthenticationDiagnostic(
        "login_action_credentials_error_pending_approval",
      );
      redirect("/pending-approval");
    }
    if (code === "account_disabled") {
      emitAuthenticationDiagnostic("login_action_credentials_error_disabled");
      redirect("/login?error=disabled");
    }
    if (code) {
      emitAuthenticationDiagnostic("login_action_credentials_error_invalid");
      redirect("/login?error=invalid");
    }

    if (error instanceof AuthError) {
      emitAuthenticationDiagnostic("login_action_auth_error");
      redirect("/login?error=invalid");
    }
    throw error;
  }
}

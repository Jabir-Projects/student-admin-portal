import Link from "next/link";

import { loginAction } from "@/app/login/actions";
import { getSafeCallbackPath } from "@/auth.config";
import { FeedbackBanner } from "@/components/feedback/feedback-banner";
import { AuthPanel, AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { getLoginPresentationMessage } from "@/features/auth/session-ux";

const inputClass =
  "border-input bg-background focus-visible:ring-ring h-11 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    callbackUrl?: string;
    error?: string;
    reason?: string;
  }>;
}) {
  const { callbackUrl, error, reason } = await searchParams;
  const sessionMessage = getLoginPresentationMessage(
    reason ?? (error === "disabled" ? "disabled" : undefined),
  );
  const errorMessage =
    sessionMessage ??
    (error ? "The email address or password is incorrect." : undefined);
  const safeLengthCallbackUrl =
    callbackUrl && callbackUrl.length <= 2048
      ? getSafeCallbackPath(callbackUrl)
      : undefined;

  return (
    <AuthShell>
      <AuthPanel
        description="Use your registered email address and password."
        title="SIST portal sign in"
      >
          <form action={loginAction} className="space-y-5">
            {safeLengthCallbackUrl ? (
              <input
                name="callbackUrl"
                type="hidden"
                value={safeLengthCallbackUrl}
              />
            ) : null}
            <label className="block space-y-2 text-sm font-medium">
              Email
              <input
                aria-describedby={errorMessage ? "login-error" : undefined}
                aria-invalid={Boolean(errorMessage)}
                autoComplete="email"
                className={inputClass}
                maxLength={320}
                name="email"
                required
                type="email"
              />
            </label>
            <label className="block space-y-2 text-sm font-medium">
              Password
              <input
                aria-describedby={errorMessage ? "login-error" : undefined}
                aria-invalid={Boolean(errorMessage)}
                autoComplete="current-password"
                className={inputClass}
                maxLength={128}
                name="password"
                required
                type="password"
              />
            </label>
            {errorMessage ? (
              <FeedbackBanner
                id="login-error"
                tone={
                  reason === "disabled"
                    ? "warning"
                    : reason === "session-ended"
                      ? "info"
                      : "error"
                }
              >
                {errorMessage}
              </FeedbackBanner>
            ) : null}
            <Button className="w-full" type="submit">
              Sign in
            </Button>
            <p className="text-muted-foreground text-center text-sm">
              Need a student account?{" "}
              <Link
                className="text-primary font-medium hover:underline"
                href="/register"
              >
                Register
              </Link>
            </p>
          </form>
      </AuthPanel>
    </AuthShell>
  );
}

import Link from "next/link";

import { loginAction } from "@/app/login/actions";
import { getSafeCallbackPath } from "@/auth.config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <main className="mx-auto max-w-md px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>SIST portal sign in</CardTitle>
          <p className="text-muted-foreground text-sm">
            Use your registered email address and password.
          </p>
        </CardHeader>
        <CardContent>
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
                autoComplete="current-password"
                className={inputClass}
                maxLength={128}
                name="password"
                required
                type="password"
              />
            </label>
            {errorMessage ? (
              <p className="text-destructive text-sm" role="alert">
                {errorMessage}
              </p>
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
        </CardContent>
      </Card>
    </main>
  );
}

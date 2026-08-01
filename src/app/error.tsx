"use client";

import { SystemState } from "@/components/feedback/system-state";
import { AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <AuthShell>
      <SystemState
        action={
          <Button className="mt-7" onClick={unstable_retry} type="button">
            Try again
          </Button>
        }
        description="The page could not be loaded. No request data was changed."
        kind="error"
        title="Something went wrong"
      />
    </AuthShell>
  );
}

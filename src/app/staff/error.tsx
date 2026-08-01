"use client";

import { SystemState } from "@/components/feedback/system-state";
import { Button } from "@/components/ui/button";

export default function StaffDashboardError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <SystemState
      action={
        <Button className="mt-7" onClick={unstable_retry} type="button">
          Try again
        </Button>
      }
      description="We could not load the staff dashboard. No account data has been changed."
      kind="error"
      title="Dashboard unavailable"
    />
  );
}

"use client";

import { SystemState } from "@/components/feedback/system-state";

export default function StudentError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SystemState
      action={
        <button
          className="bg-primary text-primary-foreground mt-7 rounded-md px-4 py-2 font-medium"
          onClick={reset}
          type="button"
        >
          Try again
        </button>
      }
      description="Student services could not be loaded. No request data was changed."
      kind="error"
      title="Unable to load student services"
    />
  );
}

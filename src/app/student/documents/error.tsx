"use client";

import { Button } from "@/components/ui/button";

export default function StudentDocumentsError({
  reset,
}: {
  reset: () => void;
}) {
  return (
    <div className="bg-card rounded-xl border p-8 text-center" role="alert">
      <h1 className="text-xl font-semibold">Documents unavailable</h1>
      <p className="text-muted-foreground mt-2">
        Your documents could not be loaded safely. Please try again.
      </p>
      <Button className="mt-4" onClick={reset} type="button">
        Try again
      </Button>
    </div>
  );
}

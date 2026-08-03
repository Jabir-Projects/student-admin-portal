"use client";
import { Button } from "@/components/ui/button";
export default function AuditError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="bg-card rounded-xl border p-8 text-center" role="alert">
      <h1 className="text-xl font-semibold">Audit log unavailable</h1>
      <p className="text-muted-foreground mt-2">
        Protected audit data could not be loaded.
      </p>
      <Button className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}

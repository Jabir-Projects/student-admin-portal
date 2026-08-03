"use client";
import { Button } from "@/components/ui/button";
export default function StudentNotificationsError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="bg-card rounded-xl border p-8 text-center" role="alert">
      <h1 className="text-xl font-semibold">Notifications unavailable</h1>
      <p className="text-muted-foreground mt-2">Please try again safely.</p>
      <Button className="mt-4" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}

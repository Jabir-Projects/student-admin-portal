"use client";
import { Button } from "@/components/ui/button";
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="bg-staff-panel rounded-xl border p-6" role="alert">
      <h1 className="text-2xl font-semibold">
        Finance imports are unavailable
      </h1>
      <p className="text-muted-foreground mt-2">
        The controlled import workspace could not be loaded. No file or staging
        details have been exposed.
      </p>
      <Button className="mt-5" onClick={reset} type="button">
        Try again
      </Button>
    </section>
  );
}

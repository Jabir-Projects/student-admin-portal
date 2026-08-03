"use client";

import { Button } from "@/components/ui/button";

export default function RequestsError({ reset }: { reset: () => void }) {
  return (
    <section className="bg-staff-panel rounded-xl border p-6" role="alert">
      <h1 className="text-sist-navy-dark text-2xl font-semibold">
        Requests unavailable
      </h1>
      <p className="text-muted-foreground mt-2">
        The request area could not be loaded safely.
      </p>
      <Button className="mt-5" onClick={reset} type="button">
        Retry
      </Button>
    </section>
  );
}

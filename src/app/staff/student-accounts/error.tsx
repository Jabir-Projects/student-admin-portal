"use client";

import { CircleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function StudentAccountsError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <section
      aria-labelledby="student-accounts-error-heading"
      className="bg-staff-panel rounded-xl border p-6"
      role="alert"
    >
      <CircleAlert aria-hidden="true" className="text-destructive size-8" />
      <h1
        className="text-sist-navy-dark mt-4 text-2xl font-semibold"
        id="student-accounts-error-heading"
      >
        Student accounts unavailable
      </h1>
      <p className="text-muted-foreground mt-2 max-w-xl leading-7">
        We could not load student account management. No account data has been
        changed.
      </p>
      <Button className="mt-5" onClick={unstable_retry} type="button">
        Try again
      </Button>
    </section>
  );
}

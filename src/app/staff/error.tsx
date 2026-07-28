"use client";

import { CircleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function StaffDashboardError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <section
      aria-labelledby="staff-dashboard-error-heading"
      className="bg-staff-panel rounded-xl border p-6"
      role="alert"
    >
      <span className="bg-destructive/10 text-destructive inline-flex size-11 items-center justify-center rounded-full">
        <CircleAlert aria-hidden="true" className="size-5" />
      </span>
      <h1
        className="text-sist-navy-dark mt-4 text-2xl font-semibold"
        id="staff-dashboard-error-heading"
      >
        Dashboard unavailable
      </h1>
      <p className="text-muted-foreground mt-2 max-w-xl leading-7">
        We could not load the staff dashboard. No account data has been changed.
      </p>
      <Button className="mt-5" onClick={unstable_retry} type="button">
        Try again
      </Button>
    </section>
  );
}

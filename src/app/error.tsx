"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <main className="bg-muted/40 grid min-h-screen place-items-center px-6 py-16">
      <section className="bg-card w-full max-w-lg rounded-2xl border p-8 text-center shadow-sm">
        <AlertTriangle
          aria-hidden="true"
          className="text-destructive mx-auto size-12"
        />
        <h1 className="mt-5 text-3xl font-bold tracking-tight">
          Something went wrong
        </h1>
        <p className="text-muted-foreground mt-4 leading-7">
          The page could not be loaded. No request data was changed.
        </p>
        <Button className="mt-8" onClick={unstable_retry} type="button">
          Try again
        </Button>
      </section>
    </main>
  );
}

"use client";

import { useActionState, useRef } from "react";

import { staffAccountAction } from "@/app/staff/staff-capabilities/actions";
import { Button } from "@/components/ui/button";
import { CAPABILITIES } from "@/features/auth/constants";

const initialState = { status: "idle", message: "" } as const;

export function StaffCreateForm({
  canAssignCapabilities,
}: {
  canAssignCapabilities: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(
    async (
      previousState: Awaited<ReturnType<typeof staffAccountAction>>,
      formData: FormData,
    ) => {
      const result = await staffAccountAction(previousState, formData);
      if (result.status === "success") formRef.current?.reset();
      return result;
    },
    initialState,
  );

  return (
    <section
      aria-labelledby="create-staff-heading"
      className="bg-staff-panel rounded-xl border p-6"
    >
      <h2
        className="text-sist-navy-dark text-xl font-semibold"
        id="create-staff-heading"
      >
        Create STAFF account
      </h2>
      <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-6">
        Create an active STAFF account with a temporary password. Share the
        password only through an approved secure channel.
      </p>
      <form action={formAction} className="mt-5 grid gap-4" ref={formRef}>
        <input name="intent" type="hidden" value="create-staff" />
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold">Full name</span>
            <input
              autoComplete="name"
              className="border-input bg-background h-10 rounded-md border px-3 text-sm"
              maxLength={200}
              minLength={2}
              name="fullName"
              required
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-semibold">Institutional email</span>
            <input
              autoComplete="email"
              className="border-input bg-background h-10 rounded-md border px-3 text-sm"
              maxLength={320}
              name="email"
              required
              type="email"
            />
          </label>
          <label className="grid gap-1.5 md:col-span-2">
            <span className="text-sm font-semibold">Temporary password</span>
            <input
              aria-describedby="staff-password-help"
              autoComplete="new-password"
              className="border-input bg-background h-10 rounded-md border px-3 text-sm"
              maxLength={128}
              minLength={12}
              name="password"
              required
              type="password"
            />
            <span
              className="text-muted-foreground text-xs"
              id="staff-password-help"
            >
              Use at least 12 characters. The password is never displayed after
              submission.
            </span>
          </label>
        </div>
        {canAssignCapabilities ? (
          <fieldset className="rounded-lg border p-4">
            <legend className="px-1 text-sm font-semibold">
              Initial capabilities
            </legend>
            <p className="text-muted-foreground mb-3 text-xs">
              Optional. Unchecked capabilities remain unavailable.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {CAPABILITIES.map((capability) => (
                <label
                  className="flex items-start gap-2 rounded-md border p-3 text-xs"
                  key={capability}
                >
                  <input
                    className="mt-0.5"
                    name="capabilities"
                    type="checkbox"
                    value={capability}
                  />
                  <span className="break-all">{capability}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        {state.status !== "idle" ? (
          <p
            className={
              state.status === "success"
                ? "text-sm text-emerald-700 dark:text-emerald-300"
                : "text-destructive text-sm"
            }
            role={state.status === "success" ? "status" : "alert"}
          >
            {state.message}
          </p>
        ) : null}
        <div>
          <Button disabled={isPending} type="submit">
            {isPending ? "Creating\u2026" : "Create STAFF account"}
          </Button>
        </div>
      </form>
    </section>
  );
}

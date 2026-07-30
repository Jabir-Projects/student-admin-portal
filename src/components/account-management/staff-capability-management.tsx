"use client";

import { useActionState } from "react";

import { staffAccountAction } from "@/app/staff/staff-capabilities/actions";
import { Button } from "@/components/ui/button";
import { CAPABILITIES, type CapabilityValue } from "@/features/auth/constants";

const initialState = {
  status: "idle",
  message: "",
} as const;

type StaffCapabilityResult =
  | {
      ok: true;
      status: "success" | "empty";
      data: {
        page: number;
        pageSize: number;
        totalCount: number;
        records: readonly {
          accountReference: string;
          fullName: string;
          status: "ACTIVE" | "DISABLED";
          capabilities: readonly CapabilityValue[];
          isCurrentActor: boolean;
        }[];
      };
    }
  | { ok: false };

function CapabilityControl({
  accountReference,
  assigned,
  capability,
  mutable,
}: {
  accountReference: string;
  assigned: boolean;
  capability: CapabilityValue;
  mutable: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    staffAccountAction,
    initialState,
  );
  return (
    <form action={formAction} className="rounded-md border p-3">
      <input
        name="intent"
        type="hidden"
        value={assigned ? "revoke-capability" : "grant-capability"}
      />
      <input name="accountReference" type="hidden" value={accountReference} />
      <input name="capability" type="hidden" value={capability} />
      <p className="text-xs font-semibold break-all">{capability}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">
          {assigned ? "Assigned" : "Not assigned"}
        </span>
        <Button
          disabled={isPending || !mutable}
          size="sm"
          type="submit"
          variant={assigned ? "outline" : "default"}
        >
          {isPending ? "Saving\u2026" : assigned ? "Remove" : "Add"}
        </Button>
      </div>
      {state.status !== "idle" ? (
        <p
          className={
            state.status === "success"
              ? "mt-2 text-xs text-emerald-700 dark:text-emerald-300"
              : "text-destructive mt-2 text-xs"
          }
          role={state.status === "success" ? "status" : "alert"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function StaffCapabilityManagement({
  result,
}: {
  result: StaffCapabilityResult;
}) {
  if (!result.ok) {
    return (
      <section className="bg-staff-panel rounded-xl border p-6" role="alert">
        <h2 className="text-sist-navy-dark text-xl font-semibold">
          Capability assignments unavailable
        </h2>
        <p className="text-muted-foreground mt-2">
          Capability data could not be loaded safely. Refresh and retry.
        </p>
      </section>
    );
  }
  if (result.status === "empty") {
    return (
      <section className="bg-staff-panel rounded-xl border p-6">
        <h2 className="text-sist-navy-dark text-xl font-semibold">
          Capability assignments
        </h2>
        <p className="text-muted-foreground mt-3" role="status">
          No STAFF accounts match this view.
        </p>
      </section>
    );
  }
  return (
    <section
      aria-labelledby="capability-assignments-heading"
      className="space-y-4"
    >
      <div>
        <h2
          className="text-sist-navy-dark text-xl font-semibold"
          id="capability-assignments-heading"
        >
          Capability assignments
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          All 18 approved capabilities are shown for each STAFF account.
        </p>
      </div>
      {result.data.records.map((staff) => (
        <article
          className="bg-staff-panel rounded-xl border p-5"
          key={staff.accountReference}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">{staff.fullName}</h3>
            <span className="text-muted-foreground text-xs">
              {staff.status}
            </span>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {CAPABILITIES.map((capability) => (
              <CapabilityControl
                accountReference={staff.accountReference}
                assigned={staff.capabilities.includes(capability)}
                capability={capability}
                key={capability}
                mutable={staff.status === "ACTIVE" && !staff.isCurrentActor}
              />
            ))}
          </div>
          {staff.status === "DISABLED" ? (
            <p className="text-muted-foreground mt-3 text-xs">
              Reactivate this STAFF account before changing its capabilities.
            </p>
          ) : staff.isCurrentActor ? (
            <p className="text-muted-foreground mt-3 text-xs">
              Self-service capability changes are not permitted.
            </p>
          ) : null}
        </article>
      ))}
    </section>
  );
}

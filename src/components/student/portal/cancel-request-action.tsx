"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";

import {
  cancelStudentRequestAction,
  type CancelRequestState,
} from "@/app/student/requests/[requestId]/actions";
import { Button } from "@/components/ui/button";

export function CancelRequestAction({ requestId }: { requestId: string }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [state, formAction, pending] = useActionState(
    cancelStudentRequestAction,
    {
      status: "idle",
      message: "",
    } satisfies CancelRequestState,
  );
  const failed = !["idle", "success", "already-cancelled"].includes(
    state.status,
  );

  useEffect(() => {
    if (state.status === "success" || state.status === "already-cancelled") {
      dialogRef.current?.close();
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <div>
      <Button
        onClick={() => dialogRef.current?.showModal()}
        type="button"
        variant="destructive"
      >
        Cancel request
      </Button>
      <dialog
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        className="bg-card text-card-foreground m-auto w-[min(32rem,calc(100%-2rem))] rounded-xl border p-0 shadow-2xl backdrop:bg-black/55"
        ref={dialogRef}
      >
        <form action={formAction} className="p-6">
          <input name="requestId" type="hidden" value={requestId} />
          <h2
            className="text-sist-navy-dark text-xl font-semibold"
            id={titleId}
          >
            Cancel this request?
          </h2>
          <p
            className="text-muted-foreground mt-3 leading-7"
            id={descriptionId}
          >
            Cancellation cannot be undone through this portal.
          </p>
          {failed ? (
            <p className="text-destructive mt-4 text-sm" role="alert">
              {state.message}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button
              disabled={pending}
              onClick={() => dialogRef.current?.close()}
              type="button"
              variant="outline"
            >
              Return
            </Button>
            <Button disabled={pending} type="submit" variant="destructive">
              {pending ? "Cancelling…" : "Confirm cancellation"}
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

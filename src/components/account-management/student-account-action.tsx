"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { studentAccountAction } from "@/app/staff/student-accounts/actions";
import { Button } from "@/components/ui/button";

type StudentActionIntent =
  "approve-student" | "disable-student" | "reactivate-student";

const actionContent = {
  "approve-student": {
    button: "Approve",
    title: "Approve student account?",
    description:
      "This will activate the student account and allow the student to sign in.",
    confirm: "Confirm approval",
    destructive: false,
  },
  "disable-student": {
    button: "Disable",
    title: "Disable student account?",
    description:
      "This is a destructive account action. The student will lose access immediately and any active session will be ended.",
    confirm: "Disable account",
    destructive: true,
  },
  "reactivate-student": {
    button: "Reactivate",
    title: "Reactivate student account?",
    description: "This will restore access to the disabled student account.",
    confirm: "Confirm reactivation",
    destructive: false,
  },
} as const;

export function StudentAccountAction({
  accountReference,
  fullName,
  intent,
}: {
  accountReference: string;
  fullName: string;
  intent: StudentActionIntent;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const feedbackId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [state, formAction, isPending] = useActionState(
    async (
      previousState: Awaited<ReturnType<typeof studentAccountAction>>,
      formData: FormData,
    ) => {
      const result = await studentAccountAction(previousState, formData);
      if (result.status === "success") {
        dialogRef.current?.close();
        setSuccessMessage(result.message);
      }
      return result;
    },
    {
      status: "idle",
      message: "",
    } satisfies Awaited<ReturnType<typeof studentAccountAction>>,
  );
  const content = actionContent[intent];
  const hasFailure =
    state.status === "validation-error" ||
    state.status === "denied" ||
    state.status === "error";

  useEffect(() => {
    if (hasFailure && dialogRef.current?.open) {
      feedbackRef.current?.focus();
    }
  }, [hasFailure, state]);

  return (
    <div>
      <Button
        onClick={() => {
          flushSync(() => setSuccessMessage(null));
          dialogRef.current?.showModal();
        }}
        size="sm"
        type="button"
        variant={content.destructive ? "destructive" : "outline"}
      >
        {content.button} {fullName}
      </Button>
      <dialog
        aria-describedby={
          hasFailure ? `${descriptionId} ${feedbackId}` : descriptionId
        }
        aria-labelledby={titleId}
        className="bg-card text-card-foreground m-auto w-[min(32rem,calc(100%-2rem))] rounded-xl border p-0 shadow-2xl backdrop:bg-black/55"
        ref={dialogRef}
      >
        <form action={formAction} className="p-6">
          <input name="intent" type="hidden" value={intent} />
          <input
            name="accountReference"
            type="hidden"
            value={accountReference}
          />
          <h3
            className="text-sist-navy-dark text-xl font-semibold"
            id={titleId}
          >
            {content.title}
          </h3>
          <p
            className="text-muted-foreground mt-3 leading-7"
            id={descriptionId}
          >
            {content.description}
          </p>
          <p className="mt-3 font-semibold">{fullName}</p>
          {hasFailure ? (
            <p
              aria-live="assertive"
              className="text-destructive mt-4 text-sm"
              id={feedbackId}
              ref={feedbackRef}
              role="alert"
              tabIndex={-1}
            >
              {state.message}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button
              disabled={isPending}
              onClick={() => dialogRef.current?.close()}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={isPending}
              type="submit"
              variant={content.destructive ? "destructive" : "default"}
            >
              {isPending ? "Submitting…" : content.confirm}
            </Button>
          </div>
        </form>
      </dialog>
      {successMessage ? (
        <p
          className="mt-2 max-w-72 text-sm text-emerald-700 dark:text-emerald-300"
          role="status"
        >
          {successMessage}
        </p>
      ) : null}
    </div>
  );
}

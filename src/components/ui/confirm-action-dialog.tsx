"use client";

import type { ComponentProps, ReactNode } from "react";
import { useId, useRef } from "react";

import { PendingSubmitButton } from "@/components/ui/pending-submit-button";
import { Button } from "@/components/ui/button";

type ConfirmActionDialogProps = {
  action: ComponentProps<"form">["action"];
  formFields?: ReactNode;
  confirmLabel: string;
  description: string;
  pendingLabel: string;
  title: string;
  triggerLabel: string;
  triggerSize?: "default" | "sm" | "lg" | "icon";
  triggerVariant?: "default" | "destructive" | "ghost" | "outline";
};

export function ConfirmActionDialog({
  action,
  formFields,
  confirmLabel,
  description,
  pendingLabel,
  title,
  triggerLabel,
  triggerSize = "default",
  triggerVariant = "default",
}: ConfirmActionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  return (
    <>
      <Button
        onClick={() => dialogRef.current?.showModal()}
        size={triggerSize}
        type="button"
        variant={triggerVariant}
      >
        {triggerLabel}
      </Button>
      <dialog
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="bg-card text-card-foreground m-auto w-[min(32rem,calc(100%-2rem))] rounded-xl border p-0 shadow-2xl backdrop:bg-black/55"
        ref={dialogRef}
      >
        <form action={action} className="p-6">
          <h2
            className="text-sist-navy-dark text-xl font-semibold"
            id={titleId}
          >
            {title}
          </h2>
          <p
            className="text-muted-foreground mt-3 leading-7"
            id={descriptionId}
          >
            {description}
          </p>
          {formFields ? <div className="mt-4">{formFields}</div> : null}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button
              onClick={() => dialogRef.current?.close()}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <PendingSubmitButton
              pendingLabel={pendingLabel}
              variant={triggerVariant}
            >
              {confirmLabel}
            </PendingSubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}

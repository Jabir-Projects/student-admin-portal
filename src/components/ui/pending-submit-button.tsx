"use client";

import type { ComponentProps, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

type PendingSubmitButtonProps = Omit<
  ComponentProps<typeof Button>,
  "children" | "type"
> & {
  children: ReactNode;
  pendingLabel: ReactNode;
};

export function PendingSubmitButton({
  children,
  disabled,
  pendingLabel,
  ...props
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-busy={pending || undefined}
      disabled={disabled || pending}
      type="submit"
      {...props}
    >
      {pending ? (
        <>
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

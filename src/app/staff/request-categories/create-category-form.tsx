"use client";

import { useActionState } from "react";

import {
  createCategoryAction,
  type CreateCategoryActionState,
} from "./actions";
import { FeedbackBanner } from "@/components/feedback/feedback-banner";
import { Button } from "@/components/ui/button";

const initialState = { status: "idle" } satisfies CreateCategoryActionState;

export function CreateCategoryForm() {
  const [state, formAction, isPending] = useActionState(
    async (previousState: CreateCategoryActionState, formData: FormData) => {
      const result = await createCategoryAction(previousState, formData);
      if (result.status === "success") {
        window.location.assign("/staff/request-categories?result=success");
      }
      return result;
    },
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-4 md:grid-cols-2">
      {state.status === "error" ? (
        <FeedbackBanner className="md:col-span-2" tone="error">
          The category operation could not be completed.
        </FeedbackBanner>
      ) : null}
      <label className="grid gap-1.5">
        <span className="text-sm font-semibold">Name</span>
        <input
          className="border-input bg-background h-10 rounded-md border px-3"
          maxLength={120}
          minLength={2}
          name="name"
          required
        />
      </label>
      <label className="grid gap-1.5 md:col-span-2">
        <span className="text-sm font-semibold">Description</span>
        <textarea
          className="border-input bg-background min-h-24 rounded-md border p-3"
          maxLength={1000}
          name="description"
        />
      </label>
      <Button className="w-fit" disabled={isPending} type="submit">
        {isPending ? "Creating…" : "Create category"}
      </Button>
    </form>
  );
}

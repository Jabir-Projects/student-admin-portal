"use client";

import { submitStudentRequestAction } from "@/app/student/requests/new/actions";
import { FeedbackBanner } from "@/components/feedback/feedback-banner";
import { Button } from "@/components/ui/button";

const fieldClass =
  "bg-background border-input min-h-11 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

const submissionErrorMessages: Readonly<Record<string, string>> = {
  CATEGORY_UNAVAILABLE: "That request category is no longer available.",
  DISABLED_ACCOUNT:
    "Your session cannot submit this request. Sign in again or contact administration.",
  DUPLICATE_OPEN_REQUEST:
    "You already have an open request in this category.",
  INACTIVE_ACCOUNT:
    "Your session cannot submit this request. Sign in again or contact administration.",
  INVALID_INPUT: "Check the request fields and try again.",
  STALE_SESSION:
    "Your session cannot submit this request. Sign in again or contact administration.",
  UNAUTHENTICATED:
    "Your session cannot submit this request. Sign in again or contact administration.",
  WRONG_ROLE:
    "Your session cannot submit this request. Sign in again or contact administration.",
};

function getSubmissionErrorMessage(result: string) {
  return (
    submissionErrorMessages[result] ??
    "The request could not be submitted. Check the fields and try again."
  );
}

export function RequestForm({
  categories,
  selectedCategoryId,
  result,
}: {
  categories: readonly { id: string; name: string }[];
  selectedCategoryId?: string;
  result?: string;
}) {
  const pending = false;
  return (
    <form
      action={submitStudentRequestAction}
      aria-describedby={result ? "request-form-error" : undefined}
      className="grid gap-5"
    >
      <label className="grid gap-2 text-sm font-medium">
        Request category
        <select
          className={fieldClass}
          defaultValue={selectedCategoryId ?? ""}
          name="categoryId"
          required
        >
          <option disabled value="">
            Select a category
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium">Delivery method</legend>
        <label className="border-input flex min-h-11 items-center gap-3 rounded-md border px-3 py-2 text-sm">
          <input
            defaultChecked
            name="deliveryMethod"
            type="radio"
            value="CAMPUS_PICKUP"
          />{" "}
          Campus pickup
        </label>
        <label className="border-input flex min-h-11 items-center gap-3 rounded-md border px-3 py-2 text-sm">
          <input name="deliveryMethod" type="radio" value="DIGITAL_DELIVERY" />{" "}
          Digital delivery
        </label>
      </fieldset>
      <label className="grid gap-2 text-sm font-medium">
        Number of copies
        <input
          className={fieldClass}
          defaultValue={1}
          max={5}
          min={1}
          name="copyCount"
          required
          type="number"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        Additional details{" "}
        <span className="text-muted-foreground font-normal">
          (optional, 1000 characters maximum)
        </span>
        <textarea
          className={`${fieldClass} min-h-28 resize-y`}
          maxLength={1000}
          name="details"
        />
      </label>
      {result ? (
        <FeedbackBanner id="request-form-error" tone="error">
          {getSubmissionErrorMessage(result)}
        </FeedbackBanner>
      ) : null}
      <Button className="w-fit" type="submit">
        {pending ? "Submitting…" : "Submit request"}
      </Button>
    </form>
  );
}

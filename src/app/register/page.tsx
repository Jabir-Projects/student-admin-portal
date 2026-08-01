import Link from "next/link";
import type { ComponentProps } from "react";

import { registerAction } from "@/app/register/actions";
import { FeedbackBanner } from "@/components/feedback/feedback-banner";
import { AuthPanel, AuthShell } from "@/components/layout/auth-shell";
import { Button } from "@/components/ui/button";
import { ACADEMIC_YEARS, PROGRAMS } from "@/features/auth/constants";

const inputClass =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthShell size="lg">
      <AuthPanel
        description="Submit your details for administrative review. Registration does not verify your Student Number institutionally."
        title="Student account registration"
      >
        <form
          action={registerAction}
          aria-describedby={error ? "registration-error" : undefined}
          className="grid gap-5 sm:grid-cols-2"
        >
          <Field
            label="Full Name"
            name="fullName"
            autoComplete="name"
            maxLength={200}
          />
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={320}
          />
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
          />
          <Field
            label="Confirm Password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
          />
          <Field label="Student Number" name="studentNumber" maxLength={50} />
          <label className="space-y-2 text-sm font-medium">
            Program
            <select
              className={inputClass}
              name="program"
              required
              defaultValue=""
            >
              <option disabled value="">
                Select a program
              </option>
              {PROGRAMS.map((program) => (
                <option key={program} value={program}>
                  {program}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm font-medium">
            Academic Year
            <select
              className={inputClass}
              name="academicYear"
              required
              defaultValue=""
            >
              <option disabled value="">
                Select an academic year
              </option>
              {ACADEMIC_YEARS.map((year) => (
                <option key={year.value} value={year.value}>
                  {year.label}
                </option>
              ))}
            </select>
          </label>
          {error ? (
            <FeedbackBanner
              className="sm:col-span-2"
              id="registration-error"
              tone="error"
            >
              The registration could not be submitted. Check the information or
              contact administration.
            </FeedbackBanner>
          ) : null}
          <div className="flex items-center gap-4 sm:col-span-2">
            <Button type="submit">Submit registration</Button>
            <Link
              className="text-primary text-sm hover:underline"
              href="/login"
            >
              Return to login
            </Link>
          </div>
        </form>
      </AuthPanel>
    </AuthShell>
  );
}

function Field({
  label,
  ...props
}: { label: string } & ComponentProps<"input">) {
  return (
    <label className="space-y-2 text-sm font-medium">
      {label}
      <input className={inputClass} required {...props} />
    </label>
  );
}

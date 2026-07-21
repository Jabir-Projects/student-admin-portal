import Link from "next/link";
import type { ComponentProps } from "react";

import { registerAction } from "@/app/register/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Student account registration</CardTitle>
          <p className="text-muted-foreground text-sm">
            Submit your details for administrative review. Registration does not
            verify your Student Number institutionally.
          </p>
        </CardHeader>
        <CardContent>
          <form action={registerAction} className="grid gap-5 sm:grid-cols-2">
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
              <p
                className="text-destructive text-sm sm:col-span-2"
                role="alert"
              >
                The registration could not be submitted. Check the information
                or contact administration.
              </p>
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
        </CardContent>
      </Card>
    </main>
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

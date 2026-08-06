"use client";

import type { ComponentProps, FormEvent, ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";

import { FeedbackBanner } from "@/components/feedback/feedback-banner";
import { Button } from "@/components/ui/button";
import { ACADEMIC_YEARS, PROGRAMS } from "@/features/auth/constants";
import { registrationSchema } from "@/features/auth/schemas";

const inputClass =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

type RegistrationFormProps = {
  action: ComponentProps<"form">["action"];
  error?: string;
};

type FieldErrors = Partial<Record<keyof RegistrationValues, string>>;

type RegistrationValues = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  studentNumber: string;
  program: string;
  academicYear: string;
};

const validationMessages: Record<keyof RegistrationValues, string> = {
  fullName: "Enter your full name (2–200 characters).",
  email: "Enter a valid email address.",
  password: "Password must contain at least 12 characters.",
  confirmPassword: "Passwords do not match.",
  studentNumber: "Enter your student number.",
  program: "Select a program.",
  academicYear: "Select an academic year.",
};

export function RegistrationForm({ action, error }: RegistrationFormProps) {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function validate(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const values: RegistrationValues = {
      fullName: String(formData.get("fullName") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      confirmPassword: String(formData.get("confirmPassword") ?? ""),
      studentNumber: String(formData.get("studentNumber") ?? ""),
      program: String(formData.get("program") ?? ""),
      academicYear: String(formData.get("academicYear") ?? ""),
    };
    const result = registrationSchema.safeParse(values);

    if (result.success) {
      setFieldErrors({});
      return;
    }

    event.preventDefault();
    const nextErrors: FieldErrors = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (typeof field !== "string" || field in nextErrors) continue;

      nextErrors[field as keyof RegistrationValues] =
        validationMessages[field as keyof RegistrationValues];
    }
    if (values.password !== values.confirmPassword) {
      nextErrors.confirmPassword = validationMessages.confirmPassword;
    }
    setFieldErrors(nextErrors);
  }

  return (
    <form
      action={action}
      aria-describedby={error ? "registration-error" : undefined}
      className="grid gap-5 sm:grid-cols-2"
      noValidate
      onSubmit={validate}
    >
      <RegistrationField
        error={fieldErrors.fullName}
        label="Full Name"
        name="fullName"
        autoComplete="name"
        maxLength={200}
      />
      <RegistrationField
        error={fieldErrors.email}
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        maxLength={320}
      />
      <RegistrationField
        error={fieldErrors.password}
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        maxLength={128}
      />
      <RegistrationField
        error={fieldErrors.confirmPassword}
        label="Confirm Password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        maxLength={128}
      />
      <RegistrationField
        error={fieldErrors.studentNumber}
        label="Student Number"
        name="studentNumber"
        maxLength={50}
      />
      <RegistrationSelect
        error={fieldErrors.program}
        label="Program"
        name="program"
      >
        <option disabled value="">
          Select a program
        </option>
        {PROGRAMS.map((program) => (
          <option key={program} value={program}>
            {program}
          </option>
        ))}
      </RegistrationSelect>
      <RegistrationSelect
        error={fieldErrors.academicYear}
        label="Academic Year"
        name="academicYear"
      >
        <option disabled value="">
          Select an academic year
        </option>
        {ACADEMIC_YEARS.map((year) => (
          <option key={year.value} value={year.value}>
            {year.label}
          </option>
        ))}
      </RegistrationSelect>
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
        <Link className="text-primary text-sm hover:underline" href="/login">
          Return to login
        </Link>
      </div>
    </form>
  );
}

function RegistrationField({
  error,
  label,
  ...props
}: { error?: string; label: string } & ComponentProps<"input">) {
  const errorId = `${props.name}-error`;
  return (
    <label className="space-y-2 text-sm font-medium">
      {label}
      <input
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        className={inputClass}
        required
        {...props}
      />
      {error ? (
        <p className="text-destructive text-sm" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </label>
  );
}

function RegistrationSelect({
  children,
  error,
  label,
  name,
}: {
  children: ReactNode;
  error?: string;
  label: string;
  name: keyof RegistrationValues;
}) {
  const errorId = `${name}-error`;
  return (
    <label className="space-y-2 text-sm font-medium">
      {label}
      <select
        aria-describedby={error ? errorId : undefined}
        aria-invalid={Boolean(error)}
        className={inputClass}
        defaultValue=""
        name={name}
        required
      >
        <>{children}</>
      </select>
      {error ? (
        <p className="text-destructive text-sm" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </label>
  );
}

"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { loginSchema } from "@/features/auth/schemas";

export async function loginAction(formData: FormData): Promise<void> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/login?error=invalid");
  try {
    await signIn("credentials", {
      ...parsed.data,
      redirectTo: "/auth/continue",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const code = "code" in error ? error.code : undefined;
      if (code === "pending_approval") redirect("/pending-approval");
      if (code === "account_disabled") redirect("/login?error=disabled");
      redirect("/login?error=invalid");
    }
    throw error;
  }
}

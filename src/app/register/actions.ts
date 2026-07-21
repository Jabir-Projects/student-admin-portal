"use server";

import { redirect } from "next/navigation";
import { registerStudent } from "@/server/auth/registration";

export async function registerAction(formData: FormData): Promise<void> {
  const result = await registerStudent(Object.fromEntries(formData));
  redirect(
    result.ok ? "/pending-approval?registered=1" : "/register?error=invalid",
  );
}

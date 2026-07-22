"use server";

import { redirect } from "next/navigation";
import { registerStudent } from "@/server/auth/registration";

export async function registerAction(formData: FormData): Promise<void> {
  let destination = "/register?error=invalid";

  try {
    const result = await registerStudent({
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      password: formData.get("password"),
      confirmPassword: formData.get("confirmPassword"),
      studentNumber: formData.get("studentNumber"),
      program: formData.get("program"),
      academicYear: formData.get("academicYear"),
    });
    if (result.ok) destination = "/pending-approval?registered=1";
  } catch {
    destination = "/register?error=invalid";
  }

  redirect(destination);
}

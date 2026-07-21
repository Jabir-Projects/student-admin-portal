"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  approvePendingStudent,
  disableStudent,
  disableStudentByEmail,
} from "@/server/auth/account-management";

export async function approveAction(formData: FormData): Promise<void> {
  const targetUserId = formData.get("targetUserId");
  if (typeof targetUserId !== "string")
    redirect("/admin/users/pending?result=rejected");
  const result = await approvePendingStudent(targetUserId);
  revalidatePath("/admin/users/pending");
  redirect(
    result.ok
      ? "/admin/users/pending?result=approved"
      : "/admin/users/pending?result=stale",
  );
}

export async function disableByEmailAction(formData: FormData): Promise<void> {
  const email = formData.get("email");
  if (typeof email !== "string")
    redirect("/admin/users/pending?result=rejected");
  const result = await disableStudentByEmail(email);
  revalidatePath("/admin/users/pending");
  redirect(
    result.ok
      ? "/admin/users/pending?result=disabled"
      : "/admin/users/pending?result=rejected",
  );
}

export async function disableAction(formData: FormData): Promise<void> {
  const targetUserId = formData.get("targetUserId");
  if (typeof targetUserId !== "string")
    redirect("/admin/users/pending?result=rejected");
  const result = await disableStudent(targetUserId);
  revalidatePath("/admin/users/pending");
  redirect(
    result.ok
      ? "/admin/users/pending?result=disabled"
      : "/admin/users/pending?result=stale",
  );
}

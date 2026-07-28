"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { signOut } from "@/auth";
import { SESSION_HISTORY_COOKIE_NAME } from "@/features/auth/session-marker";

export async function logoutAction(): Promise<void> {
  await signOut({ redirect: false, redirectTo: "/login" });
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_HISTORY_COOKIE_NAME);
  redirect("/login");
}

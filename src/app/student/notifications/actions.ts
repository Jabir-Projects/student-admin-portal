"use server";

import { revalidatePath } from "next/cache";

import { getActorSessionClaims } from "@/server/auth/capabilities";
import { db } from "@/server/db";
import {
  markAllOwnedNotificationsRead,
  markOwnedNotificationRead,
} from "@/server/notifications/mutations.node";

export async function markStudentNotificationReadAction(formData: FormData) {
  await markOwnedNotificationRead(
    await getActorSessionClaims(),
    "STUDENT",
    { notificationId: formData.get("notificationId") },
    db,
  );
  revalidatePath("/student/notifications");
}

export async function markAllStudentNotificationsReadAction() {
  await markAllOwnedNotificationsRead(
    await getActorSessionClaims(),
    "STUDENT",
    db,
  );
  revalidatePath("/student/notifications");
}

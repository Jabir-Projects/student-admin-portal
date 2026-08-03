"use server";

import { revalidatePath } from "next/cache";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { db } from "@/server/db";
import {
  markAllOwnedNotificationsRead,
  markOwnedNotificationRead,
} from "@/server/notifications/mutations.node";

export async function markStaffNotificationReadAction(formData: FormData) {
  await markOwnedNotificationRead(
    await getActorSessionClaims(),
    "STAFF",
    { notificationId: formData.get("notificationId") },
    db,
  );
  revalidatePath("/staff/notifications");
}
export async function markAllStaffNotificationsReadAction() {
  await markAllOwnedNotificationsRead(
    await getActorSessionClaims(),
    "STAFF",
    db,
  );
  revalidatePath("/staff/notifications");
}

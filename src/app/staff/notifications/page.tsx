import { NotificationList } from "@/components/notifications/notification-list";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { redirectForAuthorizationFailure } from "@/server/auth/session-routing";
import { db } from "@/server/db";
import { listOwnedNotifications } from "@/server/notifications/reads.node";
import {
  markAllStaffNotificationsReadAction,
  markStaffNotificationReadAction,
} from "./actions";

export default async function StaffNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const result = await listOwnedNotifications(
    await getActorSessionClaims(),
    "STAFF",
    { page: raw.page },
    db,
  );
  if (!result.ok) {
    if (result.reason !== "INVALID_INPUT")
      redirectForAuthorizationFailure(result.reason);
    return <p role="alert">The notification page could not be loaded.</p>;
  }
  return (
    <NotificationList
      notifications={result.notifications}
      unread={result.unread}
      page={result.page}
      pageCount={result.pageCount}
      route="/staff/notifications"
      requestRoute="/staff/requests"
      markOneAction={markStaffNotificationReadAction}
      markAllAction={markAllStaffNotificationsReadAction}
    />
  );
}

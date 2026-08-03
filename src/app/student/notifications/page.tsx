import { NotificationList } from "@/components/notifications/notification-list";
import { redirectForAuthorizationFailure } from "@/server/auth/session-routing";
import { getActorSessionClaims } from "@/server/auth/capabilities";
import { db } from "@/server/db";
import { listOwnedNotifications } from "@/server/notifications/reads.node";
import {
  markAllStudentNotificationsReadAction,
  markStudentNotificationReadAction,
} from "./actions";

export default async function StudentNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const result = await listOwnedNotifications(
    await getActorSessionClaims(),
    "STUDENT",
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
      route="/student/notifications"
      requestRoute="/student/requests"
      markOneAction={markStudentNotificationReadAction}
      markAllAction={markAllStudentNotificationsReadAction}
    />
  );
}

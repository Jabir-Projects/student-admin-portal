import { Bell } from "lucide-react";
import Link from "next/link";

export function formatUnreadNotificationCount(count: number): string {
  return count > 99 ? "99+" : String(Math.max(0, count));
}

export function NotificationBell({
  href,
  unreadCount,
}: {
  href: string;
  unreadCount: number;
}) {
  const hasUnread = unreadCount > 0;
  const unreadLabel = formatUnreadNotificationCount(unreadCount);

  return (
    <Link
      aria-label={
        hasUnread ? `Notifications — ${unreadLabel} unread` : "Notifications"
      }
      className="border-border bg-background text-foreground hover:bg-muted relative inline-flex size-10 shrink-0 items-center justify-center rounded-lg border transition-colors"
      href={href}
      title={
        hasUnread ? `${unreadLabel} unread notifications` : "Notifications"
      }
    >
      <Bell aria-hidden="true" className="size-4.5" />
      {hasUnread ? (
        <span
          aria-hidden="true"
          className="bg-destructive absolute -top-1.5 -right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.625rem] leading-none font-bold text-white"
        >
          {unreadLabel}
        </span>
      ) : null}
    </Link>
  );
}

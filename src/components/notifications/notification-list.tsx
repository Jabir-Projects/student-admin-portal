import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PendingSubmitButton } from "@/components/ui/pending-submit-button";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  readAt: Date | null;
  createdAt: Date;
  requestId: string | null;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function NotificationList({
  notifications,
  unread,
  page,
  pageCount,
  route,
  requestRoute,
  markOneAction,
  markAllAction,
}: {
  notifications: NotificationItem[];
  unread: number;
  page: number;
  pageCount: number;
  route: string;
  requestRoute: string;
  markOneAction: (formData: FormData) => Promise<void>;
  markAllAction: () => Promise<void>;
}) {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sist-green text-sm font-semibold tracking-[0.18em] uppercase">
            Notifications
          </p>
          <h1 className="text-sist-navy-dark mt-2 text-3xl font-bold">
            Notification centre
          </h1>
          <p className="text-muted-foreground mt-2">
            Updates are private to your active account.
          </p>
        </div>
        <form action={markAllAction}>
          <PendingSubmitButton
            disabled={unread === 0}
            pendingLabel="Marking all…"
            variant="outline"
          >
            Mark all as read
          </PendingSubmitButton>
        </form>
      </header>

      <section aria-label="Owned notifications" className="space-y-3">
        {notifications.length === 0 ? (
          <div className="bg-card rounded-xl border border-dashed p-8 text-center">
            <h2 className="font-semibold">No notifications</h2>
            <p className="text-muted-foreground mt-2 text-sm">
              New updates will appear here.
            </p>
          </div>
        ) : (
          notifications.map((notification) => (
            <article
              className="bg-card rounded-xl border p-5"
              key={notification.id}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{notification.title}</h2>
                    {!notification.readAt && (
                      <span className="bg-sist-green rounded-full px-2 py-0.5 text-xs font-semibold text-white">
                        Unread
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-2 text-sm leading-6">
                    {notification.body}
                  </p>
                  <time
                    className="text-muted-foreground mt-3 block text-xs"
                    dateTime={notification.createdAt.toISOString()}
                  >
                    {dateFormatter.format(notification.createdAt)}
                  </time>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {notification.requestId && (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`${requestRoute}/${notification.requestId}`}>
                        View request
                      </Link>
                    </Button>
                  )}
                  {!notification.readAt && (
                    <form action={markOneAction}>
                      <input
                        name="notificationId"
                        type="hidden"
                        value={notification.id}
                      />
                      <PendingSubmitButton pendingLabel="Marking…" size="sm">
                        Mark read
                      </PendingSubmitButton>
                    </form>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </section>

      <nav
        aria-label="Notification pages"
        className="flex items-center justify-between gap-4"
      >
        <Button asChild={page > 1} disabled={page <= 1} variant="outline">
          {page > 1 ? (
            <Link href={`${route}?page=${page - 1}`}>Previous</Link>
          ) : (
            <span>Previous</span>
          )}
        </Button>
        <span className="text-muted-foreground text-sm">
          Page {page} of {pageCount}
        </span>
        <Button
          asChild={page < pageCount}
          disabled={page >= pageCount}
          variant="outline"
        >
          {page < pageCount ? (
            <Link href={`${route}?page=${page + 1}`}>Next</Link>
          ) : (
            <span>Next</span>
          )}
        </Button>
      </nav>
    </div>
  );
}

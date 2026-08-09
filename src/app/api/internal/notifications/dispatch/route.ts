import { env } from "@/lib/env";
import { db } from "@/server/db";
import { dispatchNotificationDeliveries } from "@/server/notifications/dispatcher.node";
import { createResendProviderFromEnvironment } from "@/server/notifications/provider.node";
import { hasAuthorizedSchedulerSecret } from "@/server/notifications/scheduler-auth.node";
import { logOperationalEvent } from "@/server/observability/logger.node";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (
    !hasAuthorizedSchedulerSecret(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  )
    return Response.json({ error: "Not found." }, { status: 404 });
  if (!env.APP_URL) {
    logOperationalEvent({
      event: "notifications.dispatch.unavailable",
      level: "error",
      metadata: { reasonCode: "APP_URL_MISSING" },
    });
    return Response.json({ error: "Service unavailable." }, { status: 503 });
  }
  try {
    const { provider, from } = createResendProviderFromEnvironment(process.env);
    const summary = await dispatchNotificationDeliveries(db, {
      from,
      portalBaseUrl: env.APP_URL,
      provider,
    });
    logOperationalEvent({
      event: "notifications.dispatch.completed",
      level: "info",
      metadata: { operation: "scheduled-delivery", result: "completed" },
    });
    return Response.json({ status: "ok", ...summary }, { status: 200 });
  } catch {
    logOperationalEvent({
      event: "notifications.dispatch.unavailable",
      level: "error",
      metadata: { reasonCode: "CONFIGURATION_OR_DEPENDENCY_FAILURE" },
    });
    return Response.json({ error: "Service unavailable." }, { status: 503 });
  }
}

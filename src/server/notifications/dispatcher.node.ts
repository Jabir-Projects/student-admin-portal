import "server-only";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { renderNotificationEmail } from "@/features/notifications/templates";
import type { EmailProvider } from "@/server/notifications/provider.node";

const maximumAttempts = 5;
const processingLeaseMs = 5 * 60_000;

type DispatchOptions = {
  provider: EmailProvider;
  from: string;
  portalBaseUrl: string;
  limit?: number;
  now?: Date;
};

async function claimDelivery(database: PrismaClient, now: Date) {
  const stale = new Date(now.getTime() - processingLeaseMs);
  return database.$transaction(
    async (transaction) => {
      const candidate = await transaction.notificationDelivery.findFirst({
        where: {
          attemptCount: { lt: maximumAttempts },
          OR: [
            { status: "PENDING", nextAttemptAt: { lte: now } },
            { status: "PROCESSING", processingStartedAt: { lte: stale } },
          ],
        },
        orderBy: [{ nextAttemptAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          status: true,
          attemptCount: true,
          processingStartedAt: true,
        },
      });
      if (!candidate) return null;
      const changed = await transaction.notificationDelivery.updateMany({
        where: {
          id: candidate.id,
          status: candidate.status,
          attemptCount: candidate.attemptCount,
          processingStartedAt: candidate.processingStartedAt,
        },
        data: {
          status: "PROCESSING",
          processingStartedAt: now,
          attemptCount: { increment: 1 },
          errorCode: null,
        },
      });
      if (changed.count !== 1) return null;
      return transaction.notificationDelivery.findUniqueOrThrow({
        where: { id: candidate.id },
        include: {
          notification: {
            include: {
              user: { select: { email: true, preferredLanguage: true } },
              request: { select: { id: true, status: true } },
            },
          },
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}

function normalizedErrorCode(value: string): string {
  return /^[A-Z0-9_]{1,120}$/u.test(value) ? value : "UNKNOWN_PROVIDER_ERROR";
}

export async function dispatchNotificationDeliveries(
  database: PrismaClient,
  options: DispatchOptions,
) {
  const now = options.now ?? new Date();
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
  const base = new URL(options.portalBaseUrl);
  const summary = { sent: 0, retried: 0, failed: 0 };
  for (let index = 0; index < limit; index += 1) {
    const delivery = await claimDelivery(database, now);
    if (!delivery) break;
    const requestId = delivery.notification.request?.id;
    const portalUrl = new URL(
      requestId ? `/student/requests/${requestId}` : "/student/notifications",
      base,
    ).toString();
    const rendered = renderNotificationEmail({
      eventType: delivery.notification.eventType,
      preferredLanguage: delivery.notification.user.preferredLanguage,
      portalUrl,
      status: delivery.notification.request?.status,
    });
    const result = await options.provider.send({
      to: delivery.notification.user.email,
      from: options.from,
      ...rendered,
      idempotencyKey: delivery.idempotencyKey,
    });
    if (result.ok) {
      const changed = await database.notificationDelivery.updateMany({
        where: {
          id: delivery.id,
          status: "PROCESSING",
          attemptCount: delivery.attemptCount,
        },
        data: {
          status: "SENT",
          sentAt: now,
          providerMessageId: result.messageId,
          processingStartedAt: null,
          errorCode: null,
        },
      });
      if (changed.count === 1) summary.sent += 1;
      continue;
    }
    const terminal = delivery.attemptCount >= maximumAttempts;
    const delay = 60_000 * 2 ** Math.max(0, delivery.attemptCount - 1);
    const changed = await database.notificationDelivery.updateMany({
      where: {
        id: delivery.id,
        status: "PROCESSING",
        attemptCount: delivery.attemptCount,
      },
      data: {
        status: terminal ? "FAILED" : "PENDING",
        nextAttemptAt: terminal ? now : new Date(now.getTime() + delay),
        processingStartedAt: null,
        errorCode: normalizedErrorCode(result.errorCode),
      },
    });
    if (changed.count === 1) {
      if (terminal) summary.failed += 1;
      else summary.retried += 1;
    }
  }
  return summary;
}

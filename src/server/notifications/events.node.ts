import "server-only";

import type {
  NotificationEventType,
  Prisma,
  RequestStatus,
} from "@/generated/prisma/client";

type Transaction = Prisma.TransactionClient;

async function enqueueNotification(
  transaction: Transaction,
  input: {
    userId: string;
    requestId: string;
    eventType: NotificationEventType;
    eventKey: string;
    title: string;
    body: string;
    email: boolean;
  },
) {
  const notification = await transaction.notification.upsert({
    where: { eventKey: input.eventKey },
    create: {
      userId: input.userId,
      requestId: input.requestId,
      eventType: input.eventType,
      eventKey: input.eventKey,
      title: input.title,
      body: input.body,
    },
    update: {},
    select: { id: true },
  });
  if (input.email)
    await transaction.notificationDelivery.createMany({
      data: [
        {
          notificationId: notification.id,
          channel: "EMAIL",
          idempotencyKey: `email:${input.eventKey}`,
        },
      ],
      skipDuplicates: true,
    });
}

export async function enqueueStudentRequestNotification(
  transaction: Transaction,
  input: {
    requestId: string;
    studentUserId: string;
    eventType: Extract<
      NotificationEventType,
      "REQUEST_STATUS_CHANGED" | "REQUEST_PUBLIC_MESSAGE_ADDED"
    >;
    eventId: string;
    status?: RequestStatus;
  },
) {
  const statusLabel = input.status?.replaceAll("_", " ").toLowerCase();
  await enqueueNotification(transaction, {
    userId: input.studentUserId,
    requestId: input.requestId,
    eventType: input.eventType,
    eventKey: `${input.eventType}:${input.eventId}:${input.studentUserId}`,
    title:
      input.eventType === "REQUEST_STATUS_CHANGED"
        ? "Request status updated"
        : "New request message",
    body:
      input.eventType === "REQUEST_STATUS_CHANGED"
        ? `Your request is now ${statusLabel ?? "updated"}.`
        : "A new public message is available for your request.",
    email: true,
  });
}

export async function enqueueStaffRequestNotifications(
  transaction: Transaction,
  input: {
    requestId: string;
    eventType: Extract<
      NotificationEventType,
      "REQUEST_SUBMITTED" | "REQUEST_CANCELLED"
    >;
  },
) {
  const recipients = await transaction.user.findMany({
    where: {
      role: "STAFF",
      status: "ACTIVE",
      capabilityAssignments: { some: { capability: "PROCESS_REQUESTS" } },
    },
    select: { id: true },
  });
  for (const recipient of recipients) {
    await enqueueNotification(transaction, {
      userId: recipient.id,
      requestId: input.requestId,
      eventType: input.eventType,
      eventKey: `${input.eventType}:${input.requestId}:${recipient.id}`,
      title:
        input.eventType === "REQUEST_SUBMITTED"
          ? "New student request"
          : "Student request cancelled",
      body:
        input.eventType === "REQUEST_SUBMITTED"
          ? "A new request is ready for staff review."
          : "A submitted request was cancelled by its student.",
      email: false,
    });
  }
}

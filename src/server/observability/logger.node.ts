import "server-only";

import { randomUUID } from "node:crypto";

const allowedMetadataKeys = [
  "operation",
  "provider",
  "reasonCode",
  "result",
  "statusCode",
] as const;

type AllowedMetadataKey = (typeof allowedMetadataKeys)[number];
type OperationalMetadata = Partial<Record<AllowedMetadataKey, string | number>>;

export type OperationalEvent = Readonly<{
  event: string;
  level: "error" | "info" | "warn";
  metadata?: OperationalMetadata;
  requestId?: string;
}>;

export function createRequestId(): string {
  return randomUUID();
}

export function serializeOperationalEvent(event: OperationalEvent): string {
  const metadata = Object.fromEntries(
    allowedMetadataKeys.flatMap((key) => {
      const value = event.metadata?.[key];
      return typeof value === "string" || typeof value === "number"
        ? [[key, value]]
        : [];
    }),
  );
  return JSON.stringify({
    event: event.event,
    level: event.level,
    metadata,
    requestId: event.requestId ?? createRequestId(),
  });
}

export function logOperationalEvent(
  event: OperationalEvent,
  write: (message: string) => void = console.error,
): void {
  write(serializeOperationalEvent(event));
}

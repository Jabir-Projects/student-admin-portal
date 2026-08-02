import { z } from "zod";

export const REQUEST_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "READY",
  "COMPLETED",
  "CANCELLED",
] as const;

export const ACTIVE_REQUEST_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "READY",
] as const;

export const TERMINAL_REQUEST_STATUSES = [
  "REJECTED",
  "COMPLETED",
  "CANCELLED",
] as const;

export const DELIVERY_METHODS = ["CAMPUS_PICKUP", "DIGITAL_DELIVERY"] as const;

export type RequestStatusValue = (typeof REQUEST_STATUSES)[number];
export type DeliveryMethodValue = (typeof DELIVERY_METHODS)[number];

const detailsSchema = z
  .string()
  .max(1000, "Details must be 1000 characters or fewer.")
  .transform((value) => value.trim() || null);

export const submitRequestInputSchema = z.object({
  categoryId: z.uuid(),
  copyCount: z.coerce.number().int().min(1).max(5),
  details: detailsSchema,
  deliveryMethod: z.enum(DELIVERY_METHODS),
});

export const requestHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().catch(1).default(1),
  status: z.enum(REQUEST_STATUSES).optional().catch(undefined),
});

export const cancelRequestInputSchema = z.object({ requestId: z.uuid() });

export function formatAcademicYear(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/^YEAR /u, "Year ")
    .replace(/^MASTER /u, "Master ")
    .replace(/^FOUNDATION$/u, "Foundation");
}

export function formatEnumLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

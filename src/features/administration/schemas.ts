import { z } from "zod";

import { REQUEST_STATUSES } from "@/features/student-portal/schemas";

const noControlCharacters = /^[^\u0000-\u001F\u007F]*$/u;
const normalizedOptional = (maximum: number) =>
  z
    .string()
    .transform((value) => value.trim().replace(/\s+/gu, " "))
    .pipe(z.string().max(maximum).regex(noControlCharacters))
    .transform((value) => value || undefined);

const normalizedText = (maximum: number) =>
  z
    .string()
    .transform((value) => value.trim().replace(/\s+/gu, " "))
    .pipe(z.string().max(maximum).regex(noControlCharacters));

export const requestQueueQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    status: z.enum(REQUEST_STATUSES).optional(),
    categoryId: z.string().trim().pipe(z.uuid()).optional(),
    reference: normalizedOptional(64).optional(),
    student: normalizedOptional(100).optional(),
  })
  .strict();

export const requestExportQuerySchema = requestQueueQuerySchema.omit({
  page: true,
});

const optionalCommunication = (maximum: number) =>
  z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().max(maximum).regex(noControlCharacters))
    .transform((value) => value || undefined);

export const requestTransitionInputSchema = z
  .object({
    requestId: z.string().pipe(z.uuid()),
    targetStatus: z.enum(REQUEST_STATUSES),
    rejectionReason: optionalCommunication(1000).optional(),
    internalNote: optionalCommunication(2000).optional(),
    publicMessage: optionalCommunication(1000).optional(),
  })
  .strict();

export const requestMessageInputSchema = z
  .object({
    requestId: z.string().pipe(z.uuid()),
    visibility: z.enum(["INTERNAL", "PUBLIC"]),
    body: z.string().transform((value) => value.trim()),
  })
  .strict()
  .superRefine((value, context) => {
    const maximum = value.visibility === "INTERNAL" ? 2000 : 1000;
    if (value.body.length < 1 || value.body.length > maximum) {
      context.addIssue({
        code: "custom",
        path: ["body"],
        message: `Message must contain between 1 and ${maximum} characters.`,
      });
    }
    if (!noControlCharacters.test(value.body)) {
      context.addIssue({
        code: "custom",
        path: ["body"],
        message: "Message contains unsupported control characters.",
      });
    }
  });

const categoryName = normalizedText(120).pipe(z.string().min(2));
const categoryDescription = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().max(1000).regex(noControlCharacters))
  .transform((value) => value || null);

export const createRequestCategoryInputSchema = z
  .object({ name: categoryName, description: categoryDescription })
  .strict();

export const updateRequestCategoryInputSchema = z
  .object({
    categoryId: z.string().pipe(z.uuid()),
    name: categoryName,
    description: categoryDescription,
  })
  .strict();

export const setRequestCategoryActiveInputSchema = z
  .object({ categoryId: z.string().pipe(z.uuid()), isActive: z.boolean() })
  .strict();

export const studentExportQuerySchema = z
  .object({
    search: normalizedOptional(100).optional(),
    status: z.enum(["all", "pending", "active", "disabled"]).default("all"),
  })
  .strict();

export type RequestQueueQuery = z.output<typeof requestQueueQuerySchema>;
export type RequestExportQuery = z.output<typeof requestExportQuerySchema>;
export type StudentExportQuery = z.output<typeof studentExportQuerySchema>;

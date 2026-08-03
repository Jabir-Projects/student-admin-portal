import { z } from "zod";

const pageSchema = z.coerce.number().int().min(1).max(100_000).default(1);
const filterText = z.string().trim().max(120).optional().catch(undefined);
const dateFilter = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/u)
  .optional()
  .catch(undefined);

export const notificationListQuerySchema = z.object({ page: pageSchema });

export const notificationReadInputSchema = z.object({
  notificationId: z.uuid(),
});

export const auditListQuerySchema = z
  .object({
    page: pageSchema,
    pageSize: z.coerce.number().int().min(1).max(50).default(25),
    action: filterText,
    entityType: filterText,
    actor: z.string().trim().max(100).optional().catch(undefined),
    dateFrom: dateFilter,
    dateTo: dateFilter,
  })
  .refine(
    ({ dateFrom, dateTo }) => !dateFrom || !dateTo || dateFrom <= dateTo,
    { message: "The start date must not be after the end date." },
  );

export type AuditListQuery = z.infer<typeof auditListQuerySchema>;

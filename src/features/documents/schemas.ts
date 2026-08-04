import { z } from "zod";

const identifier = z.string().trim().pipe(z.uuid());

export const generateDocumentInputSchema = z
  .object({ requestId: identifier })
  .strict();

export const artifactActionInputSchema = z
  .object({ artifactId: identifier })
  .strict();

export const revokeDocumentInputSchema = z
  .object({
    artifactId: identifier,
    reason: z
      .string()
      .transform((value) => value.trim().replace(/\s+/gu, " "))
      .pipe(
        z
          .string()
          .min(3)
          .max(1000)
          .regex(/^[^\u0000-\u001F\u007F]*$/u),
      ),
  })
  .strict();

export const documentListQuerySchema = z
  .object({ page: z.coerce.number().int().min(1).max(10_000).default(1) })
  .strict();

import { z } from "zod";

import { CAPABILITIES } from "@/features/auth/constants";
import {
  normalizeEmail,
  normalizeFullName,
} from "@/features/auth/normalization";

const noControlCharacters = /^[^\u0000-\u001F\u007F]*$/u;
const normalizedSearch = z
  .string()
  .transform((value) => value.trim().replace(/\s+/gu, " "))
  .pipe(z.string().max(100).regex(noControlCharacters));

export const accountManagementSearchSchema = normalizedSearch;
export const accountManagementPageSchema = z.number().int().min(1).max(10_000);
export const accountManagementPageSizeSchema = z
  .number()
  .int()
  .min(1)
  .max(50)
  .default(25);

export const managedStudentStatusSchema = z.enum([
  "PENDING_APPROVAL",
  "ACTIVE",
]);
export const managedStaffStatusSchema = z.enum(["ACTIVE", "DISABLED"]);
export const accountReferenceSchema = z
  .string()
  .min(1)
  .max(256)
  .regex(/^acct2\.[A-Za-z0-9_-]+$/u);
export const capabilityNameSchema = z.enum(CAPABILITIES);
export const accountManagementActionIntentSchema = z.enum([
  "approve-student",
  "disable-student",
  "reactivate-student",
  "disable-staff",
  "reactivate-staff",
  "grant-capability",
  "revoke-capability",
]);

export const studentAccountActionInputSchema = z
  .object({
    intent: z.enum([
      "approve-student",
      "disable-student",
      "reactivate-student",
    ]),
    accountReference: accountReferenceSchema,
  })
  .strict();

export const staffAccountActionInputSchema = z.discriminatedUnion("intent", [
  z
    .object({
      intent: z.enum(["disable-staff", "reactivate-staff"]),
      accountReference: accountReferenceSchema,
    })
    .strict(),
  z
    .object({
      intent: z.enum(["grant-capability", "revoke-capability"]),
      accountReference: accountReferenceSchema,
      capability: capabilityNameSchema,
    })
    .strict(),
  z
    .object({
      intent: z.literal("create-staff"),
      fullName: z
        .string()
        .transform(normalizeFullName)
        .pipe(z.string().min(2).max(200)),
      email: z.string().transform(normalizeEmail).pipe(z.email().max(320)),
      password: z.string().min(12).max(128),
      capabilities: z.array(capabilityNameSchema).max(CAPABILITIES.length),
    })
    .strict(),
]);

export const studentAccountPageQuerySchema = z
  .object({
    search: normalizedSearch.default(""),
    status: z.enum(["all", "pending", "active", "disabled"]).default("all"),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(25),
  })
  .strict();

export const staffAccountPageQuerySchema = z
  .object({
    search: normalizedSearch.default(""),
    status: z.enum(["all", "active", "disabled"]).default("all"),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(25),
  })
  .strict();

const paginatedSearchShape = {
  search: normalizedSearch.default(""),
  page: accountManagementPageSchema.default(1),
  pageSize: accountManagementPageSizeSchema,
} as const;

export const managedStudentReadInputSchema = z
  .object({
    ...paginatedSearchShape,
    status: managedStudentStatusSchema.optional(),
  })
  .strict();

export const disabledStudentReadInputSchema = z
  .object(paginatedSearchShape)
  .strict();

export const staffInventoryReadInputSchema = z
  .object({
    ...paginatedSearchShape,
    status: managedStaffStatusSchema.optional(),
  })
  .strict();

export const capabilityAssignmentReadInputSchema = z
  .object({
    ...paginatedSearchShape,
    status: managedStaffStatusSchema.optional(),
  })
  .strict();

export type ManagedStudentReadInput = z.input<
  typeof managedStudentReadInputSchema
>;
export type DisabledStudentReadInput = z.input<
  typeof disabledStudentReadInputSchema
>;
export type StaffInventoryReadInput = z.input<
  typeof staffInventoryReadInputSchema
>;
export type CapabilityAssignmentReadInput = z.input<
  typeof capabilityAssignmentReadInputSchema
>;
export type StudentAccountPageQuery = z.output<
  typeof studentAccountPageQuerySchema
>;
export type StaffAccountPageQuery = z.output<
  typeof staffAccountPageQuerySchema
>;

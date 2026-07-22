import { z } from "zod";

import { ACADEMIC_YEARS, PROGRAMS } from "@/features/auth/constants";
import {
  normalizeEmail,
  normalizeFullName,
  normalizeFullNameComparisonKey,
  normalizeStudentNumber,
} from "@/features/auth/normalization";

const studentNumberPattern = /^[A-Z0-9][A-Z0-9._/-]{0,49}$/u;
const studentNumberInputPattern = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,49}$/u;
const noControlCharacters = /^[^\u0000-\u001F\u007F]*$/u;

export const studentRegistryEmailSchema = z
  .string()
  .transform(normalizeEmail)
  .pipe(z.email().max(320));

export const studentRegistryStudentNumberSchema = z
  .string()
  .regex(noControlCharacters)
  .refine((value) => studentNumberInputPattern.test(value.trim()))
  .transform(normalizeStudentNumber)
  .pipe(z.string().max(50).regex(studentNumberPattern));

export const studentRegistryFullNameSchema = z
  .string()
  .transform(normalizeFullName)
  .pipe(z.string().min(1).max(200));

export const studentRegistryEntrySchema = z
  .object({
    studentNumber: studentRegistryStudentNumberSchema,
    fullName: studentRegistryFullNameSchema,
    email: studentRegistryEmailSchema,
    program: z.enum(PROGRAMS),
    academicYear: z.enum(ACADEMIC_YEARS.map(({ value }) => value)),
  })
  .strict()
  .transform((entry) => ({
    ...entry,
    normalizedFullName: normalizeFullNameComparisonKey(entry.fullName),
  }))
  .refine((entry) => entry.normalizedFullName.length <= 200, {
    message: "Full name is invalid.",
    path: ["fullName"],
  });

export type StudentRegistryEntry = z.infer<typeof studentRegistryEntrySchema>;

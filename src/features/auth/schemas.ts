import { z } from "zod";

import { ACADEMIC_YEARS, PROGRAMS } from "@/features/auth/constants";
import {
  normalizeEmail,
  normalizeFullName,
  normalizeStudentNumber,
} from "@/features/auth/normalization";

const noControlCharacters = /^[^\u0000-\u001F\u007F]*$/u;
const password = z.string().min(12).max(128);

export const registrationSchema = z
  .object({
    fullName: z
      .string()
      .transform(normalizeFullName)
      .pipe(z.string().min(2).max(200).regex(noControlCharacters)),
    email: z.string().transform(normalizeEmail).pipe(z.email().max(320)),
    password,
    confirmPassword: z.string().max(128),
    studentNumber: z
      .string()
      .transform(normalizeStudentNumber)
      .pipe(z.string().min(1).max(50).regex(noControlCharacters)),
    program: z.enum(PROGRAMS),
    academicYear: z.enum(ACADEMIC_YEARS.map(({ value }) => value)),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const loginSchema = z
  .object({
    email: z.string().transform(normalizeEmail).pipe(z.email().max(320)),
    password: z.string().min(1).max(128),
  })
  .strict();

export type RegistrationInput = z.infer<typeof registrationSchema>;

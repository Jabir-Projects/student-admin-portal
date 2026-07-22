import "server-only";

import {
  type RegistrationResult,
  registerStudentWithDatabase,
} from "@/server/auth/registration.node";
import { parseRegistrationVerificationMode } from "@/server/auth/env";
import { db } from "@/server/db";

export type { RegistrationResult };

export async function registerStudent(
  rawInput: unknown,
): Promise<RegistrationResult> {
  return registerStudentWithDatabase(rawInput, db, {
    verificationMode: parseRegistrationVerificationMode(process.env),
    runtime: process.env.NODE_ENV,
  });
}

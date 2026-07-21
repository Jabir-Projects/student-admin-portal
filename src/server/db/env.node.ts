import path from "node:path";

import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({
  path: path.resolve(process.cwd(), ".env.local"),
  quiet: true,
});

const databaseEnvironmentSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1)
    .refine((value) => /^postgres(?:ql)?:\/\//u.test(value), {
      message: "must be a PostgreSQL connection URL",
    }),
});

export type DatabaseEnvironment = z.infer<typeof databaseEnvironmentSchema>;

export function parseDatabaseEnvironment(
  environment: Record<string, string | undefined>,
): DatabaseEnvironment {
  const result = databaseEnvironmentSchema.safeParse(environment);
  if (!result.success) {
    const fields = result.error.issues
      .map((issue) => issue.path.join("."))
      .filter(Boolean)
      .join(", ");
    throw new Error(`Invalid database environment configuration: ${fields}`);
  }
  return result.data;
}

export const databaseEnv = parseDatabaseEnvironment({
  DATABASE_URL: process.env.DATABASE_URL,
});

import { z } from "zod";

const emptyStringToUndefined = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.url().optional(),
);

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_URL: emptyStringToUndefined,
});

export type Environment = z.infer<typeof environmentSchema>;

export function parseEnvironment(
  environment: Record<string, string | undefined>,
): Environment {
  const result = environmentSchema.safeParse(environment);

  if (!result.success) {
    const fields = result.error.issues
      .map((issue) => issue.path.join("."))
      .filter(Boolean)
      .join(", ");

    throw new Error(`Invalid environment configuration: ${fields}`);
  }

  return result.data;
}

export const env = parseEnvironment({
  NODE_ENV: process.env.NODE_ENV,
  APP_URL: process.env.APP_URL,
});

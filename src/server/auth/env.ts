import "server-only";

import { z } from "zod";

const authenticationEnvironmentSchema = z.object({
  AUTH_SECRET: z.string().min(32),
});

const registrationVerificationModes = [
  "MANUAL_APPROVAL",
  "INTERNAL_REGISTRY",
] as const;

const registrationVerificationModeSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.enum(registrationVerificationModes).default("MANUAL_APPROVAL"),
);

export type RegistrationVerificationMode =
  (typeof registrationVerificationModes)[number];

export function parseAuthenticationEnvironment(
  environment: Record<string, string | undefined>,
): z.infer<typeof authenticationEnvironmentSchema> {
  const result = authenticationEnvironmentSchema.safeParse(environment);
  if (!result.success) {
    const fields = result.error.issues
      .map((issue) => issue.path.join("."))
      .filter(Boolean)
      .join(", ");
    throw new Error(
      `Invalid authentication environment configuration: ${fields}`,
    );
  }
  return result.data;
}

export function getAuthenticationSecret(
  environment: Record<string, string | undefined>,
  options: { allowMissing: boolean } = { allowMissing: false },
): string | undefined {
  if (!environment.AUTH_SECRET && options.allowMissing) return undefined;
  return parseAuthenticationEnvironment({
    AUTH_SECRET: environment.AUTH_SECRET,
  }).AUTH_SECRET;
}

export function parseRegistrationVerificationMode(
  environment: Record<string, string | undefined>,
): RegistrationVerificationMode {
  const result = registrationVerificationModeSchema.safeParse(
    environment.REGISTRATION_VERIFICATION_MODE,
  );

  if (!result.success) {
    throw new Error("Invalid registration verification mode configuration");
  }

  return result.data;
}

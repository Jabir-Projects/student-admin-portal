export type ProviderReadinessResult =
  | {
      ok: false;
      reason: "missing provider configuration";
      missing: string[];
    }
  | {
      ok: false;
      reason:
        | "invalid email sender"
        | "invalid scheduler secret"
        | "in-memory document storage is not allowed"
        | "test document storage must be disabled";
    }
  | {
      ok: true;
      status: string;
      providers: { email: "configured"; storage: "configured" };
    };

export function verifyProviderReadiness(
  environment: Readonly<Record<string, string | undefined>>,
): ProviderReadinessResult;

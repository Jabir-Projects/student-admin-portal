export type ProductionVerificationResult = {
  ok: boolean;
  reason?: string;
  status?: string;
  missing?: string[];
  fingerprints?: {
    runtime: ProductionDatabaseFingerprint;
    direct: ProductionDatabaseFingerprint;
  };
};

export type ProductionDatabaseFingerprint = {
  hostFingerprint: string;
  databaseFingerprint: string;
  usernameFingerprint: string;
  ssl: string;
  connection: string;
};

export function verifyProductionEnvironment(
  environment: Record<string, string | undefined>,
): ProductionVerificationResult;

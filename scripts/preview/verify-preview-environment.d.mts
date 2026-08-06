export type PreviewVerificationResult = {
  ok: boolean;
  reason?: string;
  status?: string;
  missing?: string[];
  fingerprints?: PreviewDatabaseFingerprints;
};

export type PreviewDatabaseFingerprints = {
  normal: PreviewDatabaseFingerprint;
  direct: PreviewDatabaseFingerprint;
  test: PreviewDatabaseFingerprint;
};

export type PreviewDatabaseFingerprint = {
  protocol: string;
  hostFingerprint: string;
  databaseFingerprint: string;
  usernameFingerprint: string;
  ssl: string;
  connection: string;
};

export function verifyPreviewEnvironment(
  environment: Record<string, string | undefined>,
  options?: { probe?: boolean },
): PreviewVerificationResult;

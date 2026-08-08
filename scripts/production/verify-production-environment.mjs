import { createHash } from "node:crypto";

const required = ["APP_URL", "DATABASE_URL", "DIRECT_URL", "AUTH_SECRET"];

function fingerprint(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function parsePostgres(value) {
  try {
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) return undefined;
    return url;
  } catch {
    return undefined;
  }
}

function isSecurePostgres(url) {
  const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
  return (
    sslMode === "require" ||
    sslMode === "verify-ca" ||
    sslMode === "verify-full"
  );
}

function databaseFingerprint(url) {
  return {
    hostFingerprint: fingerprint(url.hostname),
    databaseFingerprint: fingerprint(url.pathname.slice(1)),
    usernameFingerprint: fingerprint(url.username),
    ssl: url.searchParams.get("sslmode") ?? "unspecified",
    connection: /pool|pooler/u.test(url.hostname)
      ? "pooled"
      : "direct-or-unknown",
  };
}

export function verifyProductionEnvironment(environment) {
  const missing = required.filter((key) => !environment[key]);
  if (missing.length)
    return { ok: false, reason: "missing configuration", missing };
  if (environment.AUTH_SECRET.length < 32)
    return { ok: false, reason: "invalid authentication secret" };
  let appUrl;
  try {
    appUrl = new URL(environment.APP_URL);
  } catch {
    return { ok: false, reason: "malformed production URL" };
  }
  if (
    appUrl.protocol !== "https:" ||
    /^(localhost|127\.0\.0\.1)$/u.test(appUrl.hostname)
  )
    return { ok: false, reason: "production URL must be public HTTPS" };

  const runtime = parsePostgres(environment.DATABASE_URL);
  const direct = parsePostgres(environment.DIRECT_URL);
  if (!runtime || !direct)
    return { ok: false, reason: "malformed PostgreSQL URL" };
  if (!isSecurePostgres(runtime) || !isSecurePostgres(direct))
    return { ok: false, reason: "PostgreSQL TLS is required" };
  if (environment.TEST_DATABASE_URL)
    return {
      ok: false,
      reason: "test database must not be configured in Production",
    };
  if (environment.ALLOW_DEVELOPMENT_SEED === "true")
    return {
      ok: false,
      reason: "development seed must be disabled in Production",
    };
  if (environment.DOCUMENT_STORAGE_DRIVER === "memory")
    return {
      ok: false,
      reason: "in-memory document storage is not allowed in Production",
    };
  if (environment.V2_9_TEST_STORAGE_ALLOWED === "true")
    return {
      ok: false,
      reason: "test document storage must be disabled in Production",
    };

  return {
    ok: true,
    status:
      "configuration is structurally production-safe; remote identity is not verified",
    fingerprints: {
      runtime: databaseFingerprint(runtime),
      direct: databaseFingerprint(direct),
    },
  };
}

if (
  process.argv[1] &&
  new URL(`file://${process.argv[1]}`).href === import.meta.url
) {
  const result = verifyProductionEnvironment(process.env);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.ok ? 0 : 1;
}

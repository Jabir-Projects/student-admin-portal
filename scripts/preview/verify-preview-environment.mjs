import { createHash } from "node:crypto";

const required = [
  "APP_URL",
  "DATABASE_URL",
  "DIRECT_URL",
  "TEST_DATABASE_URL",
  "AUTH_SECRET",
];

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

function classify(url) {
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1")
    return "local";
  if (/(prod|production)/u.test(host)) return "production";
  return "unknown";
}

function databaseFingerprint(url) {
  return {
    protocol: url.protocol.replace(":", ""),
    hostFingerprint: fingerprint(url.hostname),
    databaseFingerprint: fingerprint(url.pathname.slice(1)),
    usernameFingerprint: fingerprint(url.username),
    ssl: url.searchParams.get("sslmode") ?? "unspecified",
    connection: /pool|pooler/u.test(url.hostname) ? "pooled" : "direct",
  };
}

export function verifyPreviewEnvironment(environment, { probe = false } = {}) {
  const missing = required.filter((key) => !environment[key]);
  if (missing.length)
    return { ok: false, reason: "missing configuration", missing };
  if (environment.AUTH_SECRET.length < 32)
    return { ok: false, reason: "invalid authentication secret" };
  let appUrl;
  try {
    appUrl = new URL(environment.APP_URL);
  } catch {
    return { ok: false, reason: "malformed preview URL" };
  }
  if (!/^https?:$/u.test(appUrl.protocol))
    return { ok: false, reason: "malformed preview URL" };
  const normal = parsePostgres(environment.DATABASE_URL);
  const direct = parsePostgres(environment.DIRECT_URL);
  const test = parsePostgres(environment.TEST_DATABASE_URL);
  if (!normal || !direct || !test)
    return { ok: false, reason: "malformed PostgreSQL URL" };
  if (
    environment.DATABASE_URL === environment.TEST_DATABASE_URL ||
    environment.DIRECT_URL === environment.TEST_DATABASE_URL
  )
    return { ok: false, reason: "identical database targets" };
  const classifications = [normal, direct, test].map(classify);
  if (classifications.includes("production"))
    return { ok: false, reason: "production-classified target" };
  if (classifications.includes("unknown"))
    return { ok: false, reason: "unknown target classification" };
  if (probe)
    return {
      ok: false,
      reason: "probe requires approved external identity verification",
      fingerprints: {
        normal: databaseFingerprint(normal),
        direct: databaseFingerprint(direct),
        test: databaseFingerprint(test),
      },
    };
  return {
    ok: true,
    status: "structurally distinct; identities not remotely verified",
    fingerprints: {
      normal: databaseFingerprint(normal),
      direct: databaseFingerprint(direct),
      test: databaseFingerprint(test),
    },
  };
}

if (
  process.argv[1] &&
  new URL(`file://${process.argv[1]}`).href === import.meta.url
) {
  const result = verifyPreviewEnvironment(process.env, {
    probe: process.argv.includes("--probe"),
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.ok ? 0 : 1;
}

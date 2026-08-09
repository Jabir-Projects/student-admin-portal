const required = ["RESEND_API_KEY", "EMAIL_FROM", "CRON_SECRET"];

function hasStorageIdentity(environment) {
  return Boolean(
    environment.BLOB_READ_WRITE_TOKEN?.trim() ||
    environment.BLOB_STORE_ID?.trim(),
  );
}

function hasValidSender(value) {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u.test(value?.trim() ?? "");
}

function hasValidCronSecret(value) {
  return (value?.trim().length ?? 0) >= 32;
}

export function verifyProviderReadiness(environment) {
  const missing = required.filter((key) => !environment[key]?.trim());
  if (!hasStorageIdentity(environment))
    missing.unshift("BLOB_STORAGE_IDENTITY");
  if (missing.length)
    return { ok: false, reason: "missing provider configuration", missing };
  if (!hasValidSender(environment.EMAIL_FROM))
    return { ok: false, reason: "invalid email sender" };
  if (!hasValidCronSecret(environment.CRON_SECRET))
    return { ok: false, reason: "invalid scheduler secret" };
  if (environment.DOCUMENT_STORAGE_DRIVER === "memory")
    return { ok: false, reason: "in-memory document storage is not allowed" };
  if (environment.V2_9_TEST_STORAGE_ALLOWED === "true")
    return { ok: false, reason: "test document storage must be disabled" };
  return {
    ok: true,
    status:
      "storage and email configuration is structurally ready; remote provider identity is not verified",
    providers: { email: "configured", storage: "configured" },
  };
}

if (
  process.argv[1] &&
  new URL(`file://${process.argv[1]}`).href === import.meta.url
) {
  const result = verifyProviderReadiness(process.env);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.ok ? 0 : 1;
}

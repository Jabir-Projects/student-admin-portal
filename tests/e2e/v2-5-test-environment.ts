export const browserOnlyAuthSecret =
  "v2-5-browser-only-secret-0000000000000000";

export function requireIsolatedBrowserDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) {
    throw new Error("The isolated V2-5 browser database is unavailable.");
  }

  const url = new URL(value);
  url.searchParams.delete("channel_binding");
  url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}

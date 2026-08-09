import { describe, expect, it } from "vitest";

import { verifyProviderReadiness } from "../../scripts/operations/verify-provider-readiness.mjs";

const fixture = {
  BLOB_STORE_ID: "store_opaque_identifier",
  EMAIL_FROM: "notifications@portal.example.edu",
  RESEND_API_KEY: "test-only-provider-key",
  CRON_SECRET: "a".repeat(32),
  V2_9_TEST_STORAGE_ALLOWED: "false",
};

describe("provider readiness verifier", () => {
  it("fails closed for missing, unsafe, or malformed provider configuration", () => {
    expect(verifyProviderReadiness({})).toMatchObject({
      ok: false,
      reason: "missing provider configuration",
      missing: [
        "BLOB_STORAGE_IDENTITY",
        "RESEND_API_KEY",
        "EMAIL_FROM",
        "CRON_SECRET",
      ],
    });
    expect(
      verifyProviderReadiness({ ...fixture, EMAIL_FROM: "invalid" }),
    ).toMatchObject({ ok: false, reason: "invalid email sender" });
    expect(
      verifyProviderReadiness({
        ...fixture,
        DOCUMENT_STORAGE_DRIVER: "memory",
      }),
    ).toMatchObject({
      ok: false,
      reason: "in-memory document storage is not allowed",
    });
    expect(
      verifyProviderReadiness({ ...fixture, CRON_SECRET: "short" }),
    ).toMatchObject({ ok: false, reason: "invalid scheduler secret" });
  });

  it("reports provider categories without exposing values", () => {
    const result = verifyProviderReadiness(fixture);
    expect(result).toMatchObject({
      ok: true,
      providers: { email: "configured" },
    });
    expect(JSON.stringify(result)).not.toContain(fixture.RESEND_API_KEY);
    expect(JSON.stringify(result)).not.toContain(fixture.BLOB_STORE_ID);
  });
});

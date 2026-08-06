import { describe, expect, it } from "vitest";
import { verifyPreviewEnvironment } from "../../scripts/preview/verify-preview-environment.mjs";

const fixture = {
  APP_URL: "https://preview.localhost",
  DATABASE_URL:
    "postgresql://normal:password@localhost:5432/normal?sslmode=require",
  DIRECT_URL:
    "postgresql://direct:password@localhost:5433/direct?sslmode=require",
  TEST_DATABASE_URL:
    "postgresql://test:password@127.0.0.1:5434/test?sslmode=require",
  AUTH_SECRET: "a".repeat(32),
};
describe("preview environment verifier", () => {
  it("fails closed for missing, malformed, identical, unknown, and production targets", () => {
    expect(verifyPreviewEnvironment({})).toMatchObject({
      ok: false,
      reason: "missing configuration",
    });
    expect(
      verifyPreviewEnvironment({ ...fixture, TEST_DATABASE_URL: "invalid" }),
    ).toMatchObject({ ok: false, reason: "malformed PostgreSQL URL" });
    expect(
      verifyPreviewEnvironment({
        ...fixture,
        TEST_DATABASE_URL: fixture.DATABASE_URL,
      }),
    ).toMatchObject({ ok: false, reason: "identical database targets" });
    expect(
      verifyPreviewEnvironment({
        ...fixture,
        TEST_DATABASE_URL: fixture.TEST_DATABASE_URL.replace(
          "127.0.0.1",
          "test.invalid",
        ),
      }),
    ).toMatchObject({ ok: false, reason: "unknown target classification" });
    expect(
      verifyPreviewEnvironment({
        ...fixture,
        TEST_DATABASE_URL: fixture.TEST_DATABASE_URL.replace(
          "127.0.0.1",
          "production.invalid",
        ),
      }),
    ).toMatchObject({ ok: false, reason: "production-classified target" });
  });
  it("uses stable non-secret fingerprints and never validates remotely", () => {
    const result = verifyPreviewEnvironment(fixture);
    expect(result).toMatchObject({
      ok: true,
      status: "structurally distinct; identities not remotely verified",
    });
    expect(JSON.stringify(result)).not.toContain("password");
    expect(verifyPreviewEnvironment(fixture).fingerprints).toEqual(
      result.fingerprints,
    );
    const changed = verifyPreviewEnvironment({
      ...fixture,
      TEST_DATABASE_URL: fixture.TEST_DATABASE_URL.replace("/test?", "/other?"),
    });
    if (!result.fingerprints || !changed.fingerprints)
      throw new Error("expected validation fingerprints");
    expect(changed.fingerprints.test.databaseFingerprint).not.toBe(
      result.fingerprints.test.databaseFingerprint,
    );
    expect(verifyPreviewEnvironment(fixture, { probe: true })).toMatchObject({
      ok: false,
      reason: "probe requires approved external identity verification",
    });
  });
});

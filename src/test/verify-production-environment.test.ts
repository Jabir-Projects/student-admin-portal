import { describe, expect, it } from "vitest";

import { verifyProductionEnvironment } from "../../scripts/production/verify-production-environment.mjs";

const fixture = {
  APP_URL: "https://portal.example.edu",
  DATABASE_URL:
    "postgresql://runtime:password@pooler.example.invalid:5432/sist?sslmode=require",
  DIRECT_URL:
    "postgresql://migrator:password@direct.example.invalid:5432/sist?sslmode=verify-full",
  AUTH_SECRET: "a".repeat(32),
  ALLOW_DEVELOPMENT_SEED: "false",
  V2_9_TEST_STORAGE_ALLOWED: "false",
};

describe("production environment verifier", () => {
  it("fails closed for incomplete, unsafe, and test-only configuration", () => {
    expect(verifyProductionEnvironment({})).toMatchObject({
      ok: false,
      reason: "missing configuration",
    });
    expect(
      verifyProductionEnvironment({
        ...fixture,
        APP_URL: "http://localhost:3000",
      }),
    ).toMatchObject({
      ok: false,
      reason: "production URL must be public HTTPS",
    });
    expect(
      verifyProductionEnvironment({
        ...fixture,
        TEST_DATABASE_URL: fixture.DATABASE_URL,
      }),
    ).toMatchObject({
      ok: false,
      reason: "test database must not be configured in Production",
    });
    expect(
      verifyProductionEnvironment({
        ...fixture,
        DOCUMENT_STORAGE_DRIVER: "memory",
      }),
    ).toMatchObject({
      ok: false,
      reason: "in-memory document storage is not allowed in Production",
    });
  });

  it("returns stable non-secret fingerprints without remote access", () => {
    const result = verifyProductionEnvironment(fixture);
    expect(result).toMatchObject({
      ok: true,
      status:
        "configuration is structurally production-safe; remote identity is not verified",
    });
    expect(JSON.stringify(result)).not.toContain("password");
    expect(verifyProductionEnvironment(fixture).fingerprints).toEqual(
      result.fingerprints,
    );
  });
});

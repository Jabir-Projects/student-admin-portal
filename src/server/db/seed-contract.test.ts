// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "prisma/seed.ts"),
  "utf8",
);

describe("development seed safety contract", () => {
  it("requires production rejection and explicit development opt-in before client creation", () => {
    const productionGuard = source.indexOf(
      'process.env.NODE_ENV === "production"',
    );
    const optInGuard = source.indexOf(
      'process.env.ALLOW_DEVELOPMENT_SEED !== "true"',
    );
    const clientCreation = source.indexOf("createPrismaClient(");

    expect(productionGuard).toBeGreaterThan(-1);
    expect(optInGuard).toBeGreaterThan(productionGuard);
    expect(clientCreation).toBeGreaterThan(optInGuard);
  });

  it("does not log credential values", () => {
    expect(source).not.toMatch(
      /console\.(?:info|error|log)\([^)]*(?:password|hash|token|secret|DATABASE_URL|DIRECT_URL)/iu,
    );
  });

  it("seeds deterministic development-only demo actors without an ADMIN role", () => {
    expect(source).toContain('requireSeedPassword("SEED_STAFF_PASSWORD")');
    expect(source).toMatch(
      /requireSeedPassword\(\s*"SEED_STAFF_REVIEWER_PASSWORD"\s*,?\s*\)/u,
    );
    expect(source).not.toContain("SEED_ADMIN_PASSWORD");
    expect(source).toContain("role: UserRole.STAFF");
    expect(source).not.toContain("UserRole.ADMIN");
    expect(source).toContain("Object.values(Capability)");
    expect(source).toContain("Capability.REGISTRY_IMPORT_APPROVE");
    expect(source).toContain("Capability.FINANCE_IMPORT_APPROVE");
  });
});

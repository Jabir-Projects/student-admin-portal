// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "prisma/seed.ts"),
  "utf8",
);
const provisionSource = fs.readFileSync(
  path.resolve(process.cwd(), "prisma/provision-demo-accounts.ts"),
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

  it("keeps account-only provisioning development-gated and narrowly scoped", () => {
    const productionGuard = provisionSource.indexOf(
      'process.env.NODE_ENV === "production"',
    );
    const optInGuard = provisionSource.indexOf(
      'process.env.ALLOW_DEVELOPMENT_SEED !== "true"',
    );
    const clientCreation = provisionSource.indexOf("createPrismaClient(");

    expect(productionGuard).toBeGreaterThan(-1);
    expect(optInGuard).toBeGreaterThan(productionGuard);
    expect(clientCreation).toBeGreaterThan(optInGuard);
    expect(provisionSource).toContain(
      'email: "finance.upload.dev@example.invalid"',
    );
    expect(provisionSource).toContain(
      'email: "finance.approve.dev@example.invalid"',
    );
    expect(provisionSource).toContain(
      'email: "registry.upload.dev@example.invalid"',
    );
    expect(provisionSource).toContain(
      'email: "registry.approve.dev@example.invalid"',
    );
    expect(provisionSource).toContain('email: "reviewer.dev@example.invalid"');
    expect(provisionSource).toContain(
      "capabilities: Object.values(Capability)",
    );
    expect(provisionSource).not.toContain("@gmail.com");
    expect(provisionSource).not.toContain("studentProfile.");
    expect(provisionSource).not.toContain("requestCategory.");
    expect(provisionSource).not.toContain("documentRequest.");
    expect(provisionSource).not.toContain("financeTransaction.");
    expect(provisionSource).not.toContain("reconcileStudentRegistryDemo");
  });

  it("does not log credential values", () => {
    expect(source).not.toMatch(
      /console\.(?:info|error|log)\([^)]*(?:password|hash|token|secret|DATABASE_URL|DIRECT_URL)/iu,
    );
  });

  it("seeds deterministic development-only demo actors without an ADMIN role", () => {
    expect(source).toContain('requireSeedPassword("SEED_DEMO_PASSWORD")');
    expect(source).not.toContain("SEED_ADMIN_PASSWORD");
    expect(source).toContain("role: UserRole.STAFF");
    expect(source).not.toContain("UserRole.ADMIN");
    expect(source).toContain('email: "finance.upload.dev@example.invalid"');
    expect(source).toContain('email: "finance.approve.dev@example.invalid"');
    expect(source).toContain('email: "registry.upload.dev@example.invalid"');
    expect(source).toContain('email: "registry.approve.dev@example.invalid"');
    expect(source).toContain('email: "audit.staff.dev@example.invalid"');
    expect(source).toContain('email: "zero.staff.dev@example.invalid"');
    expect(source).toContain('email: "student.disabled.dev@example.invalid"');
    expect(source).toContain("capabilities: Object.values(Capability)");
    expect(source).toContain("Capability.REGISTRY_IMPORT_APPROVE");
    expect(source).toContain("Capability.FINANCE_IMPORT_APPROVE");
    expect(source).not.toContain("@gmail.com");
    expect(source).toContain("Development student profile ownership conflict.");
  });
});

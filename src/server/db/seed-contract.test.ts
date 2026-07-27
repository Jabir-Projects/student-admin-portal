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
});

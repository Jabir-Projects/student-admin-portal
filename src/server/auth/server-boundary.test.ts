// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function source(relativePath: string): string {
  return fs.readFileSync(path.resolve(root, relativePath), "utf8");
}

describe("server-only architecture", () => {
  it.each([
    "src/auth.ts",
    "src/server/db/index.ts",
    "src/server/db/client.ts",
    "src/server/db/factory.ts",
    "src/server/db/env.ts",
    "src/server/auth/password.ts",
    "src/server/auth/env.ts",
    "src/server/auth/registration.ts",
    "src/server/auth/registration.node.ts",
    "src/server/auth/verification.ts",
    "src/server/auth/verification.node.ts",
    "src/server/auth/account-management.ts",
    "src/server/auth/account-management.node.ts",
    "src/server/auth/audit-events.ts",
    "src/server/auth/capabilities.ts",
    "src/server/auth/capabilities.node.ts",
    "src/server/auth/dal.ts",
    "src/server/auth/dal.node.ts",
    "src/server/auth/session-routing.ts",
    "src/server/account-management/account-reference.node.ts",
    "src/server/account-management/authorization.node.ts",
    "src/server/account-management/reads.ts",
    "src/server/account-management/reads.node.ts",
    "src/server/account-management/student-actions.node.ts",
    "src/test/package-b-test-database.node.ts",
  ])("marks %s as server-only", (relativePath) => {
    expect(source(relativePath)).toMatch(/^import "server-only";/u);
  });

  it("keeps Proxy and lightweight auth configuration database-free", () => {
    const proxySource = `${source("src/proxy.ts")}\n${source("src/auth.config.ts")}`;
    expect(proxySource).not.toMatch(
      /@\/server|prisma|adapter-pg|argon2|password|registration|account-management|DATABASE_URL|DIRECT_URL/iu,
    );
  });

  it("keeps capabilities out of JWT and Session source contracts", () => {
    const sessionSources = `${source("src/auth.config.ts")}\n${source(
      "src/types/next-auth.d.ts",
    )}`;
    expect(sessionSources).not.toMatch(
      /capabilities\s*[?:]|CapabilityValue|UserCapabilityAssignment/u,
    );
  });

  it("removes the retired ADMIN compatibility route and action boundary", () => {
    for (const relativePath of [
      "src/app/admin/page.tsx",
      "src/app/admin/users/pending/page.tsx",
      "src/app/admin/users/pending/actions.ts",
      "src/server/account-management/legacy-admin-student-actions.node.ts",
    ]) {
      expect(fs.existsSync(path.resolve(root, relativePath))).toBe(false);
    }
  });

  it("keeps NULL grantors out of runtime capability management", () => {
    expect(source("src/server/auth/capabilities.node.ts")).not.toMatch(
      /grantedById:\s*null/u,
    );
  });

  it("keeps Package B PostgreSQL tests on the dedicated verified test boundary", () => {
    const integrationSource = [
      source("src/server/auth/phase-3.integration.test.ts"),
      source("src/server/auth/package-b-postgresql.integration.test.ts"),
    ].join("\n");
    const guardSource = source("src/test/package-b-test-database.node.ts");
    expect(integrationSource).not.toMatch(
      /@\/test\/isolated-database\.node|hasIsolatedTestDatabaseConfiguration|openVerifiedIsolatedTestDatabase|process\.env\.(?:DATABASE_URL|DIRECT_URL)|createPrismaClient/u,
    );
    expect(integrationSource).toMatch(
      /@\/test\/package-b-test-database\.node/gu,
    );
    expect(guardSource).not.toMatch(
      /createMutableClient\(\s*environment\.(?:DATABASE_URL|DIRECT_URL)/u,
    );
    expect(guardSource).toMatch(
      /createMutableClient\(\s*configuration\.testClient/u,
    );
    expect(guardSource).not.toContain("10000000-0000-4000-8000-000000000001");
    expect(guardSource).not.toContain("admin.dev@example.invalid");
    expect(guardSource).toContain("SIST_PACKAGE_B_ISOLATED_TEST_DATABASE_V1");
    expect(guardSource).toContain("public.sist_test_database_fingerprint");
    expect(guardSource).not.toContain("current_setting");
  });

  it("keeps PostgreSQL fixture cleanup behind the verified mutable client", () => {
    const packageBSource = source(
      "src/server/auth/package-b-postgresql.integration.test.ts",
    );
    const phase3Source = source("src/server/auth/phase-3.integration.test.ts");
    expect(packageBSource).toMatch(
      /async function cleanupFixtures\(\): Promise<void> \{\s*if \(!isolatedDb\) return;/u,
    );
    expect(packageBSource).toContain("beforeEach(resetFixtures);");
    expect(packageBSource).toContain("afterEach(cleanupFixtures);");
    expect(phase3Source).toContain("afterEach(cleanupScenarioUsers);");
  });

  it("keeps Client Components away from server modules", () => {
    const clientFiles = fs
      .readdirSync(path.resolve(root, "src"), { recursive: true })
      .filter(
        (entry): entry is string =>
          typeof entry === "string" && /\.(?:ts|tsx)$/u.test(entry),
      )
      .map((entry) => path.resolve(root, "src", entry))
      .filter((file) =>
        source(path.relative(root, file)).startsWith('"use client"'),
      );
    for (const file of clientFiles) {
      expect(fs.readFileSync(file, "utf8")).not.toMatch(/@\/server/u);
    }
  });

  it("keeps the registry verification implementation out of App Router entry points", () => {
    const appFiles = fs
      .readdirSync(path.resolve(root, "src/app"), { recursive: true })
      .filter(
        (entry): entry is string =>
          typeof entry === "string" && /\.(?:ts|tsx)$/u.test(entry),
      )
      .map((entry) => path.resolve(root, "src/app", entry));

    for (const file of appFiles) {
      expect(fs.readFileSync(file, "utf8")).not.toMatch(
        /@\/server\/auth\/verification(?:\.node)?/u,
      );
    }
  });
});

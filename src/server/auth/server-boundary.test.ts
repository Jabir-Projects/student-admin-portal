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
    "src/server/auth/dal.ts",
    "src/server/auth/dal.node.ts",
  ])("marks %s as server-only", (relativePath) => {
    expect(source(relativePath)).toMatch(/^import "server-only";/u);
  });

  it("keeps Proxy and lightweight auth configuration database-free", () => {
    const proxySource = `${source("src/proxy.ts")}\n${source("src/auth.config.ts")}`;
    expect(proxySource).not.toMatch(
      /@\/server|prisma|adapter-pg|argon2|password|registration|account-management|DATABASE_URL|DIRECT_URL/iu,
    );
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

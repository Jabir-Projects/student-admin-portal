import { describe, expect, it } from "vitest";

import { parseDatabaseEnvironment } from "@/server/db/env";

describe("parseDatabaseEnvironment", () => {
  it("accepts PostgreSQL connection URLs", () => {
    const parsed = parseDatabaseEnvironment({
      DATABASE_URL: "postgresql://example.invalid/database",
    });

    expect(parsed.DATABASE_URL).toBe("postgresql://example.invalid/database");
  });

  it("reports only the invalid field name", () => {
    expect(() =>
      parseDatabaseEnvironment({ DATABASE_URL: "not-a-database-url" }),
    ).toThrow("Invalid database environment configuration: DATABASE_URL");
  });
});

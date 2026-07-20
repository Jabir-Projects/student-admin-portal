import { describe, expect, it } from "vitest";

import { parseEnvironment } from "@/lib/env";

describe("parseEnvironment", () => {
  it("accepts an empty optional app URL", () => {
    expect(parseEnvironment({ NODE_ENV: "test", APP_URL: "" })).toStrictEqual({
      NODE_ENV: "test",
      APP_URL: undefined,
    });
  });

  it("rejects a malformed app URL without exposing its value", () => {
    expect(() =>
      parseEnvironment({ NODE_ENV: "production", APP_URL: "not-a-url" }),
    ).toThrow("Invalid environment configuration: APP_URL");
  });
});

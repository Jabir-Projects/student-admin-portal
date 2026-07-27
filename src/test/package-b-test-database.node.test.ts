// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

import { Client, type ClientConfig } from "pg";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  hasPackageBTestDatabaseConfiguration,
  PACKAGE_B_EXPECTED_MIGRATIONS,
  PACKAGE_B_TEST_DATABASE_FINGERPRINT,
  tryOpenPackageBTestDatabase,
} from "@/test/package-b-test-database.node";

const developmentUrl =
  "postgresql://development-user@development.invalid/application?sslmode=verify-full";
const directUrl =
  "postgresql://direct-user@direct.invalid/application?sslmode=verify-full";
const testUrl =
  "postgresql://test-user@isolated-test.invalid/application?sslmode=verify-full";
const validEnvironment = {
  NODE_ENV: "test",
  RUN_PACKAGE_B_POSTGRES_INTEGRATION: "true",
  DATABASE_URL: developmentUrl,
  DIRECT_URL: directUrl,
  TEST_DATABASE_URL: testUrl,
} as const;

function migrationRows(
  names: readonly string[] = PACKAGE_B_EXPECTED_MIGRATIONS,
) {
  return names.map((migrationName) => ({
    migrationName,
    finished: true,
    rolledBack: false,
  }));
}

function mockMutableDatabase(): PrismaClient {
  return {
    $disconnect: vi.fn().mockResolvedValue(undefined),
  } as unknown as PrismaClient;
}

function mockProbe(
  options: {
    fingerprintRows?: Array<{ fingerprint: string | null }>;
    migrations?: ReturnType<typeof migrationRows>;
    queryError?: Error;
    closeError?: Error;
  } = {},
) {
  const queryRows = options.queryError
    ? vi.fn().mockRejectedValue(options.queryError)
    : vi
        .fn()
        .mockResolvedValueOnce(
          options.fingerprintRows ?? [
            { fingerprint: PACKAGE_B_TEST_DATABASE_FINGERPRINT },
          ],
        )
        .mockResolvedValueOnce(options.migrations ?? migrationRows());
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    queryRows,
    close: options.closeError
      ? vi.fn().mockRejectedValue(options.closeError)
      : vi.fn().mockResolvedValue(undefined),
  };
}

function dependencies(
  probes: ReturnType<typeof mockProbe>[],
  mutableDatabases: PrismaClient[] = [mockMutableDatabase()],
) {
  return {
    createReadOnlyProbe: vi.fn((configuration: unknown) => {
      void configuration;
      const probe = probes.shift();
      if (!probe) throw new Error("Unexpected probe creation.");
      return probe;
    }),
    createMutableClient: vi.fn((configuration: unknown) => {
      void configuration;
      const database = mutableDatabases.shift();
      if (!database) throw new Error("Unexpected mutable client creation.");
      return database;
    }),
  };
}

function expectCertificateVerifiedTransport(configuration: unknown) {
  const client = new Client(configuration as ClientConfig) as Client & {
    enableChannelBinding: boolean;
  };

  expect(client.ssl).toEqual({ rejectUnauthorized: true });
  expect(client.ssl).not.toBe(false);
  expect(client.enableChannelBinding).toBe(false);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Package B PostgreSQL opt-in and effective-target validation", () => {
  it("requires explicit test execution approval and all three URLs", () => {
    expect(
      hasPackageBTestDatabaseConfiguration({
        ...validEnvironment,
        RUN_PACKAGE_B_POSTGRES_INTEGRATION: undefined,
      }),
    ).toBe(false);

    for (const key of [
      "TEST_DATABASE_URL",
      "DATABASE_URL",
      "DIRECT_URL",
    ] as const) {
      expect(
        hasPackageBTestDatabaseConfiguration({
          ...validEnvironment,
          [key]: undefined,
        }),
      ).toBe(false);
    }
  });

  it.each(["DATABASE_URL", "DIRECT_URL", "TEST_DATABASE_URL"] as const)(
    "requires sslmode=verify-full for %s",
    (key) => {
      expect(
        hasPackageBTestDatabaseConfiguration({
          ...validEnvironment,
          [key]: validEnvironment[key].replace("?sslmode=verify-full", ""),
        }),
      ).toBe(false);
    },
  );

  it.each([
    "require",
    "prefer",
    "allow",
    "disable",
    "no-verify",
    "",
    "unknown",
  ])("rejects weak or unknown sslmode=%s", (sslmode) => {
    expect(
      hasPackageBTestDatabaseConfiguration({
        ...validEnvironment,
        TEST_DATABASE_URL: testUrl.replace("verify-full", sslmode),
      }),
    ).toBe(false);
  });

  it.each([
    "host=development.invalid",
    "hostaddr=127.0.0.1",
    "port=5433",
    "database=development",
    "dbname=development",
    "user=development-user",
    "password=development-password",
    "options=-c%20sist.test_database_fingerprint%3Dinjected",
    "service=development",
    "servicefile=%2Fprivate%2Fpg_service.conf",
  ])("rejects forbidden connection parameter %s", (parameter) => {
    expect(
      hasPackageBTestDatabaseConfiguration({
        ...validEnvironment,
        TEST_DATABASE_URL: `${testUrl}&${parameter}`,
      }),
    ).toBe(false);
  });

  it("rejects URL fragments", () => {
    expect(
      hasPackageBTestDatabaseConfiguration({
        ...validEnvironment,
        TEST_DATABASE_URL: `${testUrl}#connection-override`,
      }),
    ).toBe(false);
  });

  it("rejects duplicate and ambiguous routing parameters", () => {
    expect(
      hasPackageBTestDatabaseConfiguration({
        ...validEnvironment,
        TEST_DATABASE_URL: `${testUrl}&host=first.invalid&host=second.invalid`,
      }),
    ).toBe(false);
    expect(
      hasPackageBTestDatabaseConfiguration({
        ...validEnvironment,
        TEST_DATABASE_URL: `${testUrl}&sslmode=verify-full`,
      }),
    ).toBe(false);
  });

  it("permits only the approved non-routing transport parameters", () => {
    expect(
      hasPackageBTestDatabaseConfiguration({
        ...validEnvironment,
        TEST_DATABASE_URL: `${testUrl}&sslnegotiation=postgres`,
      }),
    ).toBe(true);
    expect(
      hasPackageBTestDatabaseConfiguration({
        ...validEnvironment,
        TEST_DATABASE_URL: `${testUrl}&application_name=package-b`,
      }),
    ).toBe(false);
  });

  it.each(["require", "prefer", "disable", "", "unknown"])(
    "rejects channel_binding=%s",
    (value) => {
      expect(
        hasPackageBTestDatabaseConfiguration({
          ...validEnvironment,
          TEST_DATABASE_URL: `${testUrl}&channel_binding=${value}`,
        }),
      ).toBe(false);
    },
  );

  it("rejects duplicate channel_binding parameters", () => {
    expect(
      hasPackageBTestDatabaseConfiguration({
        ...validEnvironment,
        TEST_DATABASE_URL: `${testUrl}&channel_binding=require&channel_binding=require`,
      }),
    ).toBe(false);
  });

  it("cannot use channel binding text to bypass effective-target comparison", () => {
    expect(
      hasPackageBTestDatabaseConfiguration({
        ...validEnvironment,
        TEST_DATABASE_URL:
          "postgresql://other-user@DEVELOPMENT.INVALID:5432/application?sslmode=verify-full&channel_binding=require",
      }),
    ).toBe(false);
  });

  it("rejects an effective Development or direct target despite visible URL differences", () => {
    expect(
      hasPackageBTestDatabaseConfiguration({
        ...validEnvironment,
        TEST_DATABASE_URL:
          "postgres://other-user@DEVELOPMENT.INVALID:5432/application?sslmode=verify-full",
      }),
    ).toBe(false);
    expect(
      hasPackageBTestDatabaseConfiguration({
        ...validEnvironment,
        TEST_DATABASE_URL:
          "postgresql://other-user@DIRECT.INVALID:5432/application?sslmode=verify-full",
      }),
    ).toBe(false);
  });
});

describe("Package B database-owned fingerprint and migration verification", () => {
  it("probes TEST_DATABASE_URL before creating its mutable client", async () => {
    const probe = mockProbe();
    const mutableDatabase = mockMutableDatabase();
    const testDependencies = dependencies([probe], [mutableDatabase]);

    const result = await tryOpenPackageBTestDatabase(
      validEnvironment,
      testDependencies,
    );

    expect(result.ready).toBe(true);
    expect(testDependencies.createReadOnlyProbe).toHaveBeenCalledOnce();
    expect(probe.connect).toHaveBeenCalledOnce();
    expect(probe.queryRows).toHaveBeenCalledTimes(2);
    expect(testDependencies.createMutableClient).toHaveBeenCalledOnce();
    expectCertificateVerifiedTransport(
      testDependencies.createReadOnlyProbe.mock.calls[0]?.[0],
    );
    expectCertificateVerifiedTransport(
      testDependencies.createMutableClient.mock.calls[0]?.[0],
    );
    expect(
      testDependencies.createReadOnlyProbe.mock.invocationCallOrder[0],
    ).toBeLessThan(
      testDependencies.createMutableClient.mock.invocationCallOrder[0]!,
    );
    if (result.ready) await result.verified.close();
  });

  it.each(["", "&sslnegotiation=postgres", "&sslnegotiation=direct"])(
    "constructs certificate-verifying probe and mutable clients for accepted transport %s",
    async (transportSuffix) => {
      const probe = mockProbe();
      const mutableDatabase = mockMutableDatabase();
      const testDependencies = dependencies([probe], [mutableDatabase]);
      const environment = {
        ...validEnvironment,
        DATABASE_URL: `${developmentUrl}${transportSuffix}`,
        DIRECT_URL: `${directUrl}${transportSuffix}`,
        TEST_DATABASE_URL: `${testUrl}${transportSuffix}`,
      };

      const result = await tryOpenPackageBTestDatabase(
        environment,
        testDependencies,
      );

      expect(result.ready).toBe(true);
      expectCertificateVerifiedTransport(
        testDependencies.createReadOnlyProbe.mock.calls[0]?.[0],
      );
      expectCertificateVerifiedTransport(
        testDependencies.createMutableClient.mock.calls[0]?.[0],
      );
      if (result.ready) await result.verified.close();
    },
  );

  it.each([
    { fingerprintRows: [] },
    { fingerprintRows: [{ fingerprint: null }] },
    {
      fingerprintRows: [{ fingerprint: "SIST_DEVELOPMENT_DATABASE" }],
    },
    {
      fingerprintRows: [
        { fingerprint: PACKAGE_B_TEST_DATABASE_FINGERPRINT },
        { fingerprint: PACKAGE_B_TEST_DATABASE_FINGERPRINT },
      ],
    },
  ])(
    "fails closed for missing, incorrect, or duplicate fingerprint rows",
    async ({ fingerprintRows }) => {
      const probe = mockProbe({ fingerprintRows });
      const testDependencies = dependencies([probe]);

      await expect(
        tryOpenPackageBTestDatabase(validEnvironment, testDependencies),
      ).resolves.toEqual({
        ready: false,
        reason: "ISOLATION_NOT_VERIFIED",
      });
      expect(testDependencies.createMutableClient).not.toHaveBeenCalled();
      expect(probe.close).toHaveBeenCalledOnce();
    },
  );

  it("treats a missing fingerprint table as a sanitized isolation failure", async () => {
    const privateDetail =
      "relation missing at private.invalid for private-user/private-database";
    const probe = mockProbe({ queryError: new Error(privateDetail) });
    const testDependencies = dependencies([probe]);

    const result = await tryOpenPackageBTestDatabase(
      validEnvironment,
      testDependencies,
    );

    expect(result).toEqual({
      ready: false,
      reason: "ISOLATION_NOT_VERIFIED",
    });
    expect(JSON.stringify(result)).not.toContain(privateDetail);
    expect(testDependencies.createMutableClient).not.toHaveBeenCalled();
    expect(probe.close).toHaveBeenCalledOnce();
  });

  it("fails closed unless exactly the six approved migrations are applied", async () => {
    for (const migrations of [
      migrationRows(PACKAGE_B_EXPECTED_MIGRATIONS.slice(0, 5)),
      migrationRows([...PACKAGE_B_EXPECTED_MIGRATIONS, "unexpected"]),
      migrationRows([...PACKAGE_B_EXPECTED_MIGRATIONS].reverse()),
      migrationRows().map((row, index) =>
        index === 0 ? { ...row, rolledBack: true } : row,
      ),
    ]) {
      const probe = mockProbe({ migrations });
      const testDependencies = dependencies([probe]);
      await expect(
        tryOpenPackageBTestDatabase(validEnvironment, testDependencies),
      ).resolves.toEqual({
        ready: false,
        reason: "ISOLATION_NOT_VERIFIED",
      });
      expect(testDependencies.createMutableClient).not.toHaveBeenCalled();
    }
  });

  it("fails closed and exposes nothing when an expected migration is unfinished", async () => {
    const unfinishedTestUrl =
      "postgresql://unfinished-user:unfinished-credential@unfinished-test.invalid:6543/unfinished_database?sslmode=verify-full";
    const unfinishedEnvironment = {
      ...validEnvironment,
      TEST_DATABASE_URL: unfinishedTestUrl,
    };
    const migrations = migrationRows().map((row, index) =>
      index === 2 ? { ...row, finished: false } : row,
    );
    const probe = mockProbe({ migrations });
    const mutableDatabase = mockMutableDatabase();
    const testDependencies = dependencies([probe], [mutableDatabase]);

    const result = await tryOpenPackageBTestDatabase(
      unfinishedEnvironment,
      testDependencies,
    );
    const serialized = JSON.stringify(result);

    expect(result).toEqual({
      ready: false,
      reason: "ISOLATION_NOT_VERIFIED",
    });
    expect(testDependencies.createMutableClient).not.toHaveBeenCalled();
    expect(mutableDatabase.$disconnect).not.toHaveBeenCalled();
    expect(probe.close).toHaveBeenCalledOnce();
    for (const privateDetail of [
      unfinishedTestUrl,
      "unfinished-test.invalid",
      "6543",
      "unfinished_database",
      "unfinished-user",
      "unfinished-credential",
    ]) {
      expect(serialized).not.toContain(privateDetail);
    }
  });

  it("repeats all checks and uses TEST_DATABASE_URL for independent connections", async () => {
    const coordinatorProbe = mockProbe();
    const independentProbe = mockProbe();
    const coordinatorDatabase = mockMutableDatabase();
    const independentDatabase = mockMutableDatabase();
    const testDependencies = dependencies(
      [coordinatorProbe, independentProbe],
      [coordinatorDatabase, independentDatabase],
    );

    const result = await tryOpenPackageBTestDatabase(
      validEnvironment,
      testDependencies,
    );
    expect(result.ready).toBe(true);
    if (!result.ready) return;
    const independent = await result.verified.openIndependentConnection();

    expect(testDependencies.createReadOnlyProbe).toHaveBeenCalledTimes(2);
    expect(coordinatorProbe.queryRows).toHaveBeenCalledTimes(2);
    expect(independentProbe.queryRows).toHaveBeenCalledTimes(2);
    expect(testDependencies.createMutableClient).toHaveBeenCalledTimes(2);
    for (const [configuration] of [
      ...testDependencies.createReadOnlyProbe.mock.calls,
      ...testDependencies.createMutableClient.mock.calls,
    ]) {
      expectCertificateVerifiedTransport(configuration);
    }
    await result.verified.closeIndependentConnection(independent);
    await result.verified.close();
  });

  it("sanitizes probe cleanup and mutable-client failures", async () => {
    const privateDetail =
      "postgresql://private-user:private-secret@private.invalid/private";
    const closingProbe = mockProbe({ closeError: new Error(privateDetail) });
    const failingDependencies = dependencies([closingProbe]);
    failingDependencies.createMutableClient.mockImplementation(() => {
      throw new Error(privateDetail);
    });

    const result = await tryOpenPackageBTestDatabase(
      validEnvironment,
      failingDependencies,
    );

    expect(result).toEqual({
      ready: false,
      reason: "ISOLATION_NOT_VERIFIED",
    });
    expect(JSON.stringify(result)).not.toContain(privateDetail);
    expect(JSON.stringify(result)).not.toContain("private-secret");
  });
});

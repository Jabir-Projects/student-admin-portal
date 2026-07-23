// @vitest-environment node

import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";

const factoryMocks = vi.hoisted(() => ({
  createPrismaClient: vi.fn(),
}));

vi.mock("@/server/db/factory.node", () => ({
  createPrismaClient: factoryMocks.createPrismaClient,
}));

import {
  hasIsolatedTestDatabaseConfiguration,
  openVerifiedIsolatedTestDatabase,
  readApplicationModelCounts,
  type VerifiedTestDatabaseClient,
} from "@/test/isolated-database.node";

const developmentUrl = "postgresql://development.invalid/application";
const testUrl = "postgresql://test.invalid/application";
const validEnvironment = {
  NODE_ENV: "test",
  DATABASE_URL: developmentUrl,
  TEST_DATABASE_URL: testUrl,
} as const;

type IdentityRow = {
  databaseName: string;
  databaseOid: bigint;
  systemIdentifier: string | null;
};

type CountOverrides = Partial<
  Record<
    | "user"
    | "studentProfile"
    | "studentRegistry"
    | "requestCategory"
    | "documentRequest"
    | "requestStatusHistory"
    | "requestMessage"
    | "notification"
    | "auditLog",
    number | Error
  >
>;

const developmentIdentity = {
  databaseName: "development",
  databaseOid: BigInt(16_384),
  systemIdentifier: "durable-development-system",
} satisfies IdentityRow;

const testIdentity = {
  databaseName: "isolated_test",
  databaseOid: BigInt(16_385),
  systemIdentifier: "durable-test-system",
} satisfies IdentityRow;

function countDelegate(value: number | Error | undefined, fallback: number) {
  return {
    count:
      value instanceof Error
        ? vi.fn().mockRejectedValue(value)
        : vi.fn().mockResolvedValue(value ?? fallback),
  };
}

function mockClient(
  identity: IdentityRow,
  options: {
    counts?: CountOverrides;
    disconnect?: ReturnType<typeof vi.fn>;
    identityError?: Error;
  } = {},
): PrismaClient {
  const queryRaw = options.identityError
    ? vi.fn().mockRejectedValue(options.identityError)
    : vi.fn().mockResolvedValue([identity]);
  const counts = options.counts ?? {};

  return {
    $queryRaw: queryRaw,
    $disconnect: options.disconnect ?? vi.fn().mockResolvedValue(undefined),
    user: countDelegate(counts.user, 1),
    studentProfile: countDelegate(counts.studentProfile, 2),
    studentRegistry: countDelegate(counts.studentRegistry, 3),
    requestCategory: countDelegate(counts.requestCategory, 4),
    documentRequest: countDelegate(counts.documentRequest, 5),
    requestStatusHistory: countDelegate(counts.requestStatusHistory, 6),
    requestMessage: countDelegate(counts.requestMessage, 7),
    notification: countDelegate(counts.notification, 8),
    auditLog: countDelegate(counts.auditLog, 9),
  } as unknown as PrismaClient;
}

function queueClients(development: PrismaClient, test: PrismaClient): void {
  factoryMocks.createPrismaClient
    .mockReturnValueOnce(development)
    .mockReturnValueOnce(test);
}

beforeEach(() => {
  factoryMocks.createPrismaClient.mockReset();
});

describe("isolated database configuration", () => {
  it("rejects an environment outside NODE_ENV=test", () => {
    expect(
      hasIsolatedTestDatabaseConfiguration({
        ...validEnvironment,
        NODE_ENV: "development",
      }),
    ).toBe(false);
  });

  it("rejects a missing development URL", () => {
    expect(
      hasIsolatedTestDatabaseConfiguration({
        NODE_ENV: "test",
        TEST_DATABASE_URL: testUrl,
      }),
    ).toBe(false);
  });

  it("rejects a missing test URL", () => {
    expect(
      hasIsolatedTestDatabaseConfiguration({
        NODE_ENV: "test",
        DATABASE_URL: developmentUrl,
      }),
    ).toBe(false);
  });

  it("rejects a non-PostgreSQL protocol", () => {
    expect(
      hasIsolatedTestDatabaseConfiguration({
        ...validEnvironment,
        TEST_DATABASE_URL: "https://test.invalid/application",
      }),
    ).toBe(false);
  });

  it("rejects equal raw URLs", () => {
    expect(
      hasIsolatedTestDatabaseConfiguration({
        ...validEnvironment,
        TEST_DATABASE_URL: developmentUrl,
      }),
    ).toBe(false);
  });
});

describe("durable database identity verification", () => {
  it("rejects different endpoints that resolve to the same durable tuple", async () => {
    const development = mockClient(developmentIdentity);
    const test = mockClient(developmentIdentity);
    queueClients(development, test);

    await expect(
      openVerifiedIsolatedTestDatabase(validEnvironment),
    ).rejects.toThrow("Isolated test database identity could not be verified.");
    expect(development.$disconnect).toHaveBeenCalledTimes(1);
    expect(test.$disconnect).toHaveBeenCalledTimes(1);
  });

  it("accepts different databases in the same PostgreSQL cluster", async () => {
    const development = mockClient(developmentIdentity);
    const test = mockClient({
      databaseName: "isolated_test",
      databaseOid: BigInt(16_385),
      systemIdentifier: developmentIdentity.systemIdentifier,
    });
    queueClients(development, test);

    const verified = await openVerifiedIsolatedTestDatabase(validEnvironment);

    expect(development.$disconnect).toHaveBeenCalledTimes(1);
    await verified.close();
  });

  it("accepts databases from different PostgreSQL systems", async () => {
    const development = mockClient(developmentIdentity);
    const test = mockClient(testIdentity);
    queueClients(development, test);

    const verified = await openVerifiedIsolatedTestDatabase(validEnvironment);

    expect(development.$disconnect).toHaveBeenCalledTimes(1);
    await verified.close();
  });

  it("fails closed without a development system identifier", async () => {
    const development = mockClient({
      ...developmentIdentity,
      systemIdentifier: null,
    });
    const test = mockClient(testIdentity);
    queueClients(development, test);

    await expect(
      openVerifiedIsolatedTestDatabase(validEnvironment),
    ).rejects.toThrow("Isolated test database identity could not be verified.");
    expect(development.$disconnect).toHaveBeenCalledTimes(1);
    expect(test.$disconnect).toHaveBeenCalledTimes(1);
  });

  it("fails closed without a test system identifier", async () => {
    const development = mockClient(developmentIdentity);
    const test = mockClient({ ...testIdentity, systemIdentifier: null });
    queueClients(development, test);

    await expect(
      openVerifiedIsolatedTestDatabase(validEnvironment),
    ).rejects.toThrow("Isolated test database identity could not be verified.");
    expect(development.$disconnect).toHaveBeenCalledTimes(1);
    expect(test.$disconnect).toHaveBeenCalledTimes(1);
  });

  it("disconnects the development client after partial client creation failure", async () => {
    const development = mockClient(developmentIdentity);
    factoryMocks.createPrismaClient
      .mockReturnValueOnce(development)
      .mockImplementationOnce(() => {
        throw new Error("private test client construction failure");
      });

    await expect(
      openVerifiedIsolatedTestDatabase(validEnvironment),
    ).rejects.toThrow("Isolated test database identity could not be verified.");
    expect(development.$disconnect).toHaveBeenCalledTimes(1);
  });

  it("disconnects both clients after an identity query failure", async () => {
    const development = mockClient(developmentIdentity, {
      identityError: new Error("private identity query failure"),
    });
    const test = mockClient(testIdentity);
    queueClients(development, test);

    await expect(
      openVerifiedIsolatedTestDatabase(validEnvironment),
    ).rejects.toThrow("Isolated test database identity could not be verified.");
    expect(development.$disconnect).toHaveBeenCalledTimes(1);
    expect(test.$disconnect).toHaveBeenCalledTimes(1);
  });

  it("disconnects development immediately after verification", async () => {
    const development = mockClient(developmentIdentity);
    const test = mockClient(testIdentity);
    queueClients(development, test);

    const verified = await openVerifiedIsolatedTestDatabase(validEnvironment);

    expect(development.$disconnect).toHaveBeenCalledTimes(1);
    await verified.close();
  });

  it("leaves the returned test client open until close", async () => {
    const development = mockClient(developmentIdentity);
    const test = mockClient(testIdentity);
    queueClients(development, test);

    const verified = await openVerifiedIsolatedTestDatabase(validEnvironment);

    expect(test.$disconnect).not.toHaveBeenCalled();
    await verified.close();
    expect(test.$disconnect).toHaveBeenCalledTimes(1);
  });
});

describe("verified client close lifecycle", () => {
  it("closes the test client successfully", async () => {
    const development = mockClient(developmentIdentity);
    const test = mockClient(testIdentity);
    queueClients(development, test);
    const verified = await openVerifiedIsolatedTestDatabase(validEnvironment);

    await expect(verified.close()).resolves.toBeUndefined();
    expect(test.$disconnect).toHaveBeenCalledTimes(1);
  });

  it("does not disconnect again after a successful close", async () => {
    const development = mockClient(developmentIdentity);
    const test = mockClient(testIdentity);
    queueClients(development, test);
    const verified = await openVerifiedIsolatedTestDatabase(validEnvironment);

    await verified.close();
    await verified.close();

    expect(test.$disconnect).toHaveBeenCalledTimes(1);
  });

  it("allows a later close to retry after disconnect failure", async () => {
    const disconnect = vi
      .fn()
      .mockRejectedValueOnce(new Error("private disconnect failure"))
      .mockResolvedValueOnce(undefined);
    const development = mockClient(developmentIdentity);
    const test = mockClient(testIdentity, { disconnect });
    queueClients(development, test);
    const verified = await openVerifiedIsolatedTestDatabase(validEnvironment);

    await expect(verified.close()).rejects.toThrow(
      "Isolated test database could not be closed.",
    );
    await expect(verified.close()).resolves.toBeUndefined();
    expect(disconnect).toHaveBeenCalledTimes(2);
  });

  it("coalesces concurrent close calls", async () => {
    let releaseDisconnect = () => {};
    const disconnect = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseDisconnect = resolve;
        }),
    );
    const development = mockClient(developmentIdentity);
    const test = mockClient(testIdentity, { disconnect });
    queueClients(development, test);
    const verified = await openVerifiedIsolatedTestDatabase(validEnvironment);

    const firstClose = verified.close();
    const secondClose = verified.close();
    expect(disconnect).toHaveBeenCalledTimes(1);
    releaseDisconnect();
    await Promise.all([firstClose, secondClose]);
    await verified.close();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});

describe("verified application model counts", () => {
  it("does not accept an arbitrary PrismaClient type", () => {
    expectTypeOf<PrismaClient>().not.toMatchTypeOf<VerifiedTestDatabaseClient>();
  });

  it("returns numeric counts only", async () => {
    const development = mockClient(developmentIdentity);
    const test = mockClient(testIdentity);
    queueClients(development, test);
    const verified = await openVerifiedIsolatedTestDatabase(validEnvironment);

    await expect(
      readApplicationModelCounts(verified.database),
    ).resolves.toStrictEqual({
      user: 1,
      studentProfile: 2,
      studentRegistry: 3,
      requestCategory: 4,
      documentRequest: 5,
      documentRequestStatusHistory: 6,
      message: 7,
      notification: 8,
      auditLog: 9,
    });
    await verified.close();
  });

  it("maps Prisma count failures to one sanitized error", async () => {
    const development = mockClient(developmentIdentity);
    const test = mockClient(testIdentity, {
      counts: {
        studentRegistry: new Error(
          "private query metadata and postgresql://secret.invalid",
        ),
      },
    });
    queueClients(development, test);
    const verified = await openVerifiedIsolatedTestDatabase(validEnvironment);

    await expect(readApplicationModelCounts(verified.database)).rejects.toThrow(
      "Isolated test database counts are unavailable.",
    );
    await verified.close();
  });

  it("never includes URL or durable identity values in errors", async () => {
    const privateIdentity = "private-durable-system-identifier";
    const development = mockClient(developmentIdentity, {
      identityError: new Error(`${developmentUrl} ${privateIdentity}`),
    });
    const test = mockClient(testIdentity);
    queueClients(development, test);

    let thrown: unknown;
    try {
      await openVerifiedIsolatedTestDatabase(validEnvironment);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe(
      "Isolated test database identity could not be verified.",
    );
    expect((thrown as Error).message).not.toContain(developmentUrl);
    expect((thrown as Error).message).not.toContain(privateIdentity);
  });
});
